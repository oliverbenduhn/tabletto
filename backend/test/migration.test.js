const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tabletto-migration-'));
process.env.DB_PATH = path.join(root, 'legacy.db');

test('bestehendes Minimalschema wird idempotent auf den aktuellen Stand migriert', async () => {
  const legacy = await open({ filename: process.env.DB_PATH, driver: sqlite3.Database });
  await legacy.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );
    CREATE TABLE medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      dosage_morning REAL NOT NULL DEFAULT 0,
      dosage_evening REAL NOT NULL DEFAULT 0,
      tablets_per_package INTEGER NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0,
      warning_threshold_days INTEGER NOT NULL DEFAULT 7,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_stock REAL,
      new_stock REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await legacy.close();

  const { initDatabase, getDatabase, closeDatabase } = require('../src/config/database');
  await initDatabase();
  await closeDatabase();
  await initDatabase();
  const medicationColumns = new Set((await getDatabase().all('PRAGMA table_info(medications)')).map(column => column.name));
  const userColumns = new Set((await getDatabase().all('PRAGMA table_info(users)')).map(column => column.name));
  assert.ok(['dosage_noon', 'photo_path', 'last_stock_measured_at', 'interval_days', 'dosage_per_interval', 'next_due_at', 'last_notified_status'].every(column => medicationColumns.has(column)));
  assert.ok(['dashboard_view', 'calendar_view', 'dose_time_morning', 'dose_time_noon', 'dose_time_evening', 'notification_weekly_enabled', 'notification_status_enabled'].every(column => userColumns.has(column)));
  assert.ok(await getDatabase().get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'stock_deductions'"));
  await closeDatabase();
  fs.rmSync(root, { recursive: true, force: true });
});
