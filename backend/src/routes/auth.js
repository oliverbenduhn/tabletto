const express = require('express');
const router = express.Router();
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const authController = require('../controllers/authController');
const { asyncHandler } = require('../utils/asyncHandler');

router.post('/register', registerLimiter, asyncHandler(authController.register));
router.post('/login', loginLimiter, asyncHandler(authController.login));

module.exports = router;
