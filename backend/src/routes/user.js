const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.use(authenticateToken);

router.get('/profile', userController.getProfile);
router.put('/password', userController.changePassword);

module.exports = router;
