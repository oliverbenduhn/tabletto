const { validateMedication } = require('../utils/validation');
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
        current_stock, warning_threshold_days, photo_path, interval_days, dosage_per_interval, next_due_at, scheduler_anchor_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        nextDueAt,
        intervalDays === 1 ? new Date().toISOString() : null
      ]
    );
    return db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [result.lastID, userId]);
  });
}

async function updateMedication(id, userId, data, now = new Date()) {
  return withTransaction(async db => {
    const current = await db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [id, userId]);
    if (!current) return null;
    const candidate = { ...current, ...data };
    if (candidate.interval_days === 1) {
      data = { ...data, next_due_at: null, dosage_per_interval: candidate.dosage_morning + candidate.dosage_noon + candidate.dosage_evening };
    }
    const errors = validateMedication(candidate, { archive: candidate.next_due_at === current.next_due_at });
    if (errors.length) throw Object.assign(new Error(errors.join(', ')), { status: 400 });
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
    const fields = editable.filter(field => data[field] !== undefined);
    if (fields.length) await db.run(`UPDATE medications SET ${fields.map(field => `${field} = ?`).join(', ')},
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`, [...fields.map(field => data[field]), id, userId]);
    return db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [id, userId]);
  });
}

/** Atomically books stock and preserves the outcome for retries. */
async function bookStock(id, userId, { action, amount, key }) {
  const payload = JSON.stringify([action, amount]);
  return withTransaction(async db => {
    if (key !== undefined) {
      const previous = await db.get(`SELECT payload, response, medication_id = ? AS same_medication
        FROM stock_operations WHERE user_id = ? AND operation_key = ?`, [id, userId, key]);
      if (previous) {
        if (!previous.same_medication || previous.payload !== payload) {
          return { conflict: true };
        }
        return JSON.parse(previous.response);
      }
    }
    const medication = await db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [id, userId]);
    if (!medication) return null;
    const delta = amount === undefined ? medication.tablets_per_package : amount;
    if (action === 'add_package' && (!Number.isFinite(delta) || delta <= 0)) {
      const error = new Error('Packungsgröße muss größer als 0 sein');
      error.status = 400;
      throw error;
    }
    if (action === 'set_stock' && (!Number.isFinite(amount) || amount < 0 || amount > 10000)) {
      const error = new Error('Bestand muss zwischen 0 und 10000 liegen');
      error.status = 400;
      throw error;
    }
    const newStock = action === 'add_package' ? medication.current_stock + delta : amount;
    if (newStock > 10000) {
      const error = new Error('Bestand darf 10000 nicht überschreiten');
      error.status = 400;
      throw error;
    }
    await db.run(
      `UPDATE medications SET current_stock = ?, updated_at = CURRENT_TIMESTAMP,
       last_stock_measured_at = CASE WHEN ? = 'set_stock' THEN CURRENT_TIMESTAMP ELSE last_stock_measured_at END,
       scheduler_anchor_at = CASE WHEN ? = 'set_stock' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE scheduler_anchor_at END
       WHERE id = ? AND user_id = ?`,
      [newStock, action, action, id, userId]
    );
    const historyResult = await db.run(
      'INSERT INTO history (medication_id, user_id, action, old_stock, new_stock) VALUES (?, ?, ?, ?, ?)',
      [id, userId, action, medication.current_stock, newStock]
    );
    const response = {
      medication: await db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [medication.id, userId]),
      history_entry: await db.get('SELECT * FROM history WHERE id = ? AND user_id = ?', [historyResult.lastID, userId])
    };
    if (key !== undefined) {
      await db.run('INSERT INTO stock_operations (user_id, operation_key, medication_id, payload, response) VALUES (?, ?, ?, ?, ?)',
        [userId, key, medication.id, payload, JSON.stringify(response)]);
    }
    return response;
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

module.exports = { getAllByUser, getById, createMedication, updateMedication, bookStock, deleteMedication, updatePhoto };
