const { getDatabase, enqueueWrite, withTransaction } = require('../config/database');

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
  const dosagePerInterval = intervalDays === 1
    ? (data.dosage_morning || 0) + (data.dosage_noon || 0) + (data.dosage_evening || 0)
    : data.dosage_per_interval;

  // Interval records require an explicit due-date cursor at the HTTP boundary.
  const nextDueAt = data.next_due_at || null;

  return enqueueWrite(async db => {
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
    return db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [result.lastID, userId]);
  });
}

async function updateMedication(id, userId, data, now = new Date()) {
  return withTransaction(async db => {
    const current = await db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [id, userId]);
    if (!current) return null;
    const editable = ['name', 'dosage_morning', 'dosage_noon', 'dosage_evening', 'tablets_per_package',
      'warning_threshold_days', 'interval_days', 'dosage_per_interval', 'next_due_at'];
    const scheduleFields = ['dosage_morning', 'dosage_noon', 'dosage_evening', 'interval_days', 'dosage_per_interval', 'next_due_at'];
    const changesPlan = scheduleFields.some(field => data[field] !== undefined && data[field] !== current[field]);
    if (changesPlan) {
      await require('../services/stockScheduler').settleUser(db, userId, now);
      // Schedule changes apply only after the old plan has been settled.
      data = { ...data, scheduler_anchor_at: now.toISOString() };
      editable.push('scheduler_anchor_at');
    }
    const candidate = { ...current, ...data };
    if (candidate.interval_days === 1) {
      data = { ...data, next_due_at: null, dosage_per_interval: candidate.dosage_morning + candidate.dosage_noon + candidate.dosage_evening };
    }
    const fields = editable.filter(field => data[field] !== undefined);
    if (fields.length) await db.run(`UPDATE medications SET ${fields.map(field => `${field} = ?`).join(', ')},
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`, [...fields.map(field => data[field]), id, userId]);
    return db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [id, userId]);
  });
}

async function deleteMedication(id, userId) {
  return withTransaction(async db => {
    const existing = await db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existing) return null;
    await db.run('DELETE FROM medications WHERE id = ? AND user_id = ?', [id, userId]);
    return existing;
  });
}

async function updatePhoto(id, userId, photoPath) {
  return withTransaction(async db => {
    const existing = await db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existing) return null;
    await db.run('UPDATE medications SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [photoPath, id, userId]);
    return { medication: await db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [id, userId]), oldPhotoPath: existing.photo_path };
  });
}

module.exports = { getAllByUser, getById, createMedication, updateMedication, deleteMedication, updatePhoto };
