const { test, expect } = require('@playwright/test');

async function createSession(request, prefix) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const password = 'SicheresPasswort123!';
  await expect((await request.post('/api/auth/register', { data: { email, password } })).status()).toBe(201);
  const login = await request.post('/api/auth/login', { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  return { email, token: (await login.json()).token };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

test('Health, Mandantentrennung, Validierung und Import/Export-Vertrag', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'API-Vertrag ist viewport-unabhängig');
  const health = await request.get('/health');
  expect(health.status()).toBe(200);
  expect(health.headers()['content-type']).toContain('application/json');
  expect(await health.json()).toEqual({ status: 'ok' });

  const userA = await createSession(request, 'api-a');
  const userB = await createSession(request, 'api-b');
  const medicationPayload = {
    name: 'Intervall-Test',
    dosage_morning: 0,
    dosage_noon: 0,
    dosage_evening: 0,
    dosage_per_interval: 1,
    tablets_per_package: 4,
    current_stock: 4,
    warning_threshold_days: 7,
    interval_days: 7,
    next_due_at: '2026-07-20T12:00:00'
  };
  const created = await request.post('/api/medications', { headers: auth(userA.token), data: medicationPayload });
  expect(created.status()).toBe(201);
  const medication = (await created.json()).medication;

  expect((await request.get(`/api/medications/${medication.id}`, { headers: auth(userB.token) })).status()).toBe(404);
  expect((await request.get(`/api/medications/${medication.id}/history`, { headers: auth(userB.token) })).status()).toBe(404);
  expect((await request.delete(`/api/medications/${medication.id}`, { headers: auth(userB.token) })).status()).toBe(404);

  const invalidUpdate = await request.put(`/api/medications/${medication.id}`, {
    headers: auth(userA.token),
    data: { current_stock: -5, warning_threshold_days: 999 }
  });
  expect(invalidUpdate.status()).toBe(400);
  const unchanged = await request.get(`/api/medications/${medication.id}`, { headers: auth(userA.token) });
  expect((await unchanged.json()).medication.current_stock).toBe(4);

  const additions = await Promise.all([
    request.post(`/api/medications/${medication.id}/stock`, { headers: auth(userA.token), data: { action: 'add_package', amount: 2 } }),
    request.post(`/api/medications/${medication.id}/stock`, { headers: auth(userA.token), data: { action: 'add_package', amount: 2 } })
  ]);
  expect(additions.every(response => response.ok())).toBeTruthy();
  const afterConcurrentAdd = await request.get(`/api/medications/${medication.id}`, { headers: auth(userA.token) });
  expect((await afterConcurrentAdd.json()).medication.current_stock).toBe(8);

  const exported = await request.get('/api/data/export', { headers: auth(userA.token) });
  expect(exported.ok()).toBeTruthy();
  const exportedData = (await exported.json()).data;
  expect(exportedData.version).toBe('2.0.0');
  expect(exportedData.medications[0].interval_days).toBe(7);
  expect(exportedData.medications[0]).not.toHaveProperty('user_id');
  expect(exportedData.medications[0]).not.toHaveProperty('photo_path');

  const invalidImport = await request.post('/api/data/import', {
    headers: auth(userA.token),
    data: { data: { version: '2.0.0', medications: [{}], history: [] } }
  });
  expect(invalidImport.status()).toBe(400);
  expect((await request.get(`/api/medications/${medication.id}`, { headers: auth(userA.token) })).status()).toBe(200);

  const emptyImport = await request.post('/api/data/import', {
    headers: auth(userA.token),
    data: { data: { version: '2.0.0', medications: [], history: [] } }
  });
  expect(emptyImport.ok()).toBeTruthy();
  expect((await emptyImport.json()).imported.medications).toBe(0);
});

test('Uploadinhalt wird unabhängig vom behaupteten MIME-Typ geprüft', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'API-Vertrag ist viewport-unabhängig');
  const user = await createSession(request, 'upload');
  const response = await request.post('/api/medications', {
    headers: auth(user.token),
    multipart: {
      name: 'Upload-Test',
      dosage_morning: '1',
      dosage_noon: '0',
      dosage_evening: '0',
      dosage_per_interval: '1',
      tablets_per_package: '10',
      current_stock: '10',
      warning_threshold_days: '7',
      interval_days: '1',
      photo: { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('<html><script>alert(1)</script></html>') }
    }
  });
  expect(response.status()).toBe(400);
});
