const fs = require('fs');
const { withTransaction } = require('../config/database');
const { resolveUploadPath } = require('./uploads');

/** The DB write lock coordinates deletion with the cross-process backup lock. */
async function removeUnreferencedPhoto(photoPath) {
  const fullPath = photoPath && resolveUploadPath(photoPath);
  if (!fullPath) return;
  try {
    await withTransaction(async db => {
      // Legacy rows may share a path; the global existence check exposes no user data.
      const referenced = await db.get('SELECT 1 FROM medications WHERE photo_path = ? LIMIT 1', [photoPath]);
      if (!referenced) await fs.promises.unlink(fullPath).catch(error => { if (error.code !== 'ENOENT') throw error; });
    });
  } catch (error) {
    console.error('Nicht referenziertes Foto konnte nicht entfernt werden:', error.code || 'Dateifehler');
  }
}
module.exports = { removeUnreferencedPhoto };
