// Internal test endpoints. Gated by ENABLE_INTERNAL_ENDPOINTS=true at the
// server level; without that env var, this router is not mounted at all.
// These endpoints exist so the E2E suite can trigger scheduler work without
// waiting for cron fires. They are never reachable in production.

const express = require('express');
const { runStatusDetectionNow, runWeeklyDigestNow } = require('../services/notificationScheduler');
const { getDatabase, enqueueWrite } = require('../config/database');

const router = express.Router();

router.post('/notifications/run-status', async (req, res) => {
  const result = await runStatusDetectionNow();
  res.json(result);
});

router.post('/notifications/run-weekly', async (req, res) => {
  const result = await runWeeklyDigestNow();
  res.json(result);
});

// Test helper: disable every user's notification toggles and clear
// last_notified_status so subsequent tests start with a clean slate.
// Only mounted when ENABLE_INTERNAL_ENDPOINTS=true.
router.post('/test/reset-notifications', async (req, res) => {
  await enqueueWrite(db => Promise.all([
    db.run('UPDATE users SET notification_weekly_enabled = 0, notification_status_enabled = 0'),
    db.run('UPDATE medications SET last_notified_status = NULL')
  ]));
  res.json({ ok: true });
});

module.exports = router;