const cron = require('node-cron');
const { getDatabase } = require('../config/database');
const { createHistoryEntry } = require('../models/History');

let schedulerTask = null;

/**
 * Prüft ob zwei Daten am selben Tag sind
 */
function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Berechnet den Verbrauch für ein Medikament basierend auf der Zeit seit der letzten Messung
 */
function calculateConsumption(medication) {
  const lastMeasured = new Date(medication.last_stock_measured_at);
  const now = new Date();

  // Berechne Tage seit letzter Messung
  const millisecondsDiff = now - lastMeasured;
  const daysElapsed = Math.floor(millisecondsDiff / (1000 * 60 * 60 * 24));

  // Täglicher Verbrauch
  const dailyConsumption = medication.dosage_morning + medication.dosage_noon + medication.dosage_evening;

  // Gesamtverbrauch
  return daysElapsed * dailyConsumption;
}

/**
 * Führt die automatische Bestandsreduktion für alle Medikamente durch
 */
async function deductStockDaily() {
  console.log('Stock-Scheduler: Starte automatische Bestandsreduktion');
  const db = getDatabase();

  try {
    // Hole alle Medikamente
    const medications = await db.all(`
      SELECT m.*
      FROM medications m
      JOIN users u ON m.user_id = u.id
    `);

    console.log(`Stock-Scheduler: Verarbeite ${medications.length} Medikamente`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const med of medications) {
      try {
        const lastMeasured = new Date(med.last_stock_measured_at);
        const now = new Date();

        // Überspringe wenn bereits heute aktualisiert (verhindert Doppel-Reduktion)
        if (isSameDay(lastMeasured, now)) {
          skippedCount++;
          continue;
        }

        // Berechne Verbrauch
        const consumed = calculateConsumption(med);

        // Überspringe wenn kein Verbrauch (z.B. Dosierung = 0)
        if (consumed === 0) {
          skippedCount++;
          continue;
        }

        const oldStock = med.current_stock;
        const newStock = oldStock - consumed;

        // Update Bestand (kann negativ werden)
        await db.run(
          `UPDATE medications
           SET current_stock = ?,
               last_stock_measured_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newStock, med.id]
        );

        // Erstelle History-Eintrag
        await createHistoryEntry({
          medicationId: med.id,
          userId: med.user_id,
          action: 'auto_deduction',
          oldStock: oldStock,
          newStock: newStock
        });

        processedCount++;
        console.log(`Stock-Scheduler: ${med.name} (ID: ${med.id}) - ${oldStock} → ${newStock} (${consumed} Tabletten reduziert)`);

      } catch (error) {
        console.error(`Stock-Scheduler: Fehler bei Medikament ${med.id}:`, error);
        // Fortfahren mit nächstem Medikament
      }
    }

    console.log(`Stock-Scheduler: Fertig. ${processedCount} verarbeitet, ${skippedCount} übersprungen`);

  } catch (error) {
    console.error('Stock-Scheduler: Fehler bei Bestandsreduktion:', error);
  }
}

/**
 * Startet den Scheduler
 */
function startStockScheduler() {
  // Lese Konfiguration aus Umgebungsvariablen
  const enabled = process.env.ENABLE_STOCK_SCHEDULER !== 'false';
  const cronExpression = process.env.STOCK_SCHEDULER_CRON || '0 0 * * *';

  if (!enabled) {
    console.log('Stock-Scheduler: Deaktiviert (ENABLE_STOCK_SCHEDULER=false)');
    return;
  }

  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    console.error(`Stock-Scheduler: Ungültiger Cron-Ausdruck: ${cronExpression}`);
    return;
  }

  // Schedule task
  schedulerTask = cron.schedule(cronExpression, deductStockDaily, {
    scheduled: true,
    timezone: process.env.TZ || 'Europe/Berlin'
  });

  console.log(`Stock-Scheduler: Gestartet mit Cron-Ausdruck "${cronExpression}" (Timezone: ${process.env.TZ || 'Europe/Berlin'})`);
}

/**
 * Stoppt den Scheduler (für graceful shutdown)
 */
function stopStockScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    console.log('Stock-Scheduler: Gestoppt');
  }
}

/**
 * Manueller Aufruf für Testing (nicht Teil des normalen Betriebs)
 */
async function runStockDeductionNow() {
  await deductStockDaily();
}

module.exports = {
  startStockScheduler,
  stopStockScheduler,
  runStockDeductionNow
};
