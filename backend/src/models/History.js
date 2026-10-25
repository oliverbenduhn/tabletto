const { getDatabase, enqueueWrite } = require('../config/database');

async function createHistoryEntry({ medicationId, userId, action, oldStock, newStock }) {
  const result = await enqueueWrite(db => db.run(
    `INSERT INTO history (medication_id, user_id, action, old_stock, new_stock)
     VALUES (?, ?, ?, ?, ?)`,
    [medicationId, userId, action, oldStock, newStock]
  ));
  const db = getDatabase();
  return db.get('SELECT * FROM history WHERE id = ? AND user_id = ?', [result.lastID, userId]);
}

async function getHistoryByMedication(medicationId, userId, limit = 50, cursor = null) {
  const db = getDatabase();
  return db.all(
    `SELECT * FROM history
     WHERE medication_id = ? AND user_id = ?
     ${cursor ? 'AND (julianday(timestamp) < julianday(?) OR (julianday(timestamp) = julianday(?) AND id < ?))' : ''}
     ORDER BY julianday(timestamp) DESC, id DESC
     LIMIT ?`,
    [medicationId, userId, ...(cursor ? [cursor.timestamp, cursor.timestamp, cursor.id] : []), limit]
  );
}

module.exports = { createHistoryEntry, getHistoryByMedication };
