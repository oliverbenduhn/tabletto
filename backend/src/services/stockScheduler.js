const cron = require('node-cron');
const { withTransaction } = require('../config/database');
const { runStatusDetectionNow } = require('./notificationScheduler');

let schedulerTask = null;
let schedulerRunning = false;

const { parseTimestamp, zonedParts: getZonedParts, addDays, dueDate } = require('../utils/dates');

async function deduct(db, medication, slot, scheduledFor, amount, nextDueAt) {
  const result = await db.run(
    `INSERT OR IGNORE INTO stock_deductions (medication_id, user_id, slot, scheduled_for)
     VALUES (?, ?, ?, ?)`, [medication.id, medication.user_id, slot, scheduledFor]
  );
  if (!result.changes) return;
  const newStock = Math.max(0, medication.current_stock - amount);
  await db.run(`UPDATE medications SET current_stock = ?, next_due_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?`, [newStock, nextDueAt ?? medication.next_due_at, medication.id, medication.user_id]);
  await db.run(`INSERT INTO history (medication_id, user_id, action, old_stock, new_stock)
    VALUES (?, ?, ?, ?, ?)`, [medication.id, medication.user_id, `auto_deduction_${slot}`, medication.current_stock, newStock]);
  medication.current_stock = newStock;
}

/** Settles a user's old plan inside the caller's transaction before changing it. */
async function settleUser(db, userId, now = new Date()) {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return;
  const { date: today, time } = getZonedParts(now);
  const medications = await db.all('SELECT * FROM medications WHERE user_id = ?', [userId]);
  for (const med of medications) {
    const anchorValue = med.scheduler_anchor_at || med.created_at;
    const anchorDate = parseTimestamp(anchorValue);
    if (Number.isNaN(anchorDate.getTime())) continue;
    const anchor = getZonedParts(anchorDate);
    if (med.interval_days === 1) {
      for (const slot of ['morning', 'noon', 'evening']) {
        const amount = med[`dosage_${slot}`];
        const target = user[`dose_time_${slot}`];
        if (!amount || !target) continue;
        const last = await db.get(`SELECT MAX(scheduled_for) AS date FROM stock_deductions
          WHERE medication_id = ? AND user_id = ? AND slot = ?`, [med.id, userId, slot]);
        const end = time >= target ? today : addDays(today, -1);
        // Old installations without a cursor start today; an explicit anchor
        // prevents historical doses from touching a newly measured stock.
        let cursor = last.date ? addDays(last.date, 1) : today;
        if (cursor < anchor.date) cursor = anchor.date;
        if (cursor === anchor.date && anchor.time >= target) cursor = addDays(cursor, 1);
        for (let count = 0; cursor <= end && count < 366; count++, cursor = addDays(cursor, 1)) {
          await deduct(db, med, slot, cursor, amount);
        }
      }
    } else if (med.next_due_at && med.dosage_per_interval > 0) {
      if (Number.isNaN(parseTimestamp(med.next_due_at).getTime())) continue;
      let cursor = dueDate(med.next_due_at);
      const target = user.dose_time_noon;
      if (!target) continue;
      const end = time >= target ? today : addDays(today, -1);
      // Skip elapsed doses covered by the measurement without changing stock.
      while (cursor < anchor.date || (cursor === anchor.date && anchor.time >= target)) {
        cursor = addDays(cursor, med.interval_days);
      }
      for (let count = 0; cursor <= end && count < 366; count++) {
        const next = addDays(cursor, med.interval_days);
        await deduct(db, med, 'interval', cursor, med.dosage_per_interval, `${next}T12:00:00`);
        cursor = next;
      }
      await db.run('UPDATE medications SET next_due_at = ? WHERE id = ? AND user_id = ?', [`${cursor}T12:00:00`, med.id, userId]);
    }
  }
}

async function checkAndDeductForAllUsers(now = new Date()) {
  if (schedulerRunning) return;
  schedulerRunning = true;
  try {
    await withTransaction(async db => {
      const users = await db.all('SELECT id FROM users');
      for (const user of users) await settleUser(db, user.id, now);
    });
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
  schedulerTask = cron.schedule(cronExpression, () => {
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
  addDays,
  settleUser
};
