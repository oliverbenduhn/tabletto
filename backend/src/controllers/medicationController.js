const Medication = require('../models/Medication');
const History = require('../models/History');
const { calculateMedicationStats } = require('../utils/calculations');
const { validateMedication } = require('../utils/validation');
const fs = require('fs');
const crypto = require('crypto');
const { withTransaction } = require('../config/database');
const { JWT_SECRET } = require('../config/jwt');
const {
  resolveUploadPath,
  toRelativeMedicationPath
} = require('../utils/uploads');

function createPhotoUrl(medication) {
  if (!medication.photo_path || !resolveUploadPath(medication.photo_path)) return null;
  const expires = Math.floor(Date.now() / 1000) + 5 * 60;
  const payload = `${medication.id}:${medication.user_id}:${expires}:${medication.photo_path}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return `/api/medications/${medication.id}/photo-content?user=${medication.user_id}&expires=${expires}&signature=${signature}`;
}

function enrichMedication(medication) {
  const stats = calculateMedicationStats(medication);
  return { ...medication, ...stats, photo_url: createPhotoUrl(medication) };
}

function removePhotoFile(photoPath) {
  if (!photoPath) return;
  const fullPath = resolveUploadPath(photoPath);
  if (!fullPath) return;
  fs.unlink(fullPath, err => {
    if (err && err.code !== 'ENOENT') {
      console.error('Fehler beim Löschen des Fotos:', err);
    }
  });
}

async function validateImageFile(file) {
  if (!file) return true;
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const bytes = buffer.subarray(0, bytesRead);
    const valid =
      (file.mimetype === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
      (file.mimetype === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (file.mimetype === 'image/gif' && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) ||
      (file.mimetype === 'image/webp' && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP');
    return valid;
  } finally {
    await handle.close();
  }
}

async function getMedications(req, res) {
  const medications = await Medication.getAllByUser(req.user.id);
  const enriched = medications.map(enrichMedication);
  res.json({ medications: enriched });
}

async function getMedication(req, res) {
  const medication = await Medication.getById(req.params.id, req.user.id);
  if (!medication) {
    return res.status(404).json({ error: 'Medikament nicht gefunden' });
  }
  res.json({ medication: enrichMedication(medication) });
}

async function createMedication(req, res) {
  const photoPath = req.file ? toRelativeMedicationPath(req.file.filename) : null;
  const dailyDose = Number(req.body.dosage_morning || 0) + Number(req.body.dosage_noon || 0) + Number(req.body.dosage_evening || 0);
  const intervalDays = Number(req.body.interval_days || 1);
  const payload = {
    name: req.body.name,
    dosage_morning: Number(req.body.dosage_morning || 0),
    dosage_noon: Number(req.body.dosage_noon || 0),
    dosage_evening: Number(req.body.dosage_evening || 0),
    tablets_per_package: Number(req.body.tablets_per_package || 0),
    current_stock: Number(req.body.current_stock || 0),
    warning_threshold_days: Number(req.body.warning_threshold_days || 7),
    photo_path: photoPath,
    interval_days: intervalDays,
    dosage_per_interval: req.body.dosage_per_interval !== undefined
      ? Number(req.body.dosage_per_interval)
      : dailyDose,
    next_due_at: intervalDays > 1 ? (req.body.next_due_at || null) : null
  };

  if (req.file && !await validateImageFile(req.file)) {
    removePhotoFile(photoPath);
    return res.status(400).json({ error: 'Die hochgeladene Datei ist kein unterstütztes Bild' });
  }

  const errors = validateMedication(payload);
  if (errors.length) {
    removePhotoFile(photoPath);
    return res.status(400).json({ error: errors.join(', ') });
  }

  try {
    const medication = await Medication.createMedication(req.user.id, payload);
    res.status(201).json({ medication: enrichMedication(medication) });
  } catch (error) {
    removePhotoFile(photoPath);
    throw error;
  }
}

async function updateMedication(req, res) {
  const existing = await Medication.getById(req.params.id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Medikament nicht gefunden' });
  }

  const payload = { ...req.body };
  ['dosage_morning', 'dosage_noon', 'dosage_evening', 'tablets_per_package', 'warning_threshold_days', 'interval_days', 'dosage_per_interval'].forEach(field => {
    if (payload[field] !== undefined) {
      payload[field] = Number(payload[field]);
    }
  });

  delete payload.current_stock;
  const candidate = { ...existing, ...payload };
  if (candidate.interval_days === 1) {
    candidate.next_due_at = null;
    candidate.dosage_per_interval = candidate.dosage_morning + candidate.dosage_noon + candidate.dosage_evening;
    payload.next_due_at = null;
    payload.dosage_per_interval = candidate.dosage_per_interval;
  }
  const errors = validateMedication(candidate);
  if (errors.length) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  const updated = await Medication.updateMedication(req.params.id, req.user.id, payload);
  res.json({ medication: enrichMedication(updated) });
}

async function deleteMedication(req, res) {
  const existing = await Medication.getById(req.params.id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Medikament nicht gefunden' });
  }
  const deleted = await Medication.deleteMedication(req.params.id, req.user.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Medikament nicht gefunden' });
  }
  removePhotoFile(existing.photo_path);
  res.json({ message: 'Medikament gelöscht' });
}

async function updateStock(req, res) {
  const { action, amount } = req.body;
  if (!['add_package', 'set_stock'].includes(action)) {
    return res.status(400).json({ error: 'Unbekannte Aktion' });
  }
  if (amount !== undefined && (typeof amount !== 'number' || !Number.isFinite(amount))) {
    return res.status(400).json({ error: 'Ungültiger Bestand' });
  }

  const result = await withTransaction(async db => {
    const medication = await db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
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
      'UPDATE medications SET current_stock = ?, updated_at = CURRENT_TIMESTAMP, last_stock_measured_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [newStock, req.params.id, req.user.id]
    );
    const historyResult = await db.run(
      'INSERT INTO history (medication_id, user_id, action, old_stock, new_stock) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, req.user.id, action, medication.current_stock, newStock]
    );
    return {
      medication: await db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]),
      historyEntry: await db.get('SELECT * FROM history WHERE id = ? AND user_id = ?', [historyResult.lastID, req.user.id])
    };
  });

  if (!result) return res.status(404).json({ error: 'Medikament nicht gefunden' });

  res.json({
    medication: enrichMedication(result.medication),
    history_entry: result.historyEntry
  });
}

async function getHistory(req, res) {
  const medication = await Medication.getById(req.params.id, req.user.id);
  if (!medication) {
    return res.status(404).json({ error: 'Medikament nicht gefunden' });
  }

  const requestedLimit = Number(req.query.limit || 50);
  const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 200)) : 50;
  const history = await History.getHistoryByMedication(req.params.id, req.user.id, limit);
  res.json({ history });
}

async function uploadPhoto(req, res) {
  const medication = req.medication;

  if (!req.file) {
    return res.status(400).json({ error: 'Kein Foto hochgeladen' });
  }

  const photoPath = toRelativeMedicationPath(req.file.filename);
  if (!await validateImageFile(req.file)) {
    removePhotoFile(photoPath);
    return res.status(400).json({ error: 'Die hochgeladene Datei ist kein unterstütztes Bild' });
  }
  let updated;
  try {
    updated = await Medication.updatePhoto(req.params.id, req.user.id, photoPath);
  } catch (error) {
    removePhotoFile(photoPath);
    throw error;
  }
  removePhotoFile(medication.photo_path);
  res.json({ medication: enrichMedication(updated) });
}

async function requireMedication(req, res, next) {
  const medication = await Medication.getById(req.params.id, req.user.id);
  if (!medication) return res.status(404).json({ error: 'Medikament nicht gefunden' });
  req.medication = medication;
  next();
}

async function getPhotoContent(req, res) {
  const userId = Number(req.query.user);
  const expires = Number(req.query.expires);
  const signature = String(req.query.signature || '');
  if (!Number.isInteger(userId) || !Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) {
    return res.status(403).json({ error: 'Foto-Link ist ungültig oder abgelaufen' });
  }
  const medication = await Medication.getById(req.params.id, userId);
  if (!medication?.photo_path) return res.status(404).json({ error: 'Foto nicht gefunden' });
  const payload = `${medication.id}:${userId}:${expires}:${medication.photo_path}`;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(403).json({ error: 'Foto-Link ist ungültig oder abgelaufen' });
  }
  const fullPath = resolveUploadPath(medication.photo_path);
  if (!fullPath) return res.status(404).json({ error: 'Foto nicht gefunden' });
  res.set('Cache-Control', 'private, max-age=240');
  res.set('X-Content-Type-Options', 'nosniff');
  res.sendFile(fullPath);
}

async function deletePhoto(req, res) {
  const medication = await Medication.getById(req.params.id, req.user.id);
  if (!medication) {
    return res.status(404).json({ error: 'Medikament nicht gefunden' });
  }

  if (!medication.photo_path) {
    return res.status(400).json({ error: 'Kein Foto vorhanden' });
  }

  const updated = await Medication.updatePhoto(req.params.id, req.user.id, null);
  removePhotoFile(medication.photo_path);
  res.json({ medication: enrichMedication(updated) });
}

module.exports = {
  getMedications,
  getMedication,
  createMedication,
  updateMedication,
  deleteMedication,
  updateStock,
  getHistory,
  uploadPhoto,
  deletePhoto,
  requireMedication,
  getPhotoContent
};
