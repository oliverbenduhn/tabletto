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
  const nextDue = new Date();
  nextDue.setUTCDate(nextDue.getUTCDate() + 7);
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
    next_due_at: nextDue.toISOString()
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

  const book = (action, amount, key, token = userA.token, id = medication.id) => request.post(`/api/medications/${id}/stock`, {
    headers: { ...auth(token), 'Idempotency-Key': key }, data: { action, amount }
  });
  expect((await book('add_package', 2, 'invalid key')).status()).toBe(400);
  const duplicates = await Promise.all([book('add_package', 2, 'pack'), book('add_package', 2, 'pack')]);
  expect(duplicates.map(r => r.status())).toEqual([200, 200]);
  const pack = await duplicates[0].json();
  expect(await duplicates[1].json()).toEqual(pack);
  expect(pack.medication.current_stock).toBe(10);
  expect((await book('add_package', 3, 'pack')).status()).toBe(409);
  expect((await book('set_stock', 2, 'pack')).status()).toBe(409);
  expect((await book('add_package', 2, 'pack', userB.token)).status()).toBe(404);
  const medB = (await (await request.post('/api/medications', { headers: auth(userB.token), data: medicationPayload })).json()).medication;
  expect((await book('add_package', 2, 'pack', userB.token, medB.id)).status()).toBe(200);

  const measurement = await book('set_stock', 5, 'measurement');
  expect(measurement.status()).toBe(200);
  const measured = await measurement.json();
  expect((await book('add_package', 2, 'later')).status()).toBe(200);
  expect(await (await book('set_stock', 5, 'measurement')).json()).toEqual(measured);
  const current = (await (await request.get(`/api/medications/${medication.id}`, { headers: auth(userA.token) })).json()).medication;
  expect(current.current_stock).toBe(7);
  expect(current.scheduler_anchor_at).toBeTruthy();
  expect(current.scheduler_anchor_at).toBe(measured.medication.scheduler_anchor_at);
  expect(current.last_stock_measured_at).toBe(measured.medication.last_stock_measured_at);
  const { history } = await (await request.get(`/api/medications/${medication.id}/history`, { headers: auth(userA.token) })).json();
  expect(history).toHaveLength(5);
  expect(history.filter(entry => entry.action === 'set_stock')).toHaveLength(1);

  const exported = await request.get('/api/data/export', { headers: auth(userA.token) });
  expect(exported.ok()).toBeTruthy();
  const exportedData = (await exported.json()).data;
  expect(exportedData.version).toBe('2.1.0');
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
  expect((await book('add_package', 2, 'pack')).status()).toBe(404);
  const recreated = (await (await request.post('/api/medications', { headers: auth(userA.token), data: medicationPayload })).json()).medication;
  expect(recreated.id).not.toBe(medication.id);
  expect((await book('add_package', 2, 'pack', userA.token, recreated.id)).status()).toBe(200);
  expect((await (await book('add_package', 2, 'pack', userB.token, medB.id)).json()).medication.current_stock).toBe(6);
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
