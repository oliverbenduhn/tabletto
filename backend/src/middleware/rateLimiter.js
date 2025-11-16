const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Zu viele Anfragen, bitte später erneut versuchen' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { authLimiter };
