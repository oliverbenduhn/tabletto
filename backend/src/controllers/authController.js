const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createUser, findByEmail, updateLastLogin } = require('../models/User');
const { validateEmail, validatePassword } = require('../utils/validation');
const { JWT_SECRET } = require('../config/jwt');

async function register(req, res) {
  const password = req.body?.password;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
  }

  const existingUser = await findByEmail(email);
  if (existingUser) {
    return res.status(409).json({ error: 'E-Mail bereits registriert' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await createUser(email, passwordHash);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'E-Mail bereits registriert' });
    }
    throw error;
  }

  return res.status(201).json({
    message: 'Registrierung erfolgreich',
    user
  });
}

async function login(req, res) {
  const password = req.body?.password;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  const user = await findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: '7d'
  });

  await updateLastLogin(user.id);

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email
    }
  });
}

module.exports = { register, login };
