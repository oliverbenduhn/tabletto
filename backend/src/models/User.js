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
  return db.get('SELECT id, email, created_at, last_login, dashboard_view, calendar_view FROM users WHERE id = ?', [id]);
}

async function getPreferences(id) {
  const db = getDatabase();
  return db.get('SELECT dashboard_view, calendar_view FROM users WHERE id = ?', [id]);
}

async function updatePreferences(id, { dashboardView, calendarView }) {
  const db = getDatabase();
  const fields = [];
  const values = [];

  if (dashboardView) {
    fields.push('dashboard_view = ?');
    values.push(dashboardView);
  }

  if (calendarView) {
    fields.push('calendar_view = ?');
    values.push(calendarView);
  }

  if (!fields.length) {
    return getPreferences(id);
  }

  values.push(id);
  await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  return getPreferences(id);
}

module.exports = {
  createUser,
  findByEmail,
  updateLastLogin,
  updatePassword,
  findById,
  getPreferences,
  updatePreferences
};
