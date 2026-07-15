const fs = require('fs');
const path = require('path');

const uploadRoot = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads');
const medicationPhotoDir = path.join(uploadRoot, 'medications');

function ensureUploadDirs() {
  fs.mkdirSync(medicationPhotoDir, { recursive: true });
}

function toRelativeMedicationPath(filename) {
  return path.posix.join('medications', filename);
}

/**
 * Converts legacy public URLs and platform-specific separators to the relative
 * representation stored in SQLite. This is compatibility normalization, not an
 * authorization or path-containment check.
 */
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

function resolveUploadPath(relativePath) {
  const normalized = normalizeUploadPath(relativePath);
  if (!normalized) return null;
  // Remote references may occur in imported data but must never be treated as
  // local files eligible for unlinking.
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return null;
  }
  const resolvedRoot = path.resolve(uploadRoot);
  const resolvedPath = path.resolve(resolvedRoot, normalized);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null;
  }
  return resolvedPath;
}

module.exports = {
  uploadRoot,
  medicationPhotoDir,
  ensureUploadDirs,
  toRelativeMedicationPath,
  resolveUploadPath
};
