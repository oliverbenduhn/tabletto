const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tabletto-core-'));
process.env.DB_PATH = path.join(temporaryRoot, 'tabletto.db');
process.env.UPLOADS_PATH = path.join(temporaryRoot, 'uploads');
process.env.TZ = 'Europe/Berlin';
process.env.ENABLE_STOCK_SCHEDULER = 'false';

const { initDatabase, getDatabase, closeDatabase } = require('../src/config/database');
const { validateMedication } = require('../src/utils/validation');
const { calculateMedicationStats } = require('../src/utils/calculations');
const { resolveUploadPath } = require('../src/utils/uploads');
const {
  startStockScheduler,
  stopStockScheduler,
  runStockDeductionNow
} = require('../src/services/stockScheduler');

test.before(async () => {
  await initDatabase();
});

test.after(async () => {
  await closeDatabase();
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

test('Medikamentvalidierung weist nicht endliche und fachlich ungültige Werte ab', () => {
  const errors = validateMedication({
    name: 'Test',
    dosage_morning: Number.NaN,
    dosage_noon: 0,
    dosage_evening: 0,
    tablets_per_package: 1.5,
    current_stock: -1,
    warning_threshold_days: 999,
    interval_days: 7,
    dosage_per_interval: 1,
    next_due_at: null
  });
  assert.ok(errors.length >= 5);
  assert.ok(errors.some(error => error.includes('Nächste Einnahme')));
});

test('Uploadpfade können das Upload-Root nicht verlassen', () => {
  assert.equal(resolveUploadPath('../../tabletto.db'), null);
  assert.equal(resolveUploadPath('https://example.test/image.jpg'), null);
  assert.ok(resolveUploadPath('medications/example.jpg').startsWith(process.env.UPLOADS_PATH));
});

test('Nullverbrauch besitzt einen stabilen JSON-Vertrag', () => {
  const stats = calculateMedicationStats({
    dosage_morning: 0,
    dosage_noon: 0,
    dosage_evening: 0,
    dosage_per_interval: 0,
    interval_days: 1,
    current_stock: 10,
    warning_threshold_days: 7
  });
  assert.equal(stats.days_remaining, null);
  assert.doesNotThrow(() => JSON.stringify(stats));
});

test('Scheduler registriert das konfigurierte Cron-Pattern', () => {
  process.env.ENABLE_STOCK_SCHEDULER = 'true';
  process.env.STOCK_SCHEDULER_CRON = '0 0 1 1 *';

  try {
    assert.doesNotThrow(() => startStockScheduler());
  } finally {
    stopStockScheduler();
    process.env.ENABLE_STOCK_SCHEDULER = 'false';
    delete process.env.STOCK_SCHEDULER_CRON;
  }
});

test('Scheduler bucht denselben Slot idempotent und holt den Folgetag nach', async () => {
  const db = getDatabase();
  const user = await db.run(
    `INSERT INTO users (email, password_hash, dose_time_morning, dose_time_noon, dose_time_evening)
     VALUES ('scheduler@example.test', 'hash', '08:00', '12:00', '20:00')`
  );
  const medication = await db.run(
    `INSERT INTO medications (
       user_id, name, dosage_morning, dosage_noon, dosage_evening,
       tablets_per_package, current_stock, warning_threshold_days,
       interval_days, dosage_per_interval, next_due_at, created_at
     ) VALUES (?, 'Scheduler-Test', 1, 0, 0, 20, 10, 7, 1, 1, NULL, '2026-07-14 06:00:00')`,
    [user.lastID]
  );

  const firstRun = new Date('2026-07-15T08:30:00.000Z');
  await runStockDeductionNow(firstRun);
  await runStockDeductionNow(firstRun);
  let row = await db.get('SELECT current_stock FROM medications WHERE id = ?', [medication.lastID]);
  assert.equal(row.current_stock, 9);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM history WHERE medication_id = ?', [medication.lastID])).count, 1);

  await runStockDeductionNow(new Date('2026-07-16T08:30:00.000Z'));
  row = await db.get('SELECT current_stock FROM medications WHERE id = ?', [medication.lastID]);
  assert.equal(row.current_stock, 8);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM stock_deductions WHERE medication_id = ?', [medication.lastID])).count, 2);
});
