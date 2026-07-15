const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function createBackup() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/tabletto.db');
  const uploadsPath = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');
  if (!fs.existsSync(dbPath)) throw new Error(`Datenbank nicht gefunden: ${dbPath}`);

  const backupsDir = path.join(path.dirname(dbPath), 'backups');
  await fs.promises.mkdir(backupsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(backupsDir, `backup-${timestamp}`);
  const temporaryDir = `${backupDir}.tmp`;
  await fs.promises.mkdir(temporaryDir);
  const destination = path.join(temporaryDir, 'tabletto.db');

  try {
    const db = await open({ filename: dbPath, driver: sqlite3.Database });
    try {
      // VACUUM INTO creates a consistent standalone snapshot even while the source
      // database is using WAL or has concurrent readers.
      const escapedDestination = destination.replace(/'/g, "''");
      await db.exec(`VACUUM INTO '${escapedDestination}'`);
    } finally {
      await db.close();
    }

    const snapshot = await open({ filename: destination, driver: sqlite3.Database });
    try {
      const integrity = await snapshot.get('PRAGMA integrity_check');
      if (integrity.integrity_check !== 'ok') {
        throw new Error(`Integritätsprüfung fehlgeschlagen: ${integrity.integrity_check}`);
      }
    } finally {
      await snapshot.close();
    }

    if (fs.existsSync(uploadsPath)) {
      await fs.promises.cp(uploadsPath, path.join(temporaryDir, 'uploads'), { recursive: true });
    }
    const manifest = {
      created_at: new Date().toISOString(),
      database: 'tabletto.db',
      uploads: fs.existsSync(uploadsPath) ? 'uploads/' : null
    };
    await fs.promises.writeFile(path.join(temporaryDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await fs.promises.rename(temporaryDir, backupDir);
    console.log(`Konsistentes Backup erstellt: ${backupDir}`);
  } catch (error) {
    await fs.promises.rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
}

createBackup().catch(error => {
  console.error('Backup fehlgeschlagen:', error.message);
  process.exitCode = 1;
});
