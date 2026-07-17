const { test, expect } = require('@playwright/test');
const { startFakeSmtp } = require('./fake-smtp');

const PASSWORD = 'SicheresPasswort123!';

let fakeSmtp;

async function createUser(request, prefix) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const register = await request.post('/api/auth/register', { data: { email, password: PASSWORD } });
  expect(register.status()).toBe(201);
  const login = await request.post('/api/auth/login', { data: { email, password: PASSWORD } });
  expect(login.ok()).toBeTruthy();
  return { email, token: (await login.json()).token };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createMedication(request, token, payload) {
  const response = await request.post('/api/medications', {
    headers: auth(token),
    data: payload
  });
  expect(response.status()).toBe(201);
  return (await response.json()).medication;
}

async function setStock(request, token, id, stock) {
  const response = await request.post(`/api/medications/${id}/stock`, {
    headers: auth(token),
    data: { action: 'set_stock', amount: stock }
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).medication;
}

function baseDailyMedication(name, stock) {
  return {
    name,
    dosage_morning: 1,
    dosage_noon: 0,
    dosage_evening: 0,
    dosage_per_interval: 1,
    tablets_per_package: 30,
    current_stock: stock,
    warning_threshold_days: 7,
    interval_days: 1
  };
}

function parseMail(mail) {
  // data starts with headers followed by a blank line and the body.
  const splitAt = mail.data.indexOf('\r\n\r\n');
  const headers = splitAt >= 0 ? mail.data.slice(0, splitAt) : mail.data;
  const body = splitAt >= 0 ? mail.data.slice(splitAt + 4) : '';
  const headerLines = headers.split('\r\n');
  const subjectLine = headerLines.find(line => /^Subject:/i.test(line)) || '';
  return {
    from: mail.envelope.from,
    to: mail.envelope.to,
    subject: subjectLine.replace(/^Subject:\s*/i, '').trim(),
    body: decodeQuotedPrintable(body).replace(/\r\n$/, '')
  };
}

function decodeQuotedPrintable(text) {
  // RFC 2045 §6.7: =XX expands to a byte; soft line breaks "=\r\n" become "".
  // The body is UTF-8 encoded, so decode each =XX back to its byte and then
  // let Node re-interpret the byte stream as UTF-8.
  const bytes = [];
  const stripped = text.replace(/=\r\n/g, '');
  for (let i = 0; i < stripped.length; i += 1) {
    const ch = stripped[i];
    if (ch === '=' && i + 2 < stripped.length) {
      const hex = stripped.slice(i + 1, i + 3);
      if (/^[0-9A-F]{2}$/i.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(stripped.charCodeAt(i) & 0xff);
  }
  return Buffer.from(bytes).toString('utf8');
}

async function triggerStatusDetection(request) {
  // Internal endpoint exposed only when ENABLE_INTERNAL_ENDPOINTS=true.
  const response = await request.post('/api/internal/notifications/run-status');
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function triggerWeeklyDigest(request) {
  const response = await request.post('/api/internal/notifications/run-weekly');
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function resetNotificationState(request) {
  const response = await request.post('/api/internal/test/reset-notifications');
  expect(response.ok()).toBeTruthy();
}

async function updatePreferences(request, token, patch) {
  const response = await request.put('/api/user/preferences', {
    headers: auth(token),
    data: patch
  });
  return response;
}

test.beforeAll(async () => {
  fakeSmtp = await startFakeSmtp({ host: '127.0.0.1', port: 2587 });
});

test.afterAll(async () => {
  if (fakeSmtp) await fakeSmtp.stop();
});

test.afterEach(async ({ request }) => {
  fakeSmtp.captured.length = 0;
  // Notification-Toggles und last_notified_status zurücksetzen, damit die
  // SQLite-DB keine aktivierten Toggles in den nächsten Test trägt.
  await resetNotificationState(request);
});

test('Toggle-Persistenz: PUT schreibt, GET liest, Werte überleben Reload', async ({ request }) => {
  const user = await createUser(request, 'toggle');

  const putResponse = await updatePreferences(request, user.token, {
    notificationWeeklyEnabled: true,
    notificationStatusEnabled: true
  });
  expect(putResponse.ok()).toBeTruthy();
  const updated = (await putResponse.json()).preferences;
  expect(updated.notificationWeeklyEnabled).toBe(true);
  expect(updated.notificationStatusEnabled).toBe(true);

  const getResponse = await request.get('/api/user/preferences', { headers: auth(user.token) });
  expect(getResponse.ok()).toBeTruthy();
  const fetched = (await getResponse.json()).preferences;
  expect(fetched.notificationWeeklyEnabled).toBe(true);
  expect(fetched.notificationStatusEnabled).toBe(true);

  // Defaultwerte nach frischer Registrierung sind false.
  const fresh = await createUser(request, 'fresh');
  const freshPrefs = await request.get('/api/user/preferences', { headers: auth(fresh.token) });
  expect((await freshPrefs.json()).preferences.notificationWeeklyEnabled).toBe(false);
  expect((await freshPrefs.json()).preferences.notificationStatusEnabled).toBe(false);

  // Aufräumen: Toggles zurücksetzen, damit Folgetests nicht durch persistierte
  // aktivierte Toggles anderer Nutzer kontaminiert werden.
  await updatePreferences(request, user.token, {
    notificationWeeklyEnabled: false,
    notificationStatusEnabled: false
  });
});

test('Toggle-Validierung: kein Boolean → 400, Werte unverändert', async ({ request }) => {
  const user = await createUser(request, 'validate');
  const response = await updatePreferences(request, user.token, { notificationWeeklyEnabled: 'ja' });
  expect(response.status()).toBe(400);
  const prefs = await request.get('/api/user/preferences', { headers: auth(user.token) });
  const body = await prefs.json();
  expect(body.preferences.notificationWeeklyEnabled).toBe(false);
});

test('Bestandsinfo-Mail: aktiv + gemischte Medikamente → eine Mail mit Counts und Liste', async ({ request }) => {
  const user = await createUser(request, 'weekly-on');
  // critical: 14 Tage Reichweite < 7, also current_stock=6 (Tagesverbrauch=1)
  // warning: 14 > daysRemaining >= 7, also current_stock=10
  // good: daysRemaining >= 14, also current_stock=20
  await createMedication(request, user.token, baseDailyMedication('Kritisches Medikament', 6));
  await createMedication(request, user.token, baseDailyMedication('Gelbes Medikament', 10));
  await createMedication(request, user.token, baseDailyMedication('Gruenes Medikament', 20));

  await updatePreferences(request, user.token, { notificationWeeklyEnabled: true });

  const result = await triggerWeeklyDigest(request);
  expect(result.mailsSent).toBe(1);
  await fakeSmtp.waitForCount(1);

  expect(fakeSmtp.captured).toHaveLength(1);
  const mail = parseMail(fakeSmtp.captured[0]);
  expect(mail.to).toBe(user.email);
  expect(mail.subject).toContain('Bestands');
  expect(mail.body).toContain('Kritisches Medikament');
  expect(mail.body).toContain('Gelbes Medikament');
  expect(mail.body).not.toContain('Gruenes Medikament');
  expect(mail.body).toMatch(/1 kritisch/);
  expect(mail.body).toMatch(/1 gelb/);
});

test('Bestandsinfo-Mail: deaktivierter Toggle → keine Mail', async ({ request }) => {
  const user = await createUser(request, 'weekly-off');
  await createMedication(request, user.token, baseDailyMedication('Nur ein Medikament', 5));
  // Toggle bleibt false

  const result = await triggerWeeklyDigest(request);
  expect(result.mailsSent).toBe(0);
  expect(fakeSmtp.captured).toHaveLength(0);
});

test('Bestandsinfo-Mail: keine Medikamente → keine Mail', async ({ request }) => {
  const user = await createUser(request, 'weekly-empty');
  await updatePreferences(request, user.token, { notificationWeeklyEnabled: true });

  const result = await triggerWeeklyDigest(request);
  expect(result.mailsSent).toBe(0);
  expect(fakeSmtp.captured).toHaveLength(0);
});

test('Statuswarnung: good → warning bei aktivem Toggle', async ({ request }) => {
  const user = await createUser(request, 'status-good-warning');
  await updatePreferences(request, user.token, { notificationStatusEnabled: true });
  const med = await createMedication(request, user.token, baseDailyMedication('Kipper', 20));

  // Auf warning drücken: Reichweite 10 Tage (< 14, >= 7)
  await setStock(request, user.token, med.id, 10);

  await triggerStatusDetection(request);
  await fakeSmtp.waitForCount(1);

  expect(fakeSmtp.captured).toHaveLength(1);
  const mail = parseMail(fakeSmtp.captured[0]);
  expect(mail.to).toBe(user.email);
  expect(mail.subject).toContain('Status');
  expect(mail.body).toContain('Kipper');
  expect(mail.body).toMatch(/good\s*→\s*warning/);
});

test('Statuswarnung: warning → critical zählt als Verschlechterung', async ({ request }) => {
  const user = await createUser(request, 'status-warning-critical');
  await updatePreferences(request, user.token, { notificationStatusEnabled: true });
  const med = await createMedication(request, user.token, baseDailyMedication('Absturz', 10));

  // Erst warning triggern und Detection laufen lassen, damit last_notified_status = warning
  await triggerStatusDetection(request);
  await fakeSmtp.waitForCount(1);
  fakeSmtp.captured.length = 0;

  // Jetzt auf critical drücken (< 7 Tage)
  await setStock(request, user.token, med.id, 5);

  await triggerStatusDetection(request);
  await fakeSmtp.waitForCount(1);

  const mail = parseMail(fakeSmtp.captured[0]);
  expect(mail.body).toMatch(/warning\s*→\s*critical/);
});

test('Erholungs-Übergänge lösen keine Mail aus', async ({ request }) => {
  const user = await createUser(request, 'status-recovery');
  await updatePreferences(request, user.token, { notificationStatusEnabled: true });
  const med = await createMedication(request, user.token, baseDailyMedication('Erholung', 5)); // critical

  // Detection läuft, schickt critical-Mail, setzt last_notified_status
  await triggerStatusDetection(request);
  await fakeSmtp.waitForCount(1);
  fakeSmtp.captured.length = 0;

  // Auf good anheben
  await setStock(request, user.token, med.id, 30);

  await triggerStatusDetection(request);
  // Recovery darf keine Mail erzeugen; wir warten bewusst nicht.
  // Kleine Pause, damit eventuelle Mails ankommen würden.
  await new Promise(resolve => setTimeout(resolve, 500));
  expect(fakeSmtp.captured).toHaveLength(0);
});

test('Re-Deterioration nach Erholung erzeugt wieder eine Mail', async ({ request }) => {
  const user = await createUser(request, 'status-redeteriorate');
  await updatePreferences(request, user.token, { notificationStatusEnabled: true });
  const med = await createMedication(request, user.token, baseDailyMedication('Achterbahn', 5)); // critical

  await triggerStatusDetection(request);
  await fakeSmtp.waitForCount(1);
  fakeSmtp.captured.length = 0;

  // Erholung auf good
  await setStock(request, user.token, med.id, 30);
  await triggerStatusDetection(request);
  await new Promise(resolve => setTimeout(resolve, 500));
  expect(fakeSmtp.captured).toHaveLength(0);

  // Erneuter Absturz auf warning
  await setStock(request, user.token, med.id, 10);
  await triggerStatusDetection(request);
  await fakeSmtp.waitForCount(1);
  const mail = parseMail(fakeSmtp.captured[0]);
  expect(mail.body).toMatch(/good\s*→\s*warning/);
});

test('Konsolidierung: mehrere Verschlechterungen in einem Tick = eine Mail', async ({ request }) => {
  const user = await createUser(request, 'status-consolidated');
  await updatePreferences(request, user.token, { notificationStatusEnabled: true });
  await createMedication(request, user.token, baseDailyMedication('Medikament A', 10)); // warning
  await createMedication(request, user.token, baseDailyMedication('Medikament B', 6)); // critical

  await triggerStatusDetection(request);
  await fakeSmtp.waitForCount(1);

  expect(fakeSmtp.captured).toHaveLength(1);
  const mail = parseMail(fakeSmtp.captured[0]);
  expect(mail.body).toContain('Medikament A');
  expect(mail.body).toContain('Medikament B');
  expect(mail.body).toMatch(/2 Medikamente/);
});

test('Dedup: kein Statuswechsel = keine zweite Mail im nächsten Tick', async ({ request }) => {
  const user = await createUser(request, 'status-dedup');
  await updatePreferences(request, user.token, { notificationStatusEnabled: true });
  await createMedication(request, user.token, baseDailyMedication('Stabil', 10)); // warning

  await triggerStatusDetection(request);
  await fakeSmtp.waitForCount(1);
  fakeSmtp.captured.length = 0;

  // Zweiter Tick ohne Stock-Änderung
  await triggerStatusDetection(request);
  await new Promise(resolve => setTimeout(resolve, 500));
  expect(fakeSmtp.captured).toHaveLength(0);
});

test('Mandantentrennung: Toggle eines Nutzers beeinflusst keinen anderen', async ({ request }) => {
  const userA = await createUser(request, 'tenant-a');
  const userB = await createUser(request, 'tenant-b');
  await updatePreferences(request, userA.token, { notificationStatusEnabled: true });
  // userB bleibt aus
  await createMedication(request, userA.token, baseDailyMedication('A-Med', 10));
  await createMedication(request, userB.token, baseDailyMedication('B-Med', 10));

  await triggerStatusDetection(request);
  await fakeSmtp.waitForCount(1);

  expect(fakeSmtp.captured).toHaveLength(1);
  expect(fakeSmtp.captured[0].envelope.to).toBe(userA.email);
});

test('SMTP-Credentials tauchen in keiner API-Antwort auf', async ({ request }) => {
  const user = await createUser(request, 'no-leak');
  const responses = [
    await request.get('/api/user/profile', { headers: auth(user.token) }),
    await request.get('/api/user/preferences', { headers: auth(user.token) }),
    await request.get('/api/medications', { headers: auth(user.token) })
  ];
  for (const response of responses) {
    expect(response.ok()).toBeTruthy();
    const text = await response.text();
    expect(text).not.toMatch(/SMTP_/);
    expect(text).not.toMatch(/smtp\./);
  }
});