const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const medicationController = require('../controllers/medicationController');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { ensureUploadDirs, medicationPhotoDir } = require('../utils/uploads');

ensureUploadDirs();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, medicationPhotoDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    cb(new Error('Nur Bilddateien erlaubt'));
  }
});

router.use(authenticateToken);

router.get('/', medicationController.getMedications);
router.post('/', upload.single('photo'), medicationController.createMedication);
router.get('/:id', medicationController.getMedication);
router.put('/:id', medicationController.updateMedication);
router.delete('/:id', medicationController.deleteMedication);
router.post('/:id/stock', medicationController.updateStock);
router.get('/:id/history', medicationController.getHistory);
router.post('/:id/photo', upload.single('photo'), medicationController.uploadPhoto);
router.delete('/:id/photo', medicationController.deletePhoto);

module.exports = router;
