const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tabletto-audit-'));
process.env.DB_PATH = path.join(root, 'test.db');
process.env.UPLOADS_PATH = path.join(root, 'uploads');
process.env.TZ = 'Europe/Berlin';
process.env.JWT_SECRET = 'synthetic-test-secret';
const database = require('../src/config/database');
const data = require('../src/controllers/dataController');
const { calculateMedicationStats } = require('../src/utils/calculations');
const { runStockDeductionNow } = require('../src/services/stockScheduler');
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; } };
}
const base = { id: 1, name: 'Synthetic', dosage_morning: 1, dosage_noon: 0, dosage_evening: 0, tablets_per_package: 20, current_stock: 10, warning_threshold_days: 7, interval_days: 1, dosage_per_interval: 1 };
test.before(async () => { await database.initDatabase(); });
test.after(async () => { await database.closeDatabase(); fs.rmSync(root, { recursive: true, force: true }); });
test.beforeEach(async () => { await database.getDatabase().run('DELETE FROM users'); });
async function seed() {
  const db = database.getDatabase();
  const user = await db.run("INSERT INTO users(email,password_hash) VALUES('synthetic@example.test','fake')");
  await db.run("INSERT INTO medications(user_id,name,dosage_morning,tablets_per_package,current_stock,dosage_per_interval,created_at) VALUES(?,'Synthetic',1,20,10,1,'2026-10-20 00:00:00')", [user.lastID]);
  return { id: user.lastID };
}
test('H01: Export/Import erhält Abzugsmarker und Bestand beim gleichen Tick', async () => {
  const user = await seed();
  const now = new Date('2026-10-25T09:00:00Z');
  await runStockDeductionNow(now);
  const exported = response();
  await data.exportData({ user }, exported);
  const imported = response();
  await data.importData({ user, body: { data: exported.body.data } }, imported);
  assert.equal(imported.statusCode, 200);
  await runStockDeductionNow(now);
  assert.equal((await database.getDatabase().get('SELECT current_stock FROM medications')).current_stock, 9);
});
test('H02: Archive dürfen vergangene Intervalltermine enthalten', () => {
  assert.equal(data.validateImport({ medications: [{ ...base, interval_days: 7, next_due_at: '2026-01-01T12:00:00' }], history: [] }).error, undefined);
});
test('H03/H05: Nullbestand und tägliche Dosierung haben eine einzige Wahrheit', () => {
  assert.equal(calculateMedicationStats({ ...base, interval_days: 30, current_stock: 0, next_due_at: '2026-11-01T12:00:00' }).days_remaining, 0);
  assert.equal(calculateMedicationStats({ ...base, dosage_per_interval: 0 }).days_remaining, 10);
});
test('M04: Beschädigte Zeitstempel und doppelte Quell-IDs werden abgewiesen', () => {
  assert.ok(data.validateImport({ medications: [{ ...base, created_at: 'broken' }], history: [] }).error);
  assert.ok(data.validateImport({ medications: [base, { ...base, id: '1' }], history: [] }).error);
});

