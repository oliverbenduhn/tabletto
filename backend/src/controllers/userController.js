const bcrypt = require('bcryptjs');
const { findById, findByEmail, updatePassword } = require('../models/User');
const { validatePassword } = require('../utils/validation');

async function getProfile(req, res) {
  const user = await findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  }
  res.json({ user });
}

async function changePassword(req, res) {
  const { current_password, new_password } = req.body;

  if (!validatePassword(new_password)) {
    return res.status(400).json({ error: 'Neues Passwort erfüllt Anforderungen nicht' });
  }

  const user = await findByEmail(req.user.email);
  if (!user) {
    return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  }

  const passwordMatch = await bcrypt.compare(current_password, user.password_hash);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Aktuelles Passwort falsch' });
  }

  const newHash = await bcrypt.hash(new_password, 10);
  await updatePassword(user.id, newHash);
  res.json({ message: 'Passwort erfolgreich geändert' });
}

module.exports = { getProfile, changePassword };
