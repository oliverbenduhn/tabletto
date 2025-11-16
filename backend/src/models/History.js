const { getDatabase } = require('../config/database');

async function createHistoryEntry({ medicationId, userId, action, oldStock, newStock }) {
  const db = getDatabase();
  const result = await db.run(
    `INSERT INTO history (medication_id, user_id, action, old_stock, new_stock)
     VALUES (?, ?, ?, ?, ?)`,
    [medicationId, userId, action, oldStock, newStock]
  );
  return db.get('SELECT * FROM history WHERE id = ?', [result.lastID]);
}

async function getHistoryByMedication(medicationId, userId, limit = 50) {
  const db = getDatabase();
  return db.all(
    `SELECT * FROM history
     WHERE medication_id = ? AND user_id = ?
     ORDER BY timestamp DESC
     LIMIT ?`,
    [medicationId, userId, limit]
  );
}

module.exports = { createHistoryEntry, getHistoryByMedication };