test('H04: Ist-Messung schützt vor Abzügen aus der Ausfallzeit', async () => {
  const user = await seed();
  await runStockDeductionNow(new Date('2026-10-21T09:00:00Z'));
  await database.getDatabase().run("UPDATE medications SET current_stock = 20, scheduler_anchor_at = '2026-10-25T09:00:00Z'");
  await runStockDeductionNow(new Date('2026-10-25T10:00:00Z'));
  assert.equal((await database.getDatabase().get('SELECT current_stock FROM medications WHERE user_id = ?', [user.id])).current_stock, 20);
  await runStockDeductionNow(new Date('2026-10-26T10:00:00Z'));
  assert.equal((await database.getDatabase().get('SELECT current_stock FROM medications WHERE user_id = ?', [user.id])).current_stock, 19);
});
test('H04: Planänderung rechnet die Ausfallzeit noch mit dem alten Plan ab', async () => {
  const user = await seed();
  await runStockDeductionNow(new Date('2026-10-21T09:00:00Z'));
  const Medication = require('../src/models/Medication');
  const med = await database.getDatabase().get('SELECT * FROM medications');
  await Medication.updateMedication(med.id, user.id, { dosage_morning: 2 }, new Date('2026-10-23T09:00:00Z'));
  assert.equal((await Medication.getById(med.id, user.id)).current_stock, 7);
  await runStockDeductionNow(new Date('2026-10-24T09:00:00Z'));
  assert.equal((await Medication.getById(med.id, user.id)).current_stock, 5);
});
test('H06: SMTP-Fehler bleibt wiederholbar; parallele Aufrufe senden nur einmal', async () => {
  process.env.SMTP_HOST = 'synthetic'; process.env.SMTP_FROM = 'test@example.test';
  const user = await seed();
  await database.getDatabase().run('UPDATE users SET notification_status_enabled = 1');
  await database.getDatabase().run('UPDATE medications SET current_stock = 1');
  const { runStatusDetectionNow } = require('../src/services/notificationScheduler');
  await runStatusDetectionNow({ send: async () => ({ error: 'synthetic failure' }) });
  assert.equal((await database.getDatabase().get('SELECT last_notified_status FROM medications')).last_notified_status, null);
  let sends = 0;
  await Promise.all(Array.from({ length: 4 }, () => runStatusDetectionNow({ send: async () => { sends++; return {}; } })));
  assert.equal(sends, 1);
  assert.equal((await database.getDatabase().get('SELECT last_notified_status FROM medications WHERE user_id = ?', [user.id])).last_notified_status, 'critical');
  delete process.env.SMTP_HOST; delete process.env.SMTP_FROM;
});
test('H07: Reads warten auf Rollback und sehen keinen Zwischenstand', async () => {
  await seed();
  let release, entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  const write = database.withTransaction(async db => {
    await db.run('UPDATE medications SET current_stock = 99'); entered(); await barrier;
    throw new Error('synthetic rollback');
  });
  await ready;
  const read = database.getDatabase().get('SELECT current_stock FROM medications');
  release();
  await assert.rejects(write, /synthetic rollback/);
  assert.equal((await read).current_stock, 10);
});
test('M05: Gleichzeitige Fotoaustausche liefern den wirklich ersetzten Pfad', async () => {
  const user = await seed();
  const med = await database.getDatabase().get('SELECT id FROM medications');
  const Medication = require('../src/models/Medication');
  const [first, second] = await Promise.all([
    Medication.updatePhoto(med.id, user.id, 'medications/a.png'),
    Medication.updatePhoto(med.id, user.id, 'medications/b.png')
  ]);
  assert.equal(first.oldPhotoPath, null);
  assert.equal(second.oldPhotoPath, 'medications/a.png');
});
test('H08/M13: Backup kopiert Snapshot und referenzierte Fotos; fehlendes Foto scheitert', async () => {
  await seed();
  fs.mkdirSync(path.join(root, 'uploads/medications'), { recursive: true });
  fs.writeFileSync(path.join(root, 'uploads/medications/photo.png'), 'synthetic');
  await database.getDatabase().run("UPDATE medications SET photo_path = 'medications/photo.png'");
  const { createBackup } = require('../scripts/backup');
  const backup = await createBackup();
  assert.equal(fs.readFileSync(path.join(backup, 'uploads/medications/photo.png'), 'utf8'), 'synthetic');
  fs.unlinkSync(path.join(root, 'uploads/medications/photo.png'));
  await assert.rejects(createBackup(), /ENOENT/);
  assert.equal(fs.readdirSync(path.join(root, 'backups')).filter(name => name.endsWith('.tmp')).length, 0);
});

