const { getDatabase } = require('../config/database');

async function createUser(email, passwordHash) {
  const db = getDatabase();
  const result = await db.run(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    [email, passwordHash]
  );
  return { id: result.lastID, email };
}

async function findByEmail(email) {
  const db = getDatabase();
  return db.get('SELECT * FROM users WHERE email = ?', [email]);
}

async function updateLastLogin(id) {
  const db = getDatabase();
  await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [id]);
}

async function updatePassword(id, passwordHash) {
  const db = getDatabase();
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}

async function findById(id) {
  const db = getDatabase();
  return db.get('SELECT id, email, created_at, last_login FROM users WHERE id = ?', [id]);
}

module.exports = { createUser, findByEmail, updateLastLogin, updatePassword, findById };
