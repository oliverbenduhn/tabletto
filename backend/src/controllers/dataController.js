const { getDatabase } = require('../config/database');

async function exportData(req, res) {
  try {
    const userId = req.user.userId;
    const db = getDatabase();

    // Hole alle Benutzerdaten
    const user = await db.get('SELECT id, email, created_at, last_login FROM users WHERE id = ?', [userId]);

    // Hole alle Medikamente des Benutzers
    const medications = await db.all(
      'SELECT * FROM medications WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    // Hole die komplette Historie inkl. Medikamenten-Namen für bessere Lesbarkeit
    const history = await db.all(
      `SELECT h.*, m.name as medication_name
       FROM history h
       LEFT JOIN medications m ON m.id = h.medication_id
       WHERE h.user_id = ?
       ORDER BY h.timestamp DESC`,
      [userId]
    );

    const exportData = {
      version: '1.0.5',
      exportDate: new Date().toISOString(),
      user: {
        email: user.email,
        created_at: user.created_at,
        last_login: user.last_login
      },
      medications,
      history
    };

    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    console.error('Export-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Exportieren der Daten' });
  }
}

async function importData(req, res) {
  try {
    const userId = req.user.userId;
    const { data } = req.body;

    if (!data || !Array.isArray(data.medications) || data.medications.length === 0) {
      return res.status(400).json({ error: 'Ungültige Import-Daten' });
    }

    const db = getDatabase();

    await db.exec('BEGIN TRANSACTION');

    // Lösche bestehende Daten (optional - könnte auch mergen)
    await db.run('DELETE FROM history WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM medications WHERE user_id = ?', [userId]);

    // Importiere Medikamente
    let medicationsImported = 0;
    const medicationIdMap = new Map();
    const medicationNameMap = new Map();
    const fallbackTimestamp = new Date().toISOString();

    for (const med of data.medications) {
      if (!med?.name) {
        continue;
      }

      const result = await db.run(
        `INSERT INTO medications (
          user_id,
          name,
          dosage_morning,
          dosage_noon,
          dosage_evening,
          tablets_per_package,
          current_stock,
          warning_threshold_days,
          created_at,
          updated_at,
          last_stock_measured_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          med.name,
          med.dosage_morning ?? 0,
          med.dosage_noon ?? 0,
          med.dosage_evening ?? 0,
          med.tablets_per_package ?? 0,
          med.current_stock ?? 0,
          med.warning_threshold_days ?? 7,
          med.created_at || fallbackTimestamp,
          med.updated_at || fallbackTimestamp,
          med.last_stock_measured_at || med.updated_at || fallbackTimestamp
        ]
      );

      // Merke neue IDs, um History-Einträge korrekt zuzuordnen
      if (med.id !== undefined && med.id !== null) {
        medicationIdMap.set(med.id, result.lastID);
      }
      medicationNameMap.set(med.name, result.lastID);
      medicationsImported++;
    }

    // Importiere Historie (falls vorhanden)
    let historyImported = 0;
    if (data.history && Array.isArray(data.history)) {
      for (const hist of data.history) {
        const medicationId =
          medicationIdMap.get(hist.medication_id) ||
          (hist.medication_name ? medicationNameMap.get(hist.medication_name) : null);

        if (!medicationId) {
          continue;
        }

        await db.run(
          `INSERT INTO history (medication_id, user_id, action, old_stock, new_stock, timestamp)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            medicationId,
            userId,
            hist.action,
            hist.old_stock,
            hist.new_stock,
            hist.timestamp || fallbackTimestamp
          ]
        );
        historyImported++;
      }
    }

    await db.exec('COMMIT');

    res.json({
      success: true,
      message: 'Daten erfolgreich importiert',
      imported: {
        medications: medicationsImported,
        history: historyImported
      }
    });
  } catch (error) {
    const db = getDatabase();
    try {
      await db.exec('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback-Fehler:', rollbackError);
    }
    console.error('Import-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Importieren der Daten' });
  }
}

module.exports = {
  exportData,
  importData
};
