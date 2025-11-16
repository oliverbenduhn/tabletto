const DEFAULT_JWT_SECRET = 'change-this-secret-key-in-production';

// Ensure we always have a JWT secret to work with. In production the environment
// variable MUST be set; otherwise we fall back to a placeholder so the app
// does not crash but emit a clear warning.
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

if (!process.env.JWT_SECRET) {
  console.warn(
    '[auth] JWT_SECRET is missing. Using insecure default. ' +
      'Set JWT_SECRET in your environment for production deployments.'
  );
}

module.exports = {
  JWT_SECRET,
  DEFAULT_JWT_SECRET
};
