const cron = require('node-cron');
const { getDatabase } = require('../config/database');
const { createHistoryEntry } = require('../models/History');

let schedulerTask = null;

/**
 * Führt die automatische Bestandsreduktion für alle Medikamente durch
 * Unterstützt sowohl tägliche als auch intervall-basierte Einnahmen
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
        const dosagePerInterval = med.dosage_per_interval || 0;
        const intervalDays = med.interval_days || 1;

        // Überspringe wenn kein Verbrauch
        if (dosagePerInterval === 0) {
          skippedCount++;
          continue;
        }

        // Prüfe ob das Medikament heute fällig ist
        const nextDue = med.next_due_at ? new Date(med.next_due_at) : null;
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Nur Datum vergleichen

        // Wenn next_due_at nicht gesetzt oder in der Zukunft liegt, überspringe
        if (!nextDue || nextDue > now) {
          skippedCount++;
          continue;
        }

        const oldStock = med.current_stock;
        const newStock = Math.max(0, oldStock - dosagePerInterval);

        // Berechne nächsten Termin
        const newNextDue = new Date(nextDue);
        newNextDue.setDate(newNextDue.getDate() + intervalDays);

        // Update Bestand und nächsten Termin
        await db.run(
          `UPDATE medications
           SET current_stock = ?,
               next_due_at = ?,
               last_stock_measured_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newStock, newNextDue.toISOString(), med.id]
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
        console.log(`Stock-Scheduler: ${med.name} (ID: ${med.id}) - ${oldStock} → ${newStock} (${dosagePerInterval} reduziert, Intervall: ${intervalDays} Tage)`);

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
