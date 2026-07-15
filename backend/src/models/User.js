const { getDatabase, enqueueWrite } = require('../config/database');

async function createUser(email, passwordHash) {
  const result = await enqueueWrite(db => db.run(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    [email, passwordHash]
  ));
  return { id: result.lastID, email };
}

async function findByEmail(email) {
  const db = getDatabase();
  // Bestehende Installationen können E-Mail-Adressen noch mit Großbuchstaben
  // enthalten; neue Registrierungen werden bereits normalisiert gespeichert.
  return db.get('SELECT * FROM users WHERE email = ? COLLATE NOCASE ORDER BY id LIMIT 1', [email]);
}

async function updateLastLogin(id) {
  await enqueueWrite(db => db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [id]));
}

async function updatePassword(id, passwordHash) {
  await enqueueWrite(db => db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]));
}

async function findById(id) {
  const db = getDatabase();
  return db.get('SELECT id, email, created_at, last_login, dashboard_view, calendar_view FROM users WHERE id = ?', [id]);
}

async function getPreferences(id) {
  const db = getDatabase();
  const user = await db.get(
    'SELECT dashboard_view, calendar_view, dose_time_morning, dose_time_noon, dose_time_evening FROM users WHERE id = ?',
    [id]
  );
  if (!user) return null;
  return {
    dashboardView: user.dashboard_view,
    calendarView: user.calendar_view,
    dose_times: {
      morning: user.dose_time_morning,
      noon: user.dose_time_noon,
      evening: user.dose_time_evening
    }
  };
}

async function updatePreferences(id, { dashboardView, calendarView, dose_times }) {
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

  if (dose_times) {
    if (dose_times.morning) {
      fields.push('dose_time_morning = ?');
      values.push(dose_times.morning);
    }
    if (dose_times.noon) {
      fields.push('dose_time_noon = ?');
      values.push(dose_times.noon);
    }
    if (dose_times.evening) {
      fields.push('dose_time_evening = ?');
      values.push(dose_times.evening);
    }
  }

  if (!fields.length) {
    return getPreferences(id);
  }

  values.push(id);
  await enqueueWrite(database => database.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values));
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
