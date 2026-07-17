const rateLimit = require('express-rate-limit');

const sharedOptions = {
  windowMs: 60 * 1000,
  message: { error: 'Zu viele Anfragen, bitte später erneut versuchen' },
  standardHeaders: true,
  legacyHeaders: false
};

const loginLimiter = rateLimit({
  ...sharedOptions,
  max: 5,
  // Erfolgreiche Anmeldungen sind kein Brute-Force-Signal und dürfen mehrere
  // Benutzer hinter derselben Proxy-/NAT-Adresse nicht gegenseitig blockieren.
  skipSuccessfulRequests: true
});

const registerLimiter = rateLimit({
  ...sharedOptions,
  max: 10,
  skipSuccessfulRequests: true
});

module.exports = { loginLimiter, registerLimiter };
