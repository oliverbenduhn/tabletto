const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const medicationController = require('../controllers/medicationController');

router.use(authenticateToken);

router.get('/', medicationController.getMedications);
router.post('/', medicationController.createMedication);
router.get('/:id', medicationController.getMedication);
router.put('/:id', medicationController.updateMedication);
router.delete('/:id', medicationController.deleteMedication);
router.post('/:id/stock', medicationController.updateStock);
router.get('/:id/history', medicationController.getHistory);

module.exports = router;
