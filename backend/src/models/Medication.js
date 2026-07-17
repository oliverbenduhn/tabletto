const { getDatabase, enqueueWrite } = require('../config/database');

async function getAllByUser(userId) {
  const db = getDatabase();
  return db.all('SELECT * FROM medications WHERE user_id = ? ORDER BY created_at DESC', [userId]);
}

async function getById(id, userId) {
  const db = getDatabase();
  return db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [id, userId]);
}

async function createMedication(userId, data) {
  // Daily and interval medications share one stock model. For daily records the
  // summed time-of-day doses are also the dose of the one-day interval.
  const intervalDays = data.interval_days ?? 1;
  const dosagePerInterval = data.dosage_per_interval ??
    (data.dosage_morning || 0) + (data.dosage_noon || 0) + (data.dosage_evening || 0);

  // next_due_at is the scheduler's due-date cursor. A new record starts after
  // one complete interval unless the user supplied a deliberate first date.
  const nextDueAt = data.next_due_at || null;

  const result = await enqueueWrite(db => db.run(
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
  ));
  return getById(result.lastID, userId);
}

async function updateMedication(id, userId, data) {
  const fields = [];
  const values = [];

  const editableFields = [
    'name',
    'dosage_morning',
    'dosage_noon',
    'dosage_evening',
    'tablets_per_package',
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

  // Keep the unified interval dose in sync with edited daily doses, but respect
  // an explicit interval dose supplied in the same request.
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

  await enqueueWrite(db => db.run(
    `UPDATE medications SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
    values
  ));

  return getById(id, userId);
}

async function deleteMedication(id, userId) {
  const result = await enqueueWrite(db => db.run('DELETE FROM medications WHERE id = ? AND user_id = ?', [id, userId]));
  return result.changes > 0;
}

async function updatePhoto(id, userId, photoPath) {
  await enqueueWrite(db => db.run('UPDATE medications SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [
    photoPath,
    id,
    userId
  ]));
  return getById(id, userId);
}

module.exports = { getAllByUser, getById, createMedication, updateMedication, deleteMedication, updatePhoto };
