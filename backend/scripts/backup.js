const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { dbPath, uploadRoot } = require('../src/config/paths');
const { resolveUploadPath } = require('../src/utils/uploads');

/** Holds a source write lock until the snapshot and all referenced photos exist. */
async function createBackup() {
  if (!fs.existsSync(dbPath)) throw new Error('Datenbank nicht gefunden');
  const backupsDir = path.join(path.dirname(dbPath), 'backups');
  await fs.promises.mkdir(backupsDir, { recursive: true });
  const backupDir = path.join(backupsDir, `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const temporaryDir = `${backupDir}.tmp`;
  await fs.promises.mkdir(temporaryDir);
  const destination = path.join(temporaryDir, 'tabletto.db');
  let lock;
  try {
    lock = await open({ filename: dbPath, driver: sqlite3.Database });
    await lock.exec('PRAGMA busy_timeout = 30000');
    await lock.exec('BEGIN IMMEDIATE');
    const source = await open({ filename: dbPath, driver: sqlite3.Database });
    try {
      await source.exec(`VACUUM INTO '${destination.replace(/'/g, "''")}'`);
    } finally {
      await source.close();
    }
    const snapshot = await open({ filename: destination, driver: sqlite3.Database });
    let photos;
    try {
      if ((await snapshot.get('PRAGMA integrity_check')).integrity_check !== 'ok') throw new Error('Integritätsprüfung fehlgeschlagen');
      photos = await snapshot.all('SELECT DISTINCT photo_path FROM medications WHERE photo_path IS NOT NULL');
    } finally {
      await snapshot.close();
    }
    // Only referenced immutable files belong to the snapshot; staging uploads
    // can be written concurrently but cannot become referenced under this lock.
    for (const { photo_path: photo } of photos) {
      const sourcePath = resolveUploadPath(photo);
      if (!sourcePath) throw new Error('Ungültiger Fotopfad in der Datenbank');
      const relative = path.relative(uploadRoot, sourcePath);
      const target = path.join(temporaryDir, 'uploads', relative);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.copyFile(sourcePath, target);
    }
    await fs.promises.writeFile(path.join(temporaryDir, 'manifest.json'), JSON.stringify({
      created_at: new Date().toISOString(), database: 'tabletto.db', uploads: photos.length ? 'uploads/' : null
    }, null, 2));
    await fs.promises.rename(temporaryDir, backupDir);
    console.log(`Konsistentes Backup erstellt: ${backupDir}`);
    return backupDir;
  } catch (error) {
    await fs.promises.rm(temporaryDir, { recursive: true, force: true });
    throw error;
  } finally {
    if (lock) {
      await lock.exec('ROLLBACK').catch(() => {});
      await lock.close();
    }
  }
}
if (require.main === module) createBackup().catch(error => {
  console.error('Backup fehlgeschlagen:', error.code || error.message);
  process.exitCode = 1;
});
module.exports = { createBackup };
