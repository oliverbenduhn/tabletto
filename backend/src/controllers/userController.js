const bcrypt = require('bcryptjs');
const { findById, findByEmail, updatePassword, getPreferences, updatePreferences } = require('../models/User');
const { validatePassword } = require('../utils/validation');

const ALLOWED_DASHBOARD_VIEWS = new Set(['grid', 'list']);
const ALLOWED_CALENDAR_VIEWS = new Set(['dayGridMonth', 'listMonth']);

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

async function getUserPreferences(req, res) {
  const preferences = await getPreferences(req.user.id);
  if (!preferences) {
    return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  }
  res.json({
    preferences: {
      dashboardView: preferences.dashboard_view || 'grid',
      calendarView: preferences.calendar_view || 'dayGridMonth'
    }
  });
}

async function updateUserPreferences(req, res) {
  const { dashboardView, calendarView } = req.body || {};
  const updates = {};

  if (dashboardView !== undefined) {
    if (!ALLOWED_DASHBOARD_VIEWS.has(dashboardView)) {
      return res.status(400).json({ error: 'Ungültiger dashboardView' });
    }
    updates.dashboardView = dashboardView;
  }

  if (calendarView !== undefined) {
    if (!ALLOWED_CALENDAR_VIEWS.has(calendarView)) {
      return res.status(400).json({ error: 'Ungültiger calendarView' });
    }
    updates.calendarView = calendarView;
  }

  const preferences = await updatePreferences(req.user.id, updates);
  if (!preferences) {
    return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  }

  res.json({
    preferences: {
      dashboardView: preferences.dashboard_view || 'grid',
      calendarView: preferences.calendar_view || 'dayGridMonth'
    }
  });
}

module.exports = { getProfile, changePassword, getUserPreferences, updateUserPreferences };
