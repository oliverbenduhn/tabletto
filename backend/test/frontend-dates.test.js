const test = require('node:test');
const assert = require('node:assert/strict');
process.env.TZ = 'Europe/Berlin';

test('M06: SQLite UTC wird mit Uhrzeit, Tageswechsel und Sommer-/Winterzeit dargestellt', async () => {
  const { formatDateTime } = await import('../../frontend/src/utils/dateFormatter.js');
  assert.equal(formatDateTime('2026-01-15 23:30:45'), '16.01.2026, 00:30:45');
  assert.equal(formatDateTime('2026-07-15 23:30:45'), '16.07.2026, 01:30:45');
  assert.equal(formatDateTime('2026-10-25T00:30:00Z'), '25.10.2026, 02:30:00');
  assert.equal(formatDateTime('2026-10-25T01:30:00Z'), '25.10.2026, 02:30:00');
  assert.equal(formatDateTime('invalid'), '-');
});
