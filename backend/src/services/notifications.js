// Mail module: SMTP transport + text rendering for Bestandsinfo-Mail and
// Statuswarnung. All SMTP credentials are read from environment variables and
// never reach any other layer of the application.
//
// The module is a no-op when SMTP is not configured. Callers (the scheduler)
// can therefore unconditionally invoke sendMail; missing configuration is
// logged once at start-up and silently ignored on each send attempt.

const nodemailer = require('nodemailer');

let transporter = null;

function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true';
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined
  });
  return transporter;
}

function setTransporterForTesting(transport) {
  transporter = transport;
}

async function sendMail({ to, subject, text }) {
  const transport = getTransporter();
  if (!transport) {
    return { skipped: true, reason: 'smtp-not-configured' };
  }
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text
    });
    return { skipped: false };
  } catch (error) {
    // ponytail: SMTP failures must not break the caller. Log and move on;
    // add retry/backoff only when the failure mode actually demands it.
    console.error('Benachrichtigungen: SMTP-Versand fehlgeschlagen:', error.message);
    return { skipped: false, error: error.message };
  }
}

/**
 * Renders the weekly Bestandsinfo-Mail for one user. Lists only medications
 * with critical or warning status; green medications are intentionally
 * excluded so the mail stays actionable.
 *
 * @param {object} user The recipient user record (must contain `email`).
 * @param {Array<object>} medications Persisted medication rows.
 * @param {Array<object>} enriched Same medications enriched with stats (warning_status, depletion_date).
 * @returns {{ subject: string, text: string }|null} Null when the user has nothing notable to report.
 */
function renderWeeklyDigest(user, medications, enriched) {
  const counts = { critical: 0, warning: 0, good: 0 };
  const flagged = [];
  for (let i = 0; i < medications.length; i += 1) {
    const status = enriched[i].warning_status;
    counts[status] = (counts[status] || 0) + 1;
    if (status === 'critical' || status === 'warning') {
      flagged.push({ name: medications[i].name, status, depletion_date: enriched[i].depletion_date });
    }
  }
  const subject = 'Tabletto: Wöchentliche Bestandsübersicht';
  if (flagged.length === 0) {
    return {
      subject,
      text: [
        `Hallo ${user.email},`,
        '',
        `Dein Bestand sieht diese Woche gut aus: ${counts.good} Medikamente im grünen Bereich, ${counts.warning || 0} gelb, ${counts.critical || 0} kritisch.`,
        '',
        '— Tabletto'
      ].join('\n')
    };
  }
  const lines = [
    `Hallo ${user.email},`,
    '',
    `Bestandsübersicht: ${counts.critical || 0} kritisch, ${counts.warning || 0} gelb, ${counts.good || 0} grün.`,
    '',
    'Auffällige Medikamente:'
  ];
  for (const entry of flagged) {
    const dateLabel = entry.depletion_date ? ` (Leerstand: ${entry.depletion_date.slice(0, 10)})` : '';
    lines.push(`- ${entry.name}: ${entry.status}${dateLabel}`);
  }
  lines.push('', '— Tabletto');
  return { subject, text: lines.join('\n') };
}

/**
 * Renders the consolidated Statuswarnung for one user. One mail per tick,
 * listing every Status-Verschlechterung of this user in this tick.
 *
 * @param {object} user The recipient user record.
 * @param {Array<{ medication_name: string, old_status: string, new_status: string, depletion_date: string|null }>} transitions
 * @returns {{ subject: string, text: string }}
 */
function renderStatusWarning(user, transitions) {
  const subject = 'Tabletto: Statusänderung';
  const lines = [
    `Hallo ${user.email},`,
    '',
    `${transitions.length} Medikament${transitions.length === 1 ? ' hat' : 'e haben'} ihren Warnstatus verschlechtert:`
  ];
  for (const entry of transitions) {
    const dateLabel = entry.depletion_date ? ` (Leerstand ca. ${entry.depletion_date.slice(0, 10)})` : '';
    lines.push(`- ${entry.medication_name}: ${entry.old_status} → ${entry.new_status}${dateLabel}`);
  }
  lines.push('', '— Tabletto');
  return { subject, text: lines.join('\n') };
}

module.exports = {
  isMailConfigured,
  sendMail,
  renderWeeklyDigest,
  renderStatusWarning,
  setTransporterForTesting
};