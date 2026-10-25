const { withTransaction, enqueueWrite } = require('../config/database');
const { validateMedication } = require('../utils/validation');
const { parseTimestamp, validCalendarDate } = require('../utils/dates');
const { removeUnreferencedPhoto } = require('../utils/photoCleanup');

const EXPORT_VERSION = '2.1.0';
const HISTORY_ACTIONS = new Set(['add_package', 'set_stock', 'manual_correction',
  'auto_deduction_morning', 'auto_deduction_noon', 'auto_deduction_evening', 'auto_deduction_interval']);
const SLOTS = new Set(['morning', 'noon', 'evening', 'interval']);
const validId = value => (typeof value === 'number' || typeof value === 'string') && /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
function validTimestamp(value) {
  return typeof value === 'string' && validCalendarDate(value) && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value) && !Number.isNaN(parseTimestamp(value).getTime());
}
function normalizeMedication(raw) {
  const interval = Number(raw?.interval_days ?? 1);
  const morning = Number(raw?.dosage_morning ?? 0), noon = Number(raw?.dosage_noon ?? 0), evening = Number(raw?.dosage_evening ?? 0);
  return {
    sourceId: raw?.id == null ? null : Number(raw.id), name: typeof raw?.name === 'string' ? raw.name.trim() : '',
    dosage_morning: morning, dosage_noon: noon, dosage_evening: evening,
    tablets_per_package: Number(raw?.tablets_per_package ?? 0), current_stock: Number(raw?.current_stock ?? 0),
    warning_threshold_days: Number(raw?.warning_threshold_days ?? 7), interval_days: interval,
    dosage_per_interval: interval === 1 ? morning + noon + evening : Number(raw?.dosage_per_interval ?? 0),
    next_due_at: interval > 1 ? raw?.next_due_at || null : null,
    created_at: raw?.created_at || null, updated_at: raw?.updated_at || null,
    last_stock_measured_at: raw?.last_stock_measured_at || null, scheduler_anchor_at: raw?.scheduler_anchor_at || null
  };
}
/** Validates an archive and resolves references before any destructive Replace. */
function validateImport(data) {
  const fail = error => ({ error });
  if (!data || !Array.isArray(data.medications) || !Array.isArray(data.history ?? []) || !Array.isArray(data.stock_deductions ?? [])) return fail('Importdatei enthält nicht die erwartete Struktur');
  if (data.version && !['1.0.5', '2.0.0', EXPORT_VERSION].includes(data.version)) return fail('Nicht unterstützte Exportversion');
  if (data.medications.length > 10000 || (data.history?.length || 0) > 200000 || (data.stock_deductions?.length || 0) > 200000) return fail('Importdatei überschreitet die zulässige Größe');
  if (data.version === EXPORT_VERSION && !Array.isArray(data.stock_deductions)) return fail('Abzugsmarker fehlen im Export');
  if (data.exportDate != null && !validTimestamp(data.exportDate)) return fail('Ungültiges Exportdatum');
  const ids = new Set();
  const medications = [];
  for (const raw of data.medications) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Ungültiges Medikament');
    if (raw.id != null && (!validId(raw.id) || ids.has(Number(raw.id)))) return fail('Medikament-IDs müssen eindeutig sein');
    if (raw.id != null) ids.add(Number(raw.id));
    for (const field of ['created_at', 'updated_at', 'last_stock_measured_at', 'scheduler_anchor_at']) {
      if (raw[field] != null && !validTimestamp(raw[field])) return fail(`Ungültiger Zeitstempel: ${field}`);
    }
    const med = normalizeMedication(raw);
    const errors = validateMedication(med, { archive: true });
    if (errors.length) return fail(`Medikament ${medications.length + 1}: ${errors.join(', ')}`);
    medications.push(med);
  }
  const uniqueNames = new Map();
  for (let index = 0; index < medications.length; index++) {
    const med = medications[index];
    uniqueNames.set(med.name, uniqueNames.has(med.name) ? null : index);
  }
  const indexById = new Map(medications.map((med, index) => [med.sourceId, index]));
  const medicationIndex = entry => {
    if (entry.medication_id != null) return validId(entry.medication_id) ? (indexById.get(Number(entry.medication_id)) ?? -1) : -1;
    return uniqueNames.get(entry.medication_name) ?? -1;
  };
  const history = [];
  for (const entry of data.history || []) {
    if (!entry || !HISTORY_ACTIONS.has(entry.action) || ![entry.old_stock, entry.new_stock].every(v => (typeof v === 'number' || typeof v === 'string') && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10000) || (entry.timestamp != null && !validTimestamp(entry.timestamp))) return fail('Ungültiger Historieneintrag');
    const index = medicationIndex(entry);
    if (index < 0) return fail('Historieneintrag kann keinem Medikament eindeutig zugeordnet werden');
    history.push({ ...entry, index });
  }
  const deductions = [];
  const deductionKeys = new Set();
  for (const entry of data.stock_deductions || []) {
    const index = entry && medicationIndex(entry);
    if (!entry || index < 0 || !SLOTS.has(entry.slot) || !/^\d{4}-\d{2}-\d{2}$/.test(entry.scheduled_for) || !validCalendarDate(entry.scheduled_for)) return fail('Ungültiger Abzugsmarker');
    const key = `${index}:${entry.slot}:${entry.scheduled_for}`;
    if (deductionKeys.has(key)) return fail('Doppelter Abzugsmarker');
    deductionKeys.add(key);
    deductions.push({ ...entry, index });
  }
  return { medications, history, deductions, legacy: data.version !== EXPORT_VERSION, exportDate: data.exportDate };
}
async function exportData(req, res) {
  const result = await enqueueWrite(async db => {
    const user = await db.get('SELECT email, created_at, last_login FROM users WHERE id = ?', [req.user.id]);
    if (!user) return null;
    const medications = await db.all(`SELECT id, name, dosage_morning, dosage_noon, dosage_evening,
      tablets_per_package, current_stock, warning_threshold_days, interval_days, dosage_per_interval, next_due_at,
      created_at, updated_at, last_stock_measured_at, scheduler_anchor_at FROM medications WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id]);
    const history = await db.all(`SELECT h.medication_id, h.action, h.old_stock, h.new_stock, h.timestamp, m.name AS medication_name
      FROM history h JOIN medications m ON m.id = h.medication_id AND m.user_id = h.user_id WHERE h.user_id = ? ORDER BY h.timestamp DESC, h.id DESC`, [req.user.id]);
    const stock_deductions = await db.all('SELECT medication_id, slot, scheduled_for FROM stock_deductions WHERE user_id = ?', [req.user.id]);
    return { version: EXPORT_VERSION, exportDate: new Date().toISOString(), user, medications, history, stock_deductions };
  });
  if (!result) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  res.json({ success: true, data: result });
}
async function importData(req, res) {
  const validation = validateImport(req.body?.data);
  if (validation.error) return res.status(400).json({ error: validation.error });
  const result = await withTransaction(async db => {
    const userId = req.user.id;
    const photos = await db.all('SELECT photo_path FROM medications WHERE user_id = ? AND photo_path IS NOT NULL', [userId]);
    await db.run('DELETE FROM medications WHERE user_id = ?', [userId]);
    const ids = [];
    const now = new Date().toISOString();
    for (const med of validation.medications) {
      // Legacy exports have no cursor. Treat their export time as a measurement;
      // files without one start at restore time, avoiding guessed double debits.
      const anchor = validation.legacy ? validation.exportDate || now : med.scheduler_anchor_at;
      const inserted = await db.run(`INSERT INTO medications(user_id,name,dosage_morning,dosage_noon,dosage_evening,
        tablets_per_package,current_stock,warning_threshold_days,interval_days,dosage_per_interval,next_due_at,
        created_at,updated_at,last_stock_measured_at,scheduler_anchor_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [userId, med.name, med.dosage_morning, med.dosage_noon, med.dosage_evening, med.tablets_per_package,
        med.current_stock, med.warning_threshold_days, med.interval_days, med.dosage_per_interval, med.next_due_at,
        med.created_at || now, med.updated_at || now, med.last_stock_measured_at || now, anchor]);
      ids.push(inserted.lastID);
    }
    for (const entry of validation.history) await db.run(`INSERT INTO history(medication_id,user_id,action,old_stock,new_stock,timestamp)
      VALUES(?,?,?,?,?,?)`, [ids[entry.index], userId, entry.action, Number(entry.old_stock), Number(entry.new_stock), entry.timestamp || now]);
    for (const entry of validation.deductions) await db.run('INSERT INTO stock_deductions(medication_id,user_id,slot,scheduled_for) VALUES(?,?,?,?)', [ids[entry.index], userId, entry.slot, entry.scheduled_for]);
    return { photos, imported: { medications: ids.length, history: validation.history.length } };
  });
  for (const photo of result.photos) await removeUnreferencedPhoto(photo.photo_path);
  res.json({ success: true, message: 'Daten erfolgreich importiert', imported: result.imported });
}
module.exports = { exportData, importData, validateImport };
