const router = require('express').Router();
const { exportData, importData } = require('../controllers/dataController');
const { authenticateToken } = require('../middleware/auth');

// Alle Routen benötigen Authentifizierung
router.use(authenticateToken);

// Export aller Benutzerdaten
router.get('/export', exportData);

// Import von Benutzerdaten
router.post('/import', importData);

module.exports = router;
