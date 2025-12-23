const Medication = require('../models/Medication');
const History = require('../models/History');
const { calculateMedicationStats } = require('../utils/calculations');
const { validateMedication } = require('../utils/validation');
const fs = require('fs');
const {
  buildUploadUrl,
  resolveUploadPath,
  toRelativeMedicationPath
} = require('../utils/uploads');

function enrichMedication(medication) {
  const stats = calculateMedicationStats(medication);
  return { ...medication, ...stats, photo_url: buildUploadUrl(medication.photo_path) };
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
  const payload = {
    name: req.body.name,
    dosage_morning: Number(req.body.dosage_morning || 0),
    dosage_noon: Number(req.body.dosage_noon || 0),
    dosage_evening: Number(req.body.dosage_evening || 0),
    tablets_per_package: Number(req.body.tablets_per_package || 0),
    current_stock: Number(req.body.current_stock || 0),
    warning_threshold_days: Number(req.body.warning_threshold_days || 7),
    photo_path: photoPath
  };

  const errors = validateMedication(payload);
  if (errors.length) {
    removePhotoFile(photoPath);
    return res.status(400).json({ error: errors.join(', ') });
  }

  const medication = await Medication.createMedication(req.user.id, payload);
  res.status(201).json({ medication: enrichMedication(medication) });
}

async function updateMedication(req, res) {
  const existing = await Medication.getById(req.params.id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Medikament nicht gefunden' });
  }

  const payload = { ...req.body };
  ['dosage_morning', 'dosage_noon', 'dosage_evening', 'tablets_per_package', 'current_stock', 'warning_threshold_days'].forEach(field => {
    if (payload[field] !== undefined) {
      payload[field] = Number(payload[field]);
    }
  });

  if (payload.name === '') {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }

  const updated = await Medication.updateMedication(req.params.id, req.user.id, payload);
  res.json({ medication: enrichMedication(updated) });
}

async function deleteMedication(req, res) {
  const existing = await Medication.getById(req.params.id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Medikament nicht gefunden' });
  }
  removePhotoFile(existing.photo_path);
  const deleted = await Medication.deleteMedication(req.params.id, req.user.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Medikament nicht gefunden' });
  }
  res.json({ message: 'Medikament gelöscht' });
}

async function updateStock(req, res) {
  const medication = await Medication.getById(req.params.id, req.user.id);
  if (!medication) {
    return res.status(404).json({ error: 'Medikament nicht gefunden' });
  }

  const { action, amount } = req.body;
  let newStock = medication.current_stock;

  if (action === 'add_package') {
    let packageSize = null;
    if (typeof amount === 'number' && Number.isFinite(amount)) {
      packageSize = amount;
    } else if (medication.tablets_per_package > 0) {
      packageSize = medication.tablets_per_package;
    }

    if (packageSize === null || packageSize <= 0) {
      return res.status(400).json({ error: 'Packungsgröße muss größer als 0 sein' });
    }
    newStock = medication.current_stock + packageSize;
  } else if (action === 'set_stock') {
    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ error: 'Ungültiger Bestand' });
    }
    newStock = amount;
  } else {
    return res.status(400).json({ error: 'Unbekannte Aktion' });
  }

  const updatedMedication = await Medication.updateStock(req.params.id, req.user.id, newStock);
  const historyEntry = await History.createHistoryEntry({
    medicationId: req.params.id,
    userId: req.user.id,
    action,
    oldStock: medication.current_stock,
    newStock
  });

  res.json({
    medication: enrichMedication(updatedMedication),
    history_entry: historyEntry
  });
}

async function getHistory(req, res) {
  const medication = await Medication.getById(req.params.id, req.user.id);
  if (!medication) {
    return res.status(404).json({ error: 'Medikament nicht gefunden' });
  }

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const history = await History.getHistoryByMedication(req.params.id, req.user.id, limit);
  res.json({ history });
}

async function uploadPhoto(req, res) {
  const medication = await Medication.getById(req.params.id, req.user.id);
  if (!medication) {
    return res.status(404).json({ error: 'Medikament nicht gefunden' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Kein Foto hochgeladen' });
  }

  const photoPath = toRelativeMedicationPath(req.file.filename);
  const updated = await Medication.updatePhoto(req.params.id, req.user.id, photoPath);
  removePhotoFile(medication.photo_path);
  res.json({ medication: enrichMedication(updated) });
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
  deletePhoto
};
