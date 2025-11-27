const { getDatabase } = require('../config/database');

async function exportData(req, res) {
  try {
    const userId = req.user.userId;
    const db = getDatabase();

    // Hole alle Benutzerdaten
    const user = await db.get('SELECT id, email, created_at, last_login FROM users WHERE id = ?', [userId]);

    // Hole alle Medikamente des Benutzers
    const medications = await db.all('SELECT * FROM medications WHERE user_id = ?', [userId]);

    // Hole die komplette Historie
    const history = await db.all('SELECT * FROM history WHERE user_id = ?', [userId]);

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

    if (!data || !data.medications) {
      return res.status(400).json({ error: 'Ungültige Import-Daten' });
    }

    const db = getDatabase();

    // Lösche bestehende Daten (optional - könnte auch mergen)
    await db.run('DELETE FROM history WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM medications WHERE user_id = ?', [userId]);

    // Importiere Medikamente
    let medicationsImported = 0;
    for (const med of data.medications) {
      await db.run(
        `INSERT INTO medications (user_id, name, dosage_morning, dosage_evening, tablets_per_package, current_stock, warning_threshold_days)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          med.name,
          med.dosage_morning || 0,
          med.dosage_evening || 0,
          med.tablets_per_package,
          med.current_stock || 0,
          med.warning_threshold_days || 7
        ]
      );
      medicationsImported++;
    }

    // Importiere Historie (falls vorhanden)
    let historyImported = 0;
    if (data.history && Array.isArray(data.history)) {
      for (const hist of data.history) {
        // Finde die neue medication_id basierend auf dem Namen
        const medication = await db.get(
          'SELECT id FROM medications WHERE user_id = ? AND name = ?',
          [userId, hist.medication_name || '']
        );

        if (medication) {
          await db.run(
            `INSERT INTO history (medication_id, user_id, action, old_stock, new_stock, timestamp)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              medication.id,
              userId,
              hist.action,
              hist.old_stock,
              hist.new_stock,
              hist.timestamp
            ]
          );
          historyImported++;
        }
      }
    }

    res.json({
      success: true,
      message: 'Daten erfolgreich importiert',
      imported: {
        medications: medicationsImported,
        history: historyImported
      }
    });
  } catch (error) {
    console.error('Import-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Importieren der Daten' });
  }
}

module.exports = {
  exportData,
  importData
};
