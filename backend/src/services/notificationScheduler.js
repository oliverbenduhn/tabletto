// Notification scheduler: status detection runs in the same cron tick as the
// stock scheduler; weekly digest fires weekly. Both are silent no-ops when
// SMTP is not configured.
//
// Status detection updates medications.last_notified_status on every detected
// change (including recoveries), so the same medication will only ever mail on
// a fresh worsening transition. Weekly digest is not state-tracked: the cron
// schedule is the only guard against duplicate sends.

const cron = require('node-cron');
const { getDatabase } = require('../config/database');
const { calculateMedicationStats } = require('../utils/calculations');
const {
  isMailConfigured,
  sendMail,
  renderStatusWarning,
  renderWeeklyDigest
} = require('./notifications');

let weeklyTask = null;

// Status rank for transition detection. Recoveries are transitions downward
// in this ordering and never trigger a mail.
const STATUS_RANK = { good: 0, warning: 1, critical: 2 };

function isWorsening(oldStatus, newStatus) {
  if (newStatus === 'critical') return oldStatus !== 'critical';
  if (newStatus === 'warning') return oldStatus === null || oldStatus === 'good';
  return false;
}

function transitionLabel(oldStatus) {
  // Display helper: a null previous state reads naturally as "good" in mails.
  return oldStatus || 'good';
}

async function runStatusDetectionNow() {
  if (!isMailConfigured()) return { skipped: 'smtp-not-configured' };
  const db = getDatabase();
  const users = await db.all(
    'SELECT id, email FROM users WHERE notification_status_enabled = 1'
  );
  let totalMails = 0;
  for (const user of users) {
    const medications = await db.all('SELECT * FROM medications WHERE user_id = ?', [user.id]);
    if (medications.length === 0) continue;

    const enriched = medications.map(med => ({ ...med, ...calculateMedicationStats(med) }));
    const transitions = [];

    for (const med of enriched) {
      if (med.warning_status === med.last_notified_status) continue;
      if (isWorsening(med.last_notified_status, med.warning_status)) {
        transitions.push({
          medication_id: med.id,
          medication_name: med.name,
          old_status: transitionLabel(med.last_notified_status),
          new_status: med.warning_status,
          depletion_date: med.depletion_date
        });
      }
      await db.run(
        'UPDATE medications SET last_notified_status = ? WHERE id = ? AND user_id = ?',
        [med.warning_status, med.id, user.id]
      );
    }

    if (transitions.length === 0) continue;
    const mail = renderStatusWarning(user, transitions);
    const result = await sendMail({ to: user.email, ...mail });
    if (!result.skipped && !result.error) totalMails += 1;
  }
  return { mailsSent: totalMails };
}

async function runWeeklyDigestNow() {
  if (!isMailConfigured()) return { skipped: 'smtp-not-configured' };
  const db = getDatabase();
  const users = await db.all(
    'SELECT id, email FROM users WHERE notification_weekly_enabled = 1'
  );
  let totalMails = 0;
  for (const user of users) {
    const medications = await db.all('SELECT * FROM medications WHERE user_id = ?', [user.id]);
    if (medications.length === 0) continue;

    const enriched = medications.map(med => ({ ...med, ...calculateMedicationStats(med) }));
    const mail = renderWeeklyDigest(user, medications, enriched);
    const result = await sendMail({ to: user.email, ...mail });
    if (!result.skipped && !result.error) totalMails += 1;
  }
  return { mailsSent: totalMails };
}

function startNotificationScheduler() {
  if (process.env.ENABLE_NOTIFICATION_SCHEDULER === 'false') return;
  if (weeklyTask) return;
  // Sunday 18:00 in the configured TZ. node-cron uses Sunday=0.
  const expression = process.env.WEEKLY_DIGEST_CRON || '0 18 * * 0';
  if (!cron.validate(expression)) {
    throw new Error(`Ungültiger WEEKLY_DIGEST_CRON: ${expression}`);
  }
  const timeZone = process.env.TZ || 'Europe/Berlin';
  weeklyTask = cron.schedule(expression, () => {
    runWeeklyDigestNow().catch(error => console.error('Benachrichtigungen: Wochen-Digest fehlgeschlagen:', error));
  }, { scheduled: true, timezone: timeZone });
  console.log(`Benachrichtigungen: Wochen-Digest geplant mit "${expression}" in ${timeZone}`);
}

function stopNotificationScheduler() {
  if (weeklyTask) {
    weeklyTask.stop();
    weeklyTask = null;
  }
}

module.exports = {
  startNotificationScheduler,
  stopNotificationScheduler,
  runStatusDetectionNow,
  runWeeklyDigestNow,
  isWorsening
};