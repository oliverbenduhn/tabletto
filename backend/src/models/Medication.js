const { getDatabase } = require('../config/database');

async function getAllByUser(userId) {
  const db = getDatabase();
  return db.all('SELECT * FROM medications WHERE user_id = ? ORDER BY created_at DESC', [userId]);
}

async function getById(id, userId) {
  const db = getDatabase();
  return db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [id, userId]);
}

async function createMedication(userId, data) {
  const db = getDatabase();

  // Calculate dosage_per_interval and interval_days
  const intervalDays = data.interval_days || 1;
  const dosagePerInterval = data.dosage_per_interval ||
    (data.dosage_morning || 0) + (data.dosage_noon || 0) + (data.dosage_evening || 0);

  // Calculate next_due_at (tomorrow for daily, or custom date)
  const nextDueAt = data.next_due_at || new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString();

  const result = await db.run(
    `INSERT INTO medications (
      user_id, name, dosage_morning, dosage_noon, dosage_evening, tablets_per_package,
      current_stock, warning_threshold_days, photo_path, interval_days, dosage_per_interval, next_due_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.name,
      data.dosage_morning || 0,
      data.dosage_noon || 0,
      data.dosage_evening || 0,
      data.tablets_per_package,
      data.current_stock,
      data.warning_threshold_days,
      data.photo_path || null,
      intervalDays,
      dosagePerInterval,
      nextDueAt
    ]
  );
  return getById(result.lastID, userId);
}

async function updateMedication(id, userId, data) {
  const db = getDatabase();
  const fields = [];
  const values = [];

  const editableFields = [
    'name',
    'dosage_morning',
    'dosage_noon',
    'dosage_evening',
    'tablets_per_package',
    'current_stock',
    'warning_threshold_days',
    'interval_days',
    'dosage_per_interval',
    'next_due_at'
  ];

  editableFields.forEach(field => {
    if (data[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(data[field]);
    }
  });

  // Auto-calculate dosage_per_interval if dosage fields changed
  if (data.dosage_morning !== undefined || data.dosage_noon !== undefined || data.dosage_evening !== undefined) {
    const current = await getById(id, userId);
    const newMorning = data.dosage_morning !== undefined ? data.dosage_morning : current.dosage_morning;
    const newNoon = data.dosage_noon !== undefined ? data.dosage_noon : current.dosage_noon;
    const newEvening = data.dosage_evening !== undefined ? data.dosage_evening : current.dosage_evening;

    const calculatedDosage = newMorning + newNoon + newEvening;
    if (data.dosage_per_interval === undefined) {
      fields.push('dosage_per_interval = ?');
      values.push(calculatedDosage);
    }
  }

  if (!fields.length) {
    return getById(id, userId);
  }

  values.push(id, userId);

  // Update timestamps: updated_at und last_stock_measured_at bei jeder Änderung
  await db.run(
    `UPDATE medications SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP, last_stock_measured_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
    values
  );

  return getById(id, userId);
}

async function deleteMedication(id, userId) {
  const db = getDatabase();
  const result = await db.run('DELETE FROM medications WHERE id = ? AND user_id = ?', [id, userId]);
  return result.changes > 0;
}

async function updateStock(id, userId, newStock) {
  const db = getDatabase();
  // Update stock und reset Zeitstempel für automatische Reduktion
  await db.run(
    'UPDATE medications SET current_stock = ?, updated_at = CURRENT_TIMESTAMP, last_stock_measured_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [newStock, id, userId]
  );
  return getById(id, userId);
}

async function updatePhoto(id, userId, photoPath) {
  const db = getDatabase();
  await db.run('UPDATE medications SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [
    photoPath,
    id,
    userId
  ]);
  return getById(id, userId);
}

module.exports = { getAllByUser, getById, createMedication, updateMedication, deleteMedication, updateStock, updatePhoto };
