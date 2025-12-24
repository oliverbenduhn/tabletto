const cron = require('node-cron');
const { getDatabase } = require('../config/database');
const { createHistoryEntry } = require('../models/History');

let schedulerTask = null;

/**
 * Berechnet den täglichen Verbrauch für ein Medikament
 */
function calculateConsumption(medication) {
  // Täglicher Verbrauch
  const dailyConsumption = medication.dosage_morning + medication.dosage_noon + medication.dosage_evening;

  return dailyConsumption;
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
  const cronExpression = process.env.STOCK_SCHEDULER_CRON || '0 2 * * *';

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
