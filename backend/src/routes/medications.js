const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const medicationController = require('../controllers/medicationController');
const multer = require('multer');
const crypto = require('crypto');
const { ensureUploadDirs, medicationPhotoDir } = require('../utils/uploads');
const { asyncHandler } = require('../utils/asyncHandler');

ensureUploadDirs();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, medicationPhotoDir);
  },
  filename: (req, file, cb) => {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp'
    };
    const safeExt = extensions[file.mimetype] || '';
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(Object.assign(new Error('Nur JPEG-, PNG-, GIF- oder WebP-Bilder erlaubt'), { status: 400 }));
  }
});

router.get('/:id/photo-content', asyncHandler(medicationController.getPhotoContent));

router.use(authenticateToken);

router.get('/', asyncHandler(medicationController.getMedications));
router.post('/', upload.single('photo'), asyncHandler(medicationController.createMedication));
router.get('/:id', asyncHandler(medicationController.getMedication));
router.put('/:id', asyncHandler(medicationController.updateMedication));
router.delete('/:id', asyncHandler(medicationController.deleteMedication));
router.post('/:id/stock', asyncHandler(medicationController.updateStock));
router.get('/:id/history', asyncHandler(medicationController.getHistory));
router.post(
  '/:id/photo',
  asyncHandler(medicationController.requireMedication),
  upload.single('photo'),
  asyncHandler(medicationController.uploadPhoto)
);
router.delete('/:id/photo', asyncHandler(medicationController.deletePhoto));

module.exports = router;
