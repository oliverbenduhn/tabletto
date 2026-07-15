const { getDatabase, withTransaction } = require('../config/database');
const { validateMedication } = require('../utils/validation');
const { resolveUploadPath } = require('../utils/uploads');
const fs = require('fs');

const EXPORT_VERSION = '2.0.0';
const HISTORY_ACTIONS = new Set([
  'add_package',
  'set_stock',
  'manual_correction',
  'auto_deduction_morning',
  'auto_deduction_noon',
  'auto_deduction_evening',
  'auto_deduction_interval'
]);

function normalizeMedication(raw) {
  const intervalDays = Number(raw?.interval_days ?? 1);
  const morning = Number(raw?.dosage_morning ?? 0);
  const noon = Number(raw?.dosage_noon ?? 0);
  const evening = Number(raw?.dosage_evening ?? 0);
  return {
    sourceId: raw?.id,
    name: typeof raw?.name === 'string' ? raw.name.trim() : '',
    dosage_morning: morning,
    dosage_noon: noon,
    dosage_evening: evening,
    tablets_per_package: Number(raw?.tablets_per_package ?? 0),
    current_stock: Number(raw?.current_stock ?? 0),
    warning_threshold_days: Number(raw?.warning_threshold_days ?? 7),
    interval_days: intervalDays,
    dosage_per_interval: Number(raw?.dosage_per_interval ?? (morning + noon + evening)),
    next_due_at: intervalDays > 1 ? (raw?.next_due_at || null) : null,
    created_at: raw?.created_at || null,
    updated_at: raw?.updated_at || null,
    last_stock_measured_at: raw?.last_stock_measured_at || null
  };
}

function validateImport(data) {
  if (!data || !Array.isArray(data.medications) || !Array.isArray(data.history ?? [])) {
    return { error: 'Importdatei enthält nicht die erwartete Struktur' };
  }
  if (data.version && !['1.0.5', EXPORT_VERSION].includes(data.version)) {
    return { error: `Nicht unterstützte Exportversion: ${data.version}` };
  }
  if (data.medications.length > 10000 || (data.history?.length || 0) > 200000) {
    return { error: 'Importdatei überschreitet die zulässige Größe' };
  }

  const medications = data.medications.map(normalizeMedication);
  for (let index = 0; index < medications.length; index++) {
    const errors = validateMedication(medications[index]);
    if (errors.length) {
      return { error: `Medikament ${index + 1}: ${errors.join(', ')}` };
    }
  }

  for (let index = 0; index < (data.history || []).length; index++) {
    const entry = data.history[index];
    if (!HISTORY_ACTIONS.has(entry?.action) || !Number.isFinite(Number(entry.old_stock)) || !Number.isFinite(Number(entry.new_stock))) {
      return { error: `Historieneintrag ${index + 1} ist ungültig` };
    }
  }
  return { medications, history: data.history || [] };
}

async function exportData(req, res) {
  const userId = req.user.id;
  const db = getDatabase();
  const user = await db.get('SELECT email, created_at, last_login FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

  const medications = await db.all(
    `SELECT id, name, dosage_morning, dosage_noon, dosage_evening,
            tablets_per_package, current_stock, warning_threshold_days,
            interval_days, dosage_per_interval, next_due_at,
            created_at, updated_at, last_stock_measured_at
     FROM medications WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  const history = await db.all(
    `SELECT h.medication_id, h.action, h.old_stock, h.new_stock, h.timestamp,
            m.name AS medication_name
     FROM history h
     JOIN medications m ON m.id = h.medication_id AND m.user_id = h.user_id
     WHERE h.user_id = ? ORDER BY h.timestamp DESC`,
    [userId]
  );

  res.json({
    success: true,
    data: {
      version: EXPORT_VERSION,
      exportDate: new Date().toISOString(),
      user,
      medications,
      history
    }
  });
}

async function importData(req, res) {
  const userId = req.user.id;
  const validation = validateImport(req.body?.data);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const oldPhotoPaths = await getDatabase().all(
    'SELECT photo_path FROM medications WHERE user_id = ? AND photo_path IS NOT NULL',
    [userId]
  );

  const imported = await withTransaction(async db => {
    await db.run('DELETE FROM medications WHERE user_id = ?', [userId]);
    const idMap = new Map();
    const uniqueNameMap = new Map();
    const duplicateNames = new Set();
    const fallbackTimestamp = new Date().toISOString();

    for (const medication of validation.medications) {
      const result = await db.run(
        `INSERT INTO medications (
          user_id, name, dosage_morning, dosage_noon, dosage_evening,
          tablets_per_package, current_stock, warning_threshold_days, photo_path,
          interval_days, dosage_per_interval, next_due_at,
          created_at, updated_at, last_stock_measured_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          medication.name,
          medication.dosage_morning,
          medication.dosage_noon,
          medication.dosage_evening,
          medication.tablets_per_package,
          medication.current_stock,
          medication.warning_threshold_days,
          medication.interval_days,
          medication.dosage_per_interval,
          medication.next_due_at,
          medication.created_at || fallbackTimestamp,
          medication.updated_at || fallbackTimestamp,
          medication.last_stock_measured_at || medication.updated_at || fallbackTimestamp
        ]
      );
      if (medication.sourceId !== undefined && medication.sourceId !== null) {
        idMap.set(medication.sourceId, result.lastID);
      }
      if (uniqueNameMap.has(medication.name)) duplicateNames.add(medication.name);
      else uniqueNameMap.set(medication.name, result.lastID);
    }

    let historyCount = 0;
    for (const entry of validation.history) {
      const mappedByName = entry.medication_name && !duplicateNames.has(entry.medication_name)
        ? uniqueNameMap.get(entry.medication_name)
        : null;
      const medicationId = idMap.get(entry.medication_id) || mappedByName;
      if (!medicationId) {
        throw Object.assign(new Error('Historieneintrag kann keinem Medikament eindeutig zugeordnet werden'), { status: 400 });
      }
      await db.run(
        `INSERT INTO history (medication_id, user_id, action, old_stock, new_stock, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [medicationId, userId, entry.action, Number(entry.old_stock), Number(entry.new_stock), entry.timestamp || fallbackTimestamp]
      );
      historyCount++;
    }
    return { medications: validation.medications.length, history: historyCount };
  });

  for (const { photo_path: photoPath } of oldPhotoPaths) {
    const fullPath = resolveUploadPath(photoPath);
    if (fullPath) fs.promises.unlink(fullPath).catch(error => {
      if (error.code !== 'ENOENT') console.error('Veraltetes Importfoto konnte nicht gelöscht werden:', error);
    });
  }

  res.json({ success: true, message: 'Daten erfolgreich importiert', imported });
}

module.exports = { exportData, importData, validateImport };
