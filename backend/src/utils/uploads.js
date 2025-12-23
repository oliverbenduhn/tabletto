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

function normalizeUploadPath(inputPath) {
  if (!inputPath) return null;
  const normalized = inputPath.replace(/\\/g, '/');
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }
  return normalized
    .replace(/^\/?uploads\//, '')
    .replace(/^\/+/, '');
}

function buildUploadUrl(relativePath) {
  const normalized = normalizeUploadPath(relativePath);
  if (!normalized) return null;
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }
  return `/uploads/${normalized}`;
}

function resolveUploadPath(relativePath) {
  const normalized = normalizeUploadPath(relativePath);
  if (!normalized) return null;
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return null;
  }
  return path.join(uploadRoot, normalized);
}

module.exports = {
  uploadRoot,
  medicationPhotoDir,
  ensureUploadDirs,
  toRelativeMedicationPath,
  buildUploadUrl,
  resolveUploadPath
};
