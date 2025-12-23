/**
 * Korrektur-Script für korrupte Bestandsdaten
 * Behebt negative Bestände die durch fehlerhafte auto_deduction entstanden sind
 */

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function fixStockCorruption() {
  console.log('=== Korrektur-Script für Bestandsdaten ===\n');

  // Öffne Datenbank
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/tabletto.db');
  console.log(`Öffne Datenbank: ${dbPath}\n`);

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    // 1. Finde alle Medikamente mit negativem Bestand
    console.log('1. Suche nach korrupten Beständen...');
    const corruptedMeds = await db.all(`
      SELECT id, name, current_stock, user_id
      FROM medications
      WHERE current_stock < 0
      ORDER BY current_stock ASC
    `);

    if (corruptedMeds.length === 0) {
      console.log('✓ Keine korrupten Bestände gefunden!\n');
      await db.close();
      return;
    }

    console.log(`✗ ${corruptedMeds.length} Medikamente mit negativem Bestand gefunden:\n`);
    corruptedMeds.forEach(med => {
      console.log(`  - ${med.name} (ID ${med.id}): ${med.current_stock} Tabletten`);
    });

    // 2. Biete Optionen an
    console.log('\n2. Korrektur-Optionen:');
    console.log('   a) Setze alle negativen Bestände auf 0');
    console.log('   b) Lösche fehlerhafte History-Einträge und versuche Bestand zu rekonstruieren');
    console.log('   c) Manuelle Korrektur (Script beenden, manuell korrigieren)');

    // Für automatische Ausführung: Option A
    const option = process.env.FIX_OPTION || 'a';
    console.log(`\nGewählte Option: ${option.toUpperCase()}\n`);

    if (option === 'a') {
      // Option A: Setze auf 0
      console.log('Setze alle negativen Bestände auf 0...');

      for (const med of corruptedMeds) {
        const oldStock = med.current_stock;

        await db.run(`
          UPDATE medications
          SET current_stock = 0,
              last_stock_measured_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [med.id]);

        // Erstelle Korrektur-History-Eintrag
        await db.run(`
          INSERT INTO history (medication_id, user_id, action, old_stock, new_stock, timestamp)
          VALUES (?, ?, 'manual_correction', ?, 0, CURRENT_TIMESTAMP)
        `, [med.id, med.user_id, oldStock]);

        console.log(`  ✓ ${med.name}: ${oldStock} → 0`);
      }

      console.log('\n✓ Korrektur abgeschlossen!');

    } else if (option === 'b') {
      // Option B: Versuche zu rekonstruieren
      console.log('Rekonstruiere Bestände aus History...\n');

      for (const med of corruptedMeds) {
        // Hole alle History-Einträge für dieses Medikament
        const history = await db.all(`
          SELECT * FROM history
          WHERE medication_id = ?
          ORDER BY timestamp ASC
        `, [med.id]);

        console.log(`\n${med.name} (ID ${med.id}):`);
        console.log(`  Aktuelle History (${history.length} Einträge):`);

        // Finde den ersten "add_package" oder "set_stock" Eintrag (valider Startpunkt)
        let validStartIndex = -1;
        for (let i = 0; i < history.length; i++) {
          if (history[i].action === 'add_package' || history[i].action === 'set_stock') {
            validStartIndex = i;
            break;
          }
        }

        if (validStartIndex === -1) {
          console.log(`  ✗ Keine validen History-Einträge gefunden, setze auf 0`);
          await db.run(`
            UPDATE medications
            SET current_stock = 0,
                last_stock_measured_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [med.id]);
          continue;
        }

        // Rekonstruiere Bestand ab dem ersten validen Eintrag
        let reconstructedStock = history[validStartIndex].new_stock;
        console.log(`  Starte Rekonstruktion ab Eintrag ${validStartIndex + 1}: ${reconstructedStock} Tabletten`);

        // Lösche alle fehlerhaften auto_deduction Einträge
        const firstBadDeduction = history.find(h =>
          h.action === 'auto_deduction' &&
          (h.old_stock - h.new_stock) > 100 // Mehr als 100 Tabletten auf einmal = fehlerhafte Deduktion
        );

        if (firstBadDeduction) {
          console.log(`  Lösche fehlerhafte auto_deduction Einträge ab ${firstBadDeduction.timestamp}`);
          await db.run(`
            DELETE FROM history
            WHERE medication_id = ?
              AND action = 'auto_deduction'
              AND timestamp >= ?
          `, [med.id, firstBadDeduction.timestamp]);

          // Setze Bestand auf Stand vor fehlerhafter Deduktion
          reconstructedStock = firstBadDeduction.old_stock;
        }

        await db.run(`
          UPDATE medications
          SET current_stock = ?,
              last_stock_measured_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [reconstructedStock, med.id]);

        console.log(`  ✓ Bestand korrigiert auf: ${reconstructedStock}`);
      }

      console.log('\n✓ Rekonstruktion abgeschlossen!');

    } else {
      console.log('Script wird beendet. Bitte manuell korrigieren.');
    }

    // 3. Zeige Ergebnis
    console.log('\n3. Finale Bestände:');
    const finalMeds = await db.all(`
      SELECT id, name, current_stock
      FROM medications
      WHERE id IN (${corruptedMeds.map(m => m.id).join(',')})
    `);

    finalMeds.forEach(med => {
      console.log(`  - ${med.name} (ID ${med.id}): ${med.current_stock} Tabletten`);
    });

  } catch (error) {
    console.error('Fehler bei der Korrektur:', error);
  } finally {
    await db.close();
    console.log('\nDatenbank geschlossen.');
  }
}

// Script ausführen
fixStockCorruption().catch(console.error);
