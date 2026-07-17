const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { initDatabase } = require('./config/database');
const { getDatabase, closeDatabase } = require('./config/database');
const { startStockScheduler, stopStockScheduler } = require('./services/stockScheduler');
const { startNotificationScheduler, stopNotificationScheduler } = require('./services/notificationScheduler');
const internalRoutes = require('./routes/internal');
const { ensureUploadDirs } = require('./utils/uploads');
const authRoutes = require('./routes/auth');
const medicationRoutes = require('./routes/medications');
const userRoutes = require('./routes/user');
const dataRoutes = require('./routes/data');

const app = express();
const PORT = process.env.PORT || 3000;
let server = null;

// Configure CORS: allow specific origin in production via FRONTEND_ORIGIN env
const allowedOrigin = process.env.FRONTEND_ORIGIN || (process.env.NODE_ENV === 'production' ? false : '*');
app.use(cors({ origin: allowedOrigin }));
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  });
  next();
});
app.use(express.json({ limit: '20mb' }));
ensureUploadDirs();

app.get('/health', async (req, res) => {
  try {
    const db = getDatabase();
    await db.get('SELECT 1 as ok');
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'error' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/user', userRoutes);
app.use('/api/data', dataRoutes);
if (process.env.ENABLE_INTERNAL_ENDPOINTS === 'true') {
  app.use('/api/internal', internalRoutes);
}

const frontendBuildPath = path.join(__dirname, '../../frontend/build');
app.use(express.static(frontendBuildPath));

app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API-Endpunkt nicht gefunden' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  res.status(status).json({
    error: status >= 500 ? 'Interner Serverfehler' : (err.message || 'Anfrage konnte nicht verarbeitet werden')
  });
});

initDatabase()
  .then(() => {
    // Start Stock Scheduler
    if (process.env.ENABLE_STOCK_SCHEDULER !== 'false') {
      startStockScheduler();
      startNotificationScheduler();
    }

    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server läuft auf Port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Fehler beim Initialisieren der Datenbank:', err);
    process.exit(1);
  });

async function shutdown(signal) {
  console.log(`${signal} empfangen - fahre Anwendung herunter`);
  stopStockScheduler();
  stopNotificationScheduler();
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  await closeDatabase();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM').catch(error => {
  console.error('Fehler beim Herunterfahren:', error);
  process.exit(1);
}));
process.on('SIGINT', () => shutdown('SIGINT').catch(error => {
  console.error('Fehler beim Herunterfahren:', error);
  process.exit(1);
}));
