const cron = require('node-cron');
const { getDatabase } = require('../config/database');
const { createHistoryEntry } = require('../models/History');

let schedulerTask = null;

/**
 * Hauptfunktion: Wird alle 5 Minuten aufgerufen
 * Prüft für jeden User und jede Tageszeit ob Abzug fällig ist
 */
async function checkAndDeductForAllUsers() {
  const db = getDatabase();
  const currentTime = getCurrentTime();

  try {
    const users = await db.all('SELECT * FROM users');

    for (const user of users) {
      // Morning
      if (isWithinTimeWindow(currentTime, user.dose_time_morning, 2)) {
        await deductMorning(user.id);
      }

      // Noon (Spezialfall)
      if (isWithinTimeWindow(currentTime, user.dose_time_noon, 2)) {
        await deductNoon(user.id);
      }

      // Evening
      if (isWithinTimeWindow(currentTime, user.dose_time_evening, 2)) {
        await deductEvening(user.id);
      }
    }
  } catch (error) {
    console.error('Stock-Scheduler: Fehler:', error);
  }
}

/**
 * Morning: Reduziert dosage_morning für tägliche Medikamente
 */
async function deductMorning(userId) {
  const db = getDatabase();
  const medications = await db.all(
    'SELECT * FROM medications WHERE user_id = ? AND interval_days = 1',
    [userId]
  );

  for (const med of medications) {
    if (med.dosage_morning === 0) continue;
    if (!isMedicationDueToday(med)) continue;

    const oldStock = med.current_stock;
    const newStock = Math.max(0, oldStock - med.dosage_morning);

    await db.run(
      `UPDATE medications SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newStock, med.id]
    );

    await createHistoryEntry({
      medicationId: med.id,
      userId,
      action: 'auto_deduction_morning',
      oldStock,
      newStock
    });

    console.log(`Morning: ${med.name} - ${oldStock} → ${newStock} (-${med.dosage_morning})`);
  }
}

/**
 * Noon: Intervall-Medikamente ODER dosage_noon für tägliche
 */
async function deductNoon(userId) {
  const db = getDatabase();

  // Fall A: Intervall-Medikamente (interval_days > 1)
  const intervalMeds = await db.all(
    'SELECT * FROM medications WHERE user_id = ? AND interval_days > 1',
    [userId]
  );

  for (const med of intervalMeds) {
    if (med.dosage_per_interval === 0) continue;
    if (!isMedicationDueToday(med)) continue;

    const oldStock = med.current_stock;
    const newStock = Math.max(0, oldStock - med.dosage_per_interval);

    // Berechne nächsten Termin
    const nextDue = new Date(med.next_due_at);
    nextDue.setDate(nextDue.getDate() + med.interval_days);

    await db.run(
      `UPDATE medications
       SET current_stock = ?,
           next_due_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStock, nextDue.toISOString(), med.id]
    );

    await createHistoryEntry({
      medicationId: med.id,
      userId,
      action: 'auto_deduction_interval',
      oldStock,
      newStock
    });

    console.log(`Interval (Noon): ${med.name} - ${oldStock} → ${newStock} (-${med.dosage_per_interval}, next: ${nextDue.toISOString().split('T')[0]})`);
  }

  // Fall B: Tägliche Medikamente mit dosage_noon
  const dailyMeds = await db.all(
    'SELECT * FROM medications WHERE user_id = ? AND interval_days = 1',
    [userId]
  );

  for (const med of dailyMeds) {
    if (med.dosage_noon === 0) continue;
    if (!isMedicationDueToday(med)) continue;

    const oldStock = med.current_stock;
    const newStock = Math.max(0, oldStock - med.dosage_noon);

    await db.run(
      `UPDATE medications SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newStock, med.id]
    );

    await createHistoryEntry({
      medicationId: med.id,
      userId,
      action: 'auto_deduction_noon',
      oldStock,
      newStock
    });

    console.log(`Noon: ${med.name} - ${oldStock} → ${newStock} (-${med.dosage_noon})`);
  }
}

/**
 * Evening: Reduziert dosage_evening für tägliche Medikamente
 */
async function deductEvening(userId) {
  const db = getDatabase();
  const medications = await db.all(
    'SELECT * FROM medications WHERE user_id = ? AND interval_days = 1',
    [userId]
  );

  for (const med of medications) {
    if (med.dosage_evening === 0) continue;
    if (!isMedicationDueToday(med)) continue;

    const oldStock = med.current_stock;
    const newStock = Math.max(0, oldStock - med.dosage_evening);

    await db.run(
      `UPDATE medications SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newStock, med.id]
    );

    await createHistoryEntry({
      medicationId: med.id,
      userId,
      action: 'auto_deduction_evening',
      oldStock,
      newStock
    });

    console.log(`Evening: ${med.name} - ${oldStock} → ${newStock} (-${med.dosage_evening})`);
  }
}

/**
 * Hilfsfunktionen
 */
function isMedicationDueToday(medication) {
  const nextDue = new Date(medication.next_due_at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  nextDue.setHours(0, 0, 0, 0);
  return nextDue <= today;
}

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function isWithinTimeWindow(currentTime, targetTime, toleranceMinutes) {
  const [currentH, currentM] = currentTime.split(':').map(Number);
  const [targetH, targetM] = targetTime.split(':').map(Number);
  const currentMinutes = currentH * 60 + currentM;
  const targetMinutes = targetH * 60 + targetM;
  return Math.abs(currentMinutes - targetMinutes) <= toleranceMinutes;
}

/**
 * Scheduler starten
 */
function startStockScheduler() {
  const enabled = process.env.ENABLE_STOCK_SCHEDULER !== 'false';
  if (!enabled) {
    console.log('Stock-Scheduler: Deaktiviert');
    return;
  }

  // Läuft alle 5 Minuten: */5 * * * *
  const cronExpression = process.env.STOCK_SCHEDULER_CRON || '*/5 * * * *';

  if (!cron.validate(cronExpression)) {
    console.error(`Stock-Scheduler: Ungültiger Cron-Ausdruck: ${cronExpression}`);
    return;
  }

  schedulerTask = cron.schedule(cronExpression, checkAndDeductForAllUsers, {
    scheduled: true,
    timezone: process.env.TZ || 'Europe/Berlin'
  });

  console.log(`Stock-Scheduler: Gestartet mit Cron "${cronExpression}" (prüft User-individuelle Zeiten)`);
}

function stopStockScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    console.log('Stock-Scheduler: Gestoppt');
  }
}

async function runStockDeductionNow() {
  await checkAndDeductForAllUsers();
}

module.exports = {
  startStockScheduler,
  stopStockScheduler,
  runStockDeductionNow
};