test('M04: Import-Rollback erhält Medikament, Historie und Abzugsmarker', async () => {
  const user = await seed();
  await runStockDeductionNow(new Date('2026-10-25T09:00:00Z'));
  const original = await database.getDatabase().get('SELECT * FROM medications');
  const exported = response(); await data.exportData({ user }, exported);
  exported.body.data.medications[0].name = 'Must roll back';
  await database.getDatabase().exec(`CREATE TRIGGER audit_fail BEFORE INSERT ON medications
    WHEN NEW.name = 'Must roll back' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END`);
  try {
    await assert.rejects(data.importData({ user, body: { data: exported.body.data } }, response()), /synthetic failure/);
    assert.equal((await database.getDatabase().get('SELECT id FROM medications')).id, original.id);
    assert.equal((await database.getDatabase().get('SELECT COUNT(*) AS n FROM history')).n, 1);
    assert.equal((await database.getDatabase().get('SELECT COUNT(*) AS n FROM stock_deductions')).n, 1);
  } finally { await database.getDatabase().exec('DROP TRIGGER audit_fail'); }
});
test('H01: Legacy-Export startet ab seinem Exportanker statt erneut abzubuchen', async () => {
  const user = await seed();
  const imported = response();
  await data.importData({ user, body: { data: { version: '2.0.0', exportDate: '2026-10-25T09:00:00Z', medications: [{ ...base, current_stock: 9, created_at: '2026-10-20 00:00:00' }], history: [] } } }, imported);
  await runStockDeductionNow(new Date('2026-10-25T10:00:00Z'));
  assert.equal((await database.getDatabase().get('SELECT current_stock FROM medications')).current_stock, 9);
  await runStockDeductionNow(new Date('2026-10-26T10:00:00Z'));
  assert.equal((await database.getDatabase().get('SELECT current_stock FROM medications')).current_stock, 8);
});
test('H03: Intervallreichweite zählt Kalendertage über die Zeitumstellung', () => {
  const med = { ...base, interval_days: 7, next_due_at: '2026-10-26T12:00:00', current_stock: 1 };
  assert.equal(calculateMedicationStats(med, new Date('2026-10-24T22:30:00Z')).days_remaining, 1);
  assert.equal(calculateMedicationStats({ ...med, current_stock: 0.5 }, new Date('2026-10-24T22:30:00Z')).days_remaining, 0);
});
test('M05: Verwaiste Datei wird gelöscht; referenzierte Datei bleibt erhalten', async () => {
  await seed();
  const photo = 'medications/current.png';
  const full = path.join(root, 'uploads', photo);
  fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, 'synthetic');
  const { removeUnreferencedPhoto } = require('../src/utils/photoCleanup');
  await database.getDatabase().run('UPDATE medications SET photo_path = ?', [photo]);
  await removeUnreferencedPhoto(photo); assert.ok(fs.existsSync(full));
  await database.getDatabase().run('UPDATE medications SET photo_path = NULL');
  await removeUnreferencedPhoto(photo); assert.equal(fs.existsSync(full), false);
});
test('M13: Backup sperrt Fotoaustausch bis nach der Fotokopie, auch mit WAL', async () => {
  const user = await seed();
  await database.getDatabase().exec('PRAGMA journal_mode = WAL');
  const photo = 'medications/locked.png';
  fs.mkdirSync(path.join(root, 'uploads/medications'), { recursive: true });
  fs.writeFileSync(path.join(root, 'uploads', photo), 'before replacement');
  await database.getDatabase().run('UPDATE medications SET photo_path = ?', [photo]);
  const med = await database.getDatabase().get('SELECT id FROM medications');
  let copyEntered, releaseCopy;
  const copying = new Promise(resolve => { copyEntered = resolve; });
  const barrier = new Promise(resolve => { releaseCopy = resolve; });
  const originalCopy = fs.promises.copyFile;
  fs.promises.copyFile = async (...args) => { copyEntered(); await barrier; return originalCopy(...args); };
  const { createBackup } = require('../scripts/backup');
  let mutationDone = false;
  let backup;
  try {
    const saving = createBackup();
    await copying;
    const changing = require('../src/models/Medication').updatePhoto(med.id, user.id, null).then(result => { mutationDone = true; return result; });
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(mutationDone, false, 'Fotoaustausch darf die Sicherung nicht überholen');
    releaseCopy();
    backup = await saving;
    await changing;
  } finally { releaseCopy(); fs.promises.copyFile = originalCopy; }
  assert.equal(fs.readFileSync(path.join(backup, 'uploads', photo), 'utf8'), 'before replacement');
  const { open } = require('sqlite');
  const restored = await open({ filename: path.join(backup, 'tabletto.db'), driver: require('sqlite3').Database });
  try {
    assert.equal((await restored.get('SELECT photo_path FROM medications')).photo_path, photo);
    assert.equal((await restored.get('PRAGMA integrity_check')).integrity_check, 'ok');
  } finally { await restored.close(); }
});
