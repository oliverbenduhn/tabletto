const cron = require('node-cron');
const { getDatabase, withTransaction } = require('../config/database');
const { runStatusDetectionNow } = require('./notificationScheduler');

let schedulerTask = null;
let schedulerRunning = false;

function getZonedParts(date = new Date(), timeZone = process.env.TZ || 'Europe/Berlin') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function addDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function compareTimes(left, right) {
  return left.localeCompare(right);
}

async function processDeduction({ medicationId, userId, slot, scheduledFor, amount, nextDueAt = undefined }) {
  return withTransaction(async db => {
    const medication = await db.get(
      'SELECT * FROM medications WHERE id = ? AND user_id = ?',
      [medicationId, userId]
    );
    if (!medication) return false;

    try {
      await db.run(
        `INSERT INTO stock_deductions (medication_id, user_id, slot, scheduled_for)
         VALUES (?, ?, ?, ?)`,
        [medicationId, userId, slot, scheduledFor]
      );
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') return false;
      throw error;
    }

    const oldStock = medication.current_stock;
    const newStock = Math.max(0, oldStock - amount);
    if (nextDueAt !== undefined) {
      await db.run(
        `UPDATE medications SET current_stock = ?, next_due_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [newStock, nextDueAt, medicationId, userId]
      );
    } else {
      await db.run(
        `UPDATE medications SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [newStock, medicationId, userId]
      );
    }
    await db.run(
      `INSERT INTO history (medication_id, user_id, action, old_stock, new_stock)
       VALUES (?, ?, ?, ?, ?)`,
      [medicationId, userId, `auto_deduction_${slot}`, oldStock, newStock]
    );
    return true;
  });
}

async function dailyDatesToProcess(db, medication, slot, today, currentTime, targetTime, timeZone) {
  const last = await db.get(
    `SELECT MAX(scheduled_for) AS last_date FROM stock_deductions
     WHERE medication_id = ? AND slot = ?`,
    [medication.id, slot]
  );
  const lastEligibleDate = compareTimes(currentTime, targetTime) >= 0 ? today : addDays(today, -1);
  const createdTimestamp = medication.created_at.includes('T')
    ? medication.created_at
    : `${medication.created_at.replace(' ', 'T')}Z`;
  const created = getZonedParts(new Date(createdTimestamp), timeZone);
  if (!last?.last_date) {
    if (lastEligibleDate !== today) return [];
    if (created.date === today && compareTimes(created.time, targetTime) > 0) return [];
    return [today];
  }

  const dates = [];
  let cursor = addDays(last.last_date, 1);
  while (cursor <= lastEligibleDate && dates.length < 366) {
    if (cursor >= created.date) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

async function processDailySlot(user, slot, amountField, today, currentTime, timeZone) {
  const targetTime = user[`dose_time_${slot}`];
  if (!targetTime) return;
  const db = getDatabase();
  const medications = await db.all(
    `SELECT * FROM medications
     WHERE user_id = ? AND interval_days = 1 AND ${amountField} > 0`,
    [user.id]
  );
  for (const medication of medications) {
    const dates = await dailyDatesToProcess(db, medication, slot, today, currentTime, targetTime, timeZone);
    for (const scheduledFor of dates) {
      await processDeduction({
        medicationId: medication.id,
        userId: user.id,
        slot,
        scheduledFor,
        amount: medication[amountField]
      });
    }
  }
}

async function processIntervalMedications(user, today, currentTime, timeZone) {
  if (!user.dose_time_noon || compareTimes(currentTime, user.dose_time_noon) < 0) return;
  const medications = await getDatabase().all(
    `SELECT * FROM medications
     WHERE user_id = ? AND interval_days > 1 AND dosage_per_interval > 0`,
    [user.id]
  );
  for (const medication of medications) {
    if (!medication.next_due_at || Number.isNaN(new Date(medication.next_due_at).getTime())) {
      console.error(`Stock-Scheduler: Medikament ${medication.id} hat kein gültiges next_due_at`);
      continue;
    }
    let dueDate = getZonedParts(new Date(medication.next_due_at), timeZone).date;
    let iterations = 0;
    while (dueDate <= today && iterations < 366) {
      const nextDueDate = addDays(dueDate, medication.interval_days);
      const processed = await processDeduction({
        medicationId: medication.id,
        userId: user.id,
        slot: 'interval',
        scheduledFor: dueDate,
        amount: medication.dosage_per_interval,
        nextDueAt: `${nextDueDate}T12:00:00`
      });
      if (!processed) break;
      dueDate = nextDueDate;
      iterations++;
    }
  }
}

async function checkAndDeductForAllUsers(now = new Date()) {
  if (schedulerRunning) return;
  schedulerRunning = true;
  const timeZone = process.env.TZ || 'Europe/Berlin';
  const { date: today, time: currentTime } = getZonedParts(now, timeZone);
  try {
    const users = await getDatabase().all(
      `SELECT id, dose_time_morning, dose_time_noon, dose_time_evening FROM users`
    );
    for (const user of users) {
      await processDailySlot(user, 'morning', 'dosage_morning', today, currentTime, timeZone);
      await processDailySlot(user, 'noon', 'dosage_noon', today, currentTime, timeZone);
      await processDailySlot(user, 'evening', 'dosage_evening', today, currentTime, timeZone);
      await processIntervalMedications(user, today, currentTime, timeZone);
    }
    // Status detection piggybacks on the stock tick. Mail failures must never
    // abort the deduction pass — wrap in a self-contained catch.
    await runStatusDetectionNow().catch(error => console.error('Stock-Scheduler: Statuserkennung fehlgeschlagen:', error));
  } finally {
    schedulerRunning = false;
  }
}

function startStockScheduler() {
  if (process.env.ENABLE_STOCK_SCHEDULER === 'false') return;
  if (schedulerTask) return;
  const cronExpression = process.env.STOCK_SCHEDULER_CRON || '*/5 * * * *';
  if (!cron.validate(cronExpression)) {
    throw new Error(`Ungültiger STOCK_SCHEDULER_CRON: ${cronExpression}`);
  }
  const timeZone = process.env.TZ || 'Europe/Berlin';
  schedulerTask = cron.schedule(() => {
    checkAndDeductForAllUsers().catch(error => console.error('Stock-Scheduler: Fehler:', error));
  }, { scheduled: true, timezone: timeZone });
  console.log(`Stock-Scheduler: Gestartet mit Cron "${cronExpression}" in ${timeZone}`);
}

function stopStockScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
  }
}

async function runStockDeductionNow(now) {
  await checkAndDeductForAllUsers(now);
}

module.exports = {
  startStockScheduler,
  stopStockScheduler,
  runStockDeductionNow,
  getZonedParts,
  addDays
};
