const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const userController = require('../controllers/userController');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(authenticateToken);

router.get('/profile', asyncHandler(userController.getProfile));
router.put('/password', asyncHandler(userController.changePassword));
router.get('/preferences', asyncHandler(userController.getUserPreferences));
router.put('/preferences', asyncHandler(userController.updateUserPreferences));

module.exports = router;
