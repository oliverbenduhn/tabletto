const fs = require('fs');
const path = require('path');

const uploadRoot = path.join(__dirname, '../../uploads');
const medicationPhotoDir = path.join(uploadRoot, 'medications');

function ensureUploadDirs() {
  fs.mkdirSync(medicationPhotoDir, { recursive: true });
}

function toRelativeMedicationPath(filename) {
  return path.posix.join('medications', filename);
}

function buildUploadUrl(relativePath) {
  if (!relativePath) return null;
  return `/uploads/${relativePath.replace(/\\/g, '/')}`;
}

function resolveUploadPath(relativePath) {
  return path.join(uploadRoot, relativePath);
}

module.exports = {
  uploadRoot,
  medicationPhotoDir,
  ensureUploadDirs,
  toRelativeMedicationPath,
  buildUploadUrl,
  resolveUploadPath
};
