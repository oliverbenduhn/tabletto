const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db = null;

async function initDatabase() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/tabletto.db');

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA foreign_keys = ON');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      dashboard_view TEXT DEFAULT 'grid',
      calendar_view TEXT DEFAULT 'dayGridMonth',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      dosage_morning REAL NOT NULL DEFAULT 0,
      dosage_noon REAL NOT NULL DEFAULT 0,
      dosage_evening REAL NOT NULL DEFAULT 0,
      tablets_per_package INTEGER NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0,
      warning_threshold_days INTEGER NOT NULL DEFAULT 7,
      photo_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_stock_measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_medications_user ON medications(user_id);

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_stock REAL,
      new_stock REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_history_medication ON history(medication_id);
    CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id);
  `);

  // Migration: Add last_stock_measured_at column if it doesn't exist
  try {
    const tableInfo = await db.all("PRAGMA table_info(medications)");
    const hasLastStockMeasured = tableInfo.some(col => col.name === 'last_stock_measured_at');

    if (!hasLastStockMeasured) {
      console.log('Führe Migration aus: Füge last_stock_measured_at Spalte hinzu');
      // SQLite doesn't allow DEFAULT CURRENT_TIMESTAMP in ALTER TABLE, use a fixed timestamp
      await db.exec(`
        ALTER TABLE medications ADD COLUMN last_stock_measured_at DATETIME;
      `);
      // Set initial timestamp for existing medications
      await db.exec(`
        UPDATE medications SET last_stock_measured_at = CURRENT_TIMESTAMP WHERE last_stock_measured_at IS NULL;
      `);
      console.log('Migration erfolgreich abgeschlossen');
    }
  } catch (error) {
    console.error('Fehler bei der Migration (last_stock_measured_at):', error);
    // Don't fail initialization if migration fails
  }

  // Migration: Add dosage_noon column if it doesn't exist
  try {
    const tableInfo = await db.all("PRAGMA table_info(medications)");
    const hasDosageNoon = tableInfo.some(col => col.name === 'dosage_noon');

    if (!hasDosageNoon) {
      console.log('Führe Migration aus: Füge dosage_noon Spalte hinzu');
      await db.exec(`
        ALTER TABLE medications ADD COLUMN dosage_noon REAL NOT NULL DEFAULT 0;
      `);
      console.log('Migration dosage_noon erfolgreich abgeschlossen');
    }
  } catch (error) {
    console.error('Fehler bei der Migration (dosage_noon):', error);
    // Don't fail initialization if migration fails
  }

  // Migration: Add photo_path column if it doesn't exist
  try {
    const tableInfo = await db.all("PRAGMA table_info(medications)");
    const hasPhotoPath = tableInfo.some(col => col.name === 'photo_path');

    if (!hasPhotoPath) {
      console.log('Führe Migration aus: Füge photo_path Spalte hinzu');
      await db.exec(`
        ALTER TABLE medications ADD COLUMN photo_path TEXT;
      `);
      console.log('Migration photo_path erfolgreich abgeschlossen');
    }
  } catch (error) {
    console.error('Fehler bei der Migration (photo_path):', error);
    // Don't fail initialization if migration fails
  }

  // Migration: Add user preference columns if they don't exist
  try {
    const userTableInfo = await db.all("PRAGMA table_info(users)");
    const hasDashboardView = userTableInfo.some(col => col.name === 'dashboard_view');
    const hasCalendarView = userTableInfo.some(col => col.name === 'calendar_view');

    if (!hasDashboardView) {
      console.log('Führe Migration aus: Füge dashboard_view Spalte hinzu');
      await db.exec(`
        ALTER TABLE users ADD COLUMN dashboard_view TEXT DEFAULT 'grid';
      `);
      console.log('Migration dashboard_view erfolgreich abgeschlossen');
    }

    if (!hasCalendarView) {
      console.log('Führe Migration aus: Füge calendar_view Spalte hinzu');
      await db.exec(`
        ALTER TABLE users ADD COLUMN calendar_view TEXT DEFAULT 'dayGridMonth';
      `);
      console.log('Migration calendar_view erfolgreich abgeschlossen');
    }
  } catch (error) {
    console.error('Fehler bei der Migration (user preferences):', error);
    // Don't fail initialization if migration fails
  }

  // Migration: Add interval fields for unified interval system
  try {
    const tableInfo = await db.all("PRAGMA table_info(medications)");
    const hasIntervalDays = tableInfo.some(col => col.name === 'interval_days');
    const hasDosagePerInterval = tableInfo.some(col => col.name === 'dosage_per_interval');
    const hasNextDueAt = tableInfo.some(col => col.name === 'next_due_at');

    if (!hasIntervalDays) {
      console.log('Führe Migration aus: Füge interval_days Spalte hinzu');
      await db.run(`ALTER TABLE medications ADD COLUMN interval_days INTEGER DEFAULT 1`);
      console.log('Migration interval_days erfolgreich abgeschlossen');
    }

    if (!hasDosagePerInterval) {
      console.log('Führe Migration aus: Füge dosage_per_interval Spalte hinzu');
      await db.run(`ALTER TABLE medications ADD COLUMN dosage_per_interval REAL DEFAULT 0`);
      // Migrate existing medications: dosage_per_interval = sum of daily dosages
      await db.run(`
        UPDATE medications
        SET dosage_per_interval = dosage_morning + dosage_noon + dosage_evening
        WHERE dosage_per_interval = 0
      `);
      console.log('Migration dosage_per_interval erfolgreich abgeschlossen');
    }

    if (!hasNextDueAt) {
      console.log('Führe Migration aus: Füge next_due_at Spalte hinzu');
      await db.run(`ALTER TABLE medications ADD COLUMN next_due_at DATETIME`);
      // Set next_due_at to tomorrow for existing daily medications
      await db.run(`
        UPDATE medications
        SET next_due_at = datetime('now', '+1 day', 'start of day')
        WHERE next_due_at IS NULL AND interval_days = 1
      `);
      console.log('Migration next_due_at erfolgreich abgeschlossen');
    }
  } catch (error) {
    console.error('Fehler bei der Migration (interval fields):', error);
    // Don't fail initialization if migration fails
  }

  // Migration: Add dose time preferences
  try {
    const userTableInfo = await db.all("PRAGMA table_info(users)");
    const hasDoseTimeMorning = userTableInfo.some(col => col.name === 'dose_time_morning');
    const hasDoseTimeNoon = userTableInfo.some(col => col.name === 'dose_time_noon');
    const hasDoseTimeEvening = userTableInfo.some(col => col.name === 'dose_time_evening');

    if (!hasDoseTimeMorning) {
      console.log('Führe Migration aus: Füge dose_time_morning Spalte hinzu');
      await db.run(`ALTER TABLE users ADD COLUMN dose_time_morning TEXT DEFAULT '08:00'`);
      console.log('Migration dose_time_morning erfolgreich abgeschlossen');
    }

    if (!hasDoseTimeNoon) {
      console.log('Führe Migration aus: Füge dose_time_noon Spalte hinzu');
      await db.run(`ALTER TABLE users ADD COLUMN dose_time_noon TEXT DEFAULT '12:00'`);
      console.log('Migration dose_time_noon erfolgreich abgeschlossen');
    }

    if (!hasDoseTimeEvening) {
      console.log('Führe Migration aus: Füge dose_time_evening Spalte hinzu');
      await db.run(`ALTER TABLE users ADD COLUMN dose_time_evening TEXT DEFAULT '20:00'`);
      console.log('Migration dose_time_evening erfolgreich abgeschlossen');
    }
  } catch (error) {
    console.error('Fehler bei der Migration (dose times):', error);
    // Don't fail initialization if migration fails
  }

  console.log('Datenbank initialisiert');
  return db;
}

function getDatabase() {
  if (!db) {
    throw new Error('Datenbank nicht initialisiert');
  }
  return db;
}

module.exports = { initDatabase, getDatabase };
