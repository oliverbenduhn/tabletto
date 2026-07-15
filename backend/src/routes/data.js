const router = require('express').Router();
const { exportData, importData } = require('../controllers/dataController');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

// Alle Routen benötigen Authentifizierung
router.use(authenticateToken);

// Export aller Benutzerdaten
router.get('/export', asyncHandler(exportData));

// Import von Benutzerdaten
router.post('/import', asyncHandler(importData));

module.exports = router;
