const { test, expect } = require('@playwright/test');

async function session(page, request) {
  const email = `audit-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const password = 'SyntheticPassword123!';
  expect((await request.post('/api/auth/register', { data: { email, password } })).status()).toBe(201);
  const result = await (await request.post('/api/auth/login', { data: { email, password } })).json();
  await page.goto('/login');
  await page.evaluate(result => {
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
  }, result);
  return { email, password, headers: { Authorization: `Bearer ${result.token}` } };
}
async function medication(request, headers) {
  const result = await request.post('/api/medications', { headers, data: {
    name: 'Audit-Medikament', dosage_morning: 1, dosage_noon: 0, dosage_evening: 0,
    tablets_per_package: 20, current_stock: 7.5, warning_threshold_days: 7
  } });
  expect(result.status()).toBe(201);
  return (await result.json()).medication;
}
async function snapshot(page, testInfo, name) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
}

test('Speicherfehler erhält Eingaben; Bruchbestand und Tastatur-Fotoauswahl funktionieren', async ({ page, request }, testInfo) => {
  const { headers } = await session(page, request);
  const med = await medication(request, headers);
  const unhandled = [];
  page.on('pageerror', error => unhandled.push(error.message));
  await page.goto(`/medication/${med.id}`);
  await page.getByRole('button', { name: 'Medikament bearbeiten' }).click();
  const dialog = page.getByRole('dialog', { name: 'Medikament bearbeiten' });
  await dialog.getByLabel('Name', { exact: true }).fill('Geänderter Name');
  await page.route(`**/api/medications/${med.id}`, route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 500, json: { error: 'Synthetischer Speicherfehler' } }) : route.continue());
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveText('Synthetischer Speicherfehler');
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Geänderter Name');
  await snapshot(page, testInfo, 'edit-error-retains-input');
  await page.unroute(`**/api/medications/${med.id}`);
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Geänderter Name' })).toBeVisible();
  await page.getByRole('button', { name: 'Bestand setzen' }).click();
  const stock = page.getByRole('dialog', { name: 'Bestand setzen' });
  await stock.getByLabel('Neuer Bestand').fill('6.5');
  await stock.getByRole('button', { name: 'Bestätigen' }).click();
  await expect(stock).toBeHidden();
  await expect(page.getByText('Aktueller Bestand:').locator('..')).toContainText('6.5');
  const upload = page.getByRole('button', { name: 'Foto hochladen' });
  await upload.focus();
  const fileDialog = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await fileDialog).setFiles([]);
  expect(unhandled).toEqual([]);
});

test('Neuanlage bleibt bei Netzwerkfehler offen und kann erneut gespeichert werden', async ({ page, request }, testInfo) => {
  await session(page, request);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Medikament hinzufügen|Neues Medikament/ }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('Neuanlage mit Fehler');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/medications', route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Neuanlage mit Fehler');
  await snapshot(page, testInfo, 'create-network-error');
  await page.unroute('**/api/medications');
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test('Einstellungen laden fehl; Retry und Passwortänderung erhalten die Sitzung', async ({ page, request }, testInfo) => {
  const user = await session(page, request);
  const writes = [];
  await page.route('**/api/user/preferences', route => {
    if (route.request().method() === 'GET') return route.fulfill({ status: 500, json: { error: 'Synthetischer Ladefehler' } });
    writes.push(route.request().method()); return route.continue();
  });
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Einstellungen speichern' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Erneut laden' })).toBeVisible();
  expect(writes).toEqual([]);
  await snapshot(page, testInfo, 'settings-load-error');
  await page.unroute('**/api/user/preferences');
  await page.getByRole('button', { name: 'Erneut laden' }).click();
  await expect(page.getByRole('button', { name: 'Einstellungen speichern' })).toBeEnabled();
  await page.getByLabel('Aktuelles Passwort', { exact: true }).fill('wrong-password');
  await page.getByLabel('Neues Passwort', { exact: true }).fill('NewSyntheticPassword123!');
  await page.getByLabel('Neues Passwort bestätigen').fill('NewSyntheticPassword123!');
  await page.getByRole('button', { name: 'Passwort ändern', exact: true }).click();
  await expect(page.getByText('Aktuelles Passwort falsch')).toBeVisible();
  expect(await page.evaluate(() => Boolean(localStorage.getItem('token')))).toBeTruthy();
  await page.getByLabel('Aktuelles Passwort', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Passwort ändern', exact: true }).click();
  await expect(page.getByText('Passwort erfolgreich geändert')).toBeVisible();
  expect((await request.post('/api/auth/login', { data: { email: user.email, password: 'NewSyntheticPassword123!' } })).ok()).toBeTruthy();
});

test('Kalender ist lokalisiert, CSP-konform und schreibt nach Ladefehler keine Defaults', async ({ page, request }, testInfo) => {
  await session(page, request);
  let writes = 0;
  const errors = [];
  page.on('console', message => { if (message.type() === 'error' && /Content Security Policy|font.*violates/i.test(message.text())) errors.push(message.text()); });
  await page.route('**/api/user/preferences', route => {
    if (route.request().method() === 'GET') return route.fulfill({ status: 500, json: { error: 'Synthetischer Ladefehler' } });
    writes++; return route.continue();
  });
  await page.goto('/dashboard');
  await expect(page.getByText('Ansichtseinstellungen konnten nicht geladen werden.')).toBeVisible();
  await page.goto('/calendar');
  await expect(page.locator('.fc-prev-button')).toHaveText('‹');
  await expect(page.locator('.fc-next-button')).toHaveText('›');
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  await expect(page.getByText('Keine Ereignisse anzuzeigen')).toBeVisible();
  await snapshot(page, testInfo, 'calendar-localized');
  expect(writes).toBe(0);
  expect(errors).toEqual([]);
});

test('Historie paginiert ohne Duplikate; Fokus-Rückkehr aktualisiert Bestand', async ({ page, request }, testInfo) => {
  const { headers } = await session(page, request);
  const med = await medication(request, headers);
  for (let i = 0; i < 55; i++) expect((await request.post(`/api/medications/${med.id}/stock`, { headers, data: { action: 'set_stock', amount: i } })).ok()).toBeTruthy();
  await page.goto(`/medication/${med.id}`);
  await expect(page.getByRole('listitem')).toHaveCount(50);
  await page.getByRole('button', { name: 'Ältere Einträge laden' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(55);
  await expect(page.getByRole('button', { name: 'Ältere Einträge laden' })).toHaveCount(0);
  await request.post(`/api/medications/${med.id}/stock`, { headers, data: { action: 'set_stock', amount: 88 } });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('Aktueller Bestand:').locator('..')).toContainText('88');
  await expect(page.getByRole('listitem')).toHaveCount(55);
  await snapshot(page, testInfo, 'history-pagination-live-stock');
});

test('Fehlgeformte API-Eingaben werden abgefangen und Import bleibt unverändert', async ({ request, page }) => {
  const { headers } = await session(page, request);
  const med = await medication(request, headers);
  expect((await request.post('/api/medications', { headers, data: { name: 42 } })).status()).toBe(400);
  expect((await request.post('/api/auth/login', { data: { email: 'invalid@example.test', password: {} } })).status()).toBe(401);
  expect((await request.put('/api/user/password', { headers })).status()).toBe(400);
  expect((await request.get(`/api/medications/${med.id}/history?cursor=invalid`, { headers })).status()).toBe(400);
  const archived = (await (await request.get('/api/data/export', { headers })).json()).data;
  archived.medications[0].created_at = 'broken';
  expect((await request.post('/api/data/import', { headers, data: { data: archived } })).status()).toBe(400);
  expect((await request.get(`/api/medications/${med.id}`, { headers })).status()).toBe(200);
});

test('Neue Dialoge und Kalender bleiben auf schmalen Viewports bedienbar', async ({ page, request }, testInfo) => {
  const { headers } = await session(page, request);
  const med = await medication(request, headers);
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/calendar');
    await expect(page.locator('.fc-next-button')).toBeVisible();
    await snapshot(page, testInfo, `calendar-${width}`);
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'Passwort ändern', exact: true })).toBeVisible();
    await snapshot(page, testInfo, `settings-${width}`);
    await page.goto(`/medication/${med.id}`);
    await page.getByRole('button', { name: 'Medikament bearbeiten' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await snapshot(page, testInfo, `edit-${width}`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  }
});
