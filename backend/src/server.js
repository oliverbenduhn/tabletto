const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { initDatabase } = require('./config/database');
const { getDatabase } = require('./config/database');
const authRoutes = require('./routes/auth');
const medicationRoutes = require('./routes/medications');
const userRoutes = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS: allow specific origin in production via FRONTEND_ORIGIN env
const allowedOrigin = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/user', userRoutes);

const frontendBuildPath = path.join(__dirname, '../../frontend/build');
app.use(express.static(frontendBuildPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Interner Serverfehler'
  });
});

// Health endpoint for orchestration / container healthchecks
app.get('/health', async (req, res) => {
  try {
    const db = getDatabase();
    // simple query to ensure DB is responsive
    await db.get('SELECT 1 as ok');
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    // If DB not initialized yet or query fails, still return 500
    res.status(500).json({ status: 'error', detail: err.message });
  }
});

initDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server läuft auf Port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Fehler beim Initialisieren der Datenbank:', err);
    process.exit(1);
  });
