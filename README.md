# Tabletto

[![Version](https://img.shields.io/github/v/release/oliverbenduhn/tabletto?label=Version&color=blue)](https://github.com/oliverbenduhn/tabletto/releases)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)

Tabletto ist ein webbasiertes Tool zur Verwaltung der eigenen Medikamente mit Bestandsverwaltung, Verbrauchsberechnung und automatischen Warnungen bei niedrigem Bestand.

## Schnellstart

### Installation mit Docker (empfohlen)

```bash
# Repository klonen
git clone <repository-url> tabletto
cd tabletto

# Umgebungsvariablen konfigurieren
cp .env.example .env
# Bearbeite .env und setze ein sicheres JWT_SECRET

# Container starten
docker compose up -d
```

Die Anwendung ist nun verfügbar unter: **<http://localhost:3000>**

📖 Ausführliche Installationsanleitung: [INSTALL.md](INSTALL.md)

## ✨ Features

- 🔐 **Benutzer-Authentifizierung** mit JWT
- 💊 **Medikamentenverwaltung** mit individuellen Dosierungen (morgens/mittags/abends)
- 📊 **Automatische Berechnung** des Verbrauchs und verbleibender Tage
- ⚠️ **Warnsystem** bei niedrigem Bestand
- 📜 **Verlaufshistorie** aller Bestandsänderungen
- 📦 **Import/Export** - Komplette Datensicherung als JSON
- 📷 **Foto-Uploads** für Medikamenten-Packungen
- 📱 **Responsive Web-Interface** - optimiert für Desktop & Mobile
- 🐳 **Docker-basiertes Deployment** - One-Click-Installation
- 🧠 **Benutzerpräferenzen** (z.B. Dashboard- und Kalenderansicht)

# Tabletto – Technische Spezifikation

## Projekt-Übersicht

Ein webbasiertes System zur Verwaltung von Medikamentenbeständen mit Benutzerauthentifizierung, Verbrauchsberechnung und Warnungen bei niedrigem Bestand.

## Technologie-Stack

- **Backend**: Node.js, Express.js, SQLite
- **Frontend**: React, Vite, Tailwind CSS
- **Authentifizierung**: JWT, bcrypt
- **Deployment**: Docker Container (Port 3000)

## Projektstruktur

```
tabletto/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── rateLimiter.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Medication.js
│   │   │   └── History.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── medications.js
│   │   │   ├── user.js
│   │   │   └── data.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── medicationController.js
│   │   │   ├── userController.js
│   │   │   └── dataController.js
│   │   ├── services/
│   │   │   └── stockScheduler.js
│   │   ├── utils/
│   │   │   ├── calculations.js
│   │   │   ├── uploads.js
│   │   │   └── validation.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   └── Register.jsx
│   │   │   ├── Medications/
│   │   │   │   ├── MedicationCard.jsx
│   │   │   │   ├── MedicationForm.jsx
│   │   │   │   ├── MedicationList.jsx
│   │   │   │   └── MedicationDetail.jsx
│   │   │   ├── Layout/
│   │   │   │   ├── Header.jsx
│   │   │   │   └── PrivateRoute.jsx
│   │   │   └── Common/
│   │   │       ├── Button.jsx
│   │   │       └── Input.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── auth.js
│   │   ├── utils/
│   │   │   ├── dateFormatter.js
│   │   │   └── tokenManager.js
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── MedicationDetailPage.jsx
│   │   │   └── CalendarPage.jsx
│   │   ├── App.jsx
│   │   └── index.js
│   ├── package.json
│   └── tailwind.config.js
├── Dockerfile
├── docker-compose.yml
├── compose.yaml
├── .dockerignore
└── README.md
```

## Datenbank-Schema

### Tabelle: users

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  dashboard_view TEXT DEFAULT 'grid',
  calendar_view TEXT DEFAULT 'dayGridMonth',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

CREATE INDEX idx_users_email ON users(email);
```

### Tabelle: medications

```sql
CREATE TABLE medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  dosage_morning REAL NOT NULL DEFAULT 0,
  dosage_noon REAL NOT NULL DEFAULT 0,
  dosage_evening REAL NOT NULL DEFAULT 0,
  tablets_per_package INTEGER NOT NULL,
  current_stock REAL NOT NULL DEFAULT 0,
  warning_threshold_days INTEGER NOT NULL DEFAULT 7,
  photo_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_stock_measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_medications_user ON medications(user_id);
```

### Tabelle: history

```sql
CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  old_stock REAL,
  new_stock REAL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_history_medication ON history(medication_id);
CREATE INDEX idx_history_user ON history(user_id);
```

## API-Endpunkte

### Authentifizierung (Öffentlich)

#### POST /api/auth/register
Registriert einen neuen Benutzer.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (201):**
```json
{
  "message": "Registrierung erfolgreich",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

**Validierung:**
- E-Mail: Gültiges Format, eindeutig
- Passwort: Mindestens 8 Zeichen

**Fehler:**
- 400: Validierungsfehler
- 409: E-Mail bereits registriert

#### POST /api/auth/login
Meldet einen Benutzer an.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

**Fehler:**
- 401: Ungültige Anmeldedaten
- 429: Zu viele Anfragen (Rate Limiting)

### Medikamente (Authentifiziert)

Alle folgenden Endpunkte benötigen den JWT-Token im Authorization-Header:
```
Authorization: Bearer <token>
```

#### GET /api/medications
Ruft alle Medikamente des eingeloggten Benutzers ab.

**Response (200):**
```json
{
  "medications": [
    {
      "id": 1,
      "name": "Aspirin",
      "dosage_morning": 1.0,
      "dosage_noon": 0.0,
      "dosage_evening": 1.0,
      "tablets_per_package": 20,
      "current_stock": 8.0,
      "warning_threshold_days": 7,
      "daily_consumption": 2.0,
      "days_remaining": 4.0,
      "depletion_date": "2025-11-20T00:00:00.000Z",
      "warning_status": "critical",
      "last_stock_measured_at": "2025-11-16T10:00:00.000Z",
      "photo_url": "/uploads/medications/abc123.jpg",
      "created_at": "2025-11-10T10:00:00.000Z",
      "updated_at": "2025-11-16T10:00:00.000Z"
    }
  ]
}
```

**Warning Status:**
- `good`: > 14 Tage
- `warning`: 7-14 Tage
- `critical`: < 7 Tage

#### POST /api/medications
Erstellt ein neues Medikament.

**Request Body:**
```json
{
  "name": "Vitamin D",
  "dosage_morning": 1.0,
  "dosage_noon": 0.0,
  "dosage_evening": 0.0,
  "tablets_per_package": 30,
  "current_stock": 30.0,
  "warning_threshold_days": 7
}
```

**Response (201):**
```json
{
  "medication": {
    "id": 2,
    "name": "Vitamin D",
    "dosage_morning": 1.0,
    "dosage_noon": 0.0,
    "dosage_evening": 0.0,
    "tablets_per_package": 30,
    "current_stock": 30.0,
    "warning_threshold_days": 7,
    "daily_consumption": 1.0,
    "days_remaining": 30.0,
    "depletion_date": "2025-12-16T00:00:00.000Z",
    "warning_status": "good"
  }
}
```

**Validierung:**
- name: Nicht leer, max 100 Zeichen
- dosage_morning, dosage_noon, dosage_evening: >= 0, max 10
- tablets_per_package: >= 1, max 1000
- current_stock: >= 0, max 10000
- warning_threshold_days: 1-30

#### GET /api/medications/:id
Ruft ein einzelnes Medikament ab.

**Response (200):**
```json
{
  "medication": {
    "id": 1,
    "name": "Aspirin",
    ...
  }
}
```

**Fehler:**
- 404: Medikament nicht gefunden oder gehört anderem Benutzer

#### PUT /api/medications/:id
Aktualisiert ein Medikament.

**Request Body:** (alle Felder optional)
```json
{
  "name": "Aspirin 500mg",
  "dosage_morning": 1.0,
  "dosage_evening": 0.5,
  "warning_threshold_days": 10
}
```

**Response (200):**
```json
{
  "medication": {
    "id": 1,
    "name": "Aspirin 500mg",
    ...
  }
}
```

#### DELETE /api/medications/:id
Löscht ein Medikament.

**Response (200):**
```json
{
  "message": "Medikament gelöscht"
}
```

#### POST /api/medications/:id/stock
Aktualisiert den Bestand eines Medikaments.

**Request Body:**
```json
{
  "action": "add_package",
  "amount": 20
}
```

**Oder:**
```json
{
  "action": "set_stock",
  "amount": 15.5
}
```

**Actions:**
- `add_package`: Fügt eine neue Packung hinzu (current_stock += amount)
- `set_stock`: Setzt Bestand auf spezifischen Wert

**Response (200):**
```json
{
  "medication": {
    "id": 1,
    "current_stock": 28.0,
    ...
  },
  "history_entry": {
    "id": 5,
    "action": "add_package",
    "old_stock": 8.0,
    "new_stock": 28.0,
    "timestamp": "2025-11-16T10:30:00.000Z"
  }
}
```

#### POST /api/medications/:id/photo
Lädt ein neues Foto für ein Medikament hoch (multipart/form-data).

**Form Field:** `photo`

**Response (200):**
```json
{
  "medication": {
    "id": 1,
    "photo_url": "/uploads/medications/abc123.jpg"
  }
}
```

#### DELETE /api/medications/:id/photo
Löscht das Foto eines Medikaments.

**Response (200):**
```json
{
  "medication": {
    "id": 1,
    "photo_url": null
  }
}
```

#### GET /api/medications/:id/history
Ruft die Verlaufshistorie eines Medikaments ab.

**Query Parameters:**
- `limit`: Anzahl der Einträge (default: 50, max: 200)

**Response (200):**
```json
{
  "history": [
    {
      "id": 5,
      "action": "add_package",
      "old_stock": 8.0,
      "new_stock": 28.0,
      "timestamp": "2025-11-16T10:30:00.000Z"
    },
    {
      "id": 4,
      "action": "set_stock",
      "old_stock": 10.0,
      "new_stock": 8.0,
      "timestamp": "2025-11-15T08:00:00.000Z"
    }
  ]
}
```

### Benutzerprofil (Authentifiziert)

#### GET /api/user/profile
Ruft das Profil des eingeloggten Benutzers ab.

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2025-11-01T10:00:00.000Z",
    "last_login": "2025-11-16T09:00:00.000Z"
  }
}
```

#### PUT /api/user/password
Ändert das Passwort des Benutzers.

**Request Body:**
```json
{
  "current_password": "oldPassword123",
  "new_password": "newSecurePassword456"
}
```

**Response (200):**
```json
{
  "message": "Passwort erfolgreich geändert"
}
```

**Fehler:**
- 401: Aktuelles Passwort falsch
- 400: Neues Passwort erfüllt Anforderungen nicht

#### GET /api/user/preferences
Ruft gespeicherte Anzeige-Präferenzen ab.

**Response (200):**
```json
{
  "preferences": {
    "dashboardView": "grid",
    "calendarView": "dayGridMonth"
  }
}
```

#### PUT /api/user/preferences
Speichert Anzeige-Präferenzen.

**Request Body:** (alle Felder optional)
```json
{
  "dashboardView": "list",
  "calendarView": "listMonth"
}
```

**Response (200):**
```json
{
  "preferences": {
    "dashboardView": "list",
    "calendarView": "listMonth"
  }
}
```

### Daten (Authentifiziert)

#### GET /api/data/export
Exportiert alle Benutzerdaten als JSON.

**Response (200):**
```json
{
  "data": {
    "user": { "email": "user@example.com" },
    "medications": [],
    "history": []
  }
}
```

#### POST /api/data/import
Importiert Daten aus einem zuvor exportierten JSON.

**Request Body:**
```json
{
  "data": { "...": "..." }
}
```

**Response (200):**
```json
{
  "message": "Import erfolgreich"
}
```

## Backend-Implementierung

### server.js

```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { initDatabase, getDatabase } = require('./config/database');
const { startStockScheduler, stopStockScheduler } = require('./services/stockScheduler');
const { ensureUploadDirs, uploadRoot } = require('./utils/uploads');
const authRoutes = require('./routes/auth');
const medicationRoutes = require('./routes/medications');
const userRoutes = require('./routes/user');
const dataRoutes = require('./routes/data');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json());
ensureUploadDirs();
app.use('/uploads', express.static(uploadRoot));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/user', userRoutes);
app.use('/api/data', dataRoutes);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Fallback route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Interner Serverfehler'
  });
});

// Health endpoint
app.get('/health', async (req, res) => {
  try {
    const db = getDatabase();
    await db.get('SELECT 1 as ok');
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', detail: err.message });
  }
});

// Initialize database and start server
initDatabase()
  .then(() => {
    if (process.env.ENABLE_STOCK_SCHEDULER !== 'false') {
      startStockScheduler();
    }
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server läuft auf Port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Fehler beim Initialisieren der Datenbank:', err);
    process.exit(1);
  });

process.on('SIGTERM', () => {
  stopStockScheduler();
  process.exit(0);
});

process.on('SIGINT', () => {
  stopStockScheduler();
  process.exit(0);
});
```

### config/database.js

```javascript
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db = null;

async function initDatabase() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/tabletto.db');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON');

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      dashboard_view TEXT DEFAULT 'grid',
      calendar_view TEXT DEFAULT 'dayGridMonth',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      dosage_morning REAL NOT NULL DEFAULT 0,
      dosage_noon REAL NOT NULL DEFAULT 0,
      dosage_evening REAL NOT NULL DEFAULT 0,
      tablets_per_package INTEGER NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0,
      warning_threshold_days INTEGER NOT NULL DEFAULT 7,
      photo_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_stock_measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_medications_user ON medications(user_id);

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_stock REAL,
      new_stock REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_history_medication ON history(medication_id);
    CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id);
  `);

  console.log('Datenbank initialisiert');
  return db;
}

function getDatabase() {
  if (!db) {
    throw new Error('Datenbank nicht initialisiert');
  }
  return db;
}

module.exports = { initDatabase, getDatabase };
```

### middleware/auth.js

```javascript
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Kein Token vorhanden' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Ungültiger Token' });
    }
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
```

### middleware/rateLimiter.js

```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 5, // max 5 Anfragen
  message: { error: 'Zu viele Anfragen, bitte später erneut versuchen' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter };
```

### utils/calculations.js

```javascript
function calculateMedicationStats(medication) {
  const dailyConsumption = (medication.dosage_morning || 0)
    + (medication.dosage_noon || 0)
    + (medication.dosage_evening || 0);
  
  if (dailyConsumption === 0) {
    return {
      daily_consumption: 0,
      days_remaining: Infinity,
      depletion_date: null,
      warning_status: 'good',
      last_stock_measured_at: medication.last_stock_measured_at
    };
  }

  const daysRemaining = medication.current_stock / dailyConsumption;
  
  const depletionDate = new Date();
  depletionDate.setDate(depletionDate.getDate() + Math.floor(daysRemaining));

  let warningStatus = 'good';
  if (daysRemaining < 0) {
    warningStatus = 'critical';
  } else if (daysRemaining < medication.warning_threshold_days) {
    warningStatus = 'critical';
  } else if (daysRemaining < 14) {
    warningStatus = 'warning';
  }

  return {
    daily_consumption: dailyConsumption,
    days_remaining: daysRemaining,
    depletion_date: depletionDate.toISOString(),
    warning_status: warningStatus,
    last_stock_measured_at: medication.last_stock_measured_at
  };
}

module.exports = { calculateMedicationStats };
```

### utils/validation.js

```javascript
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePassword(password) {
  return password && password.length >= 8;
}

function validateMedication(data) {
  const errors = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name ist erforderlich');
  } else if (data.name.length > 100) {
    errors.push('Name darf maximal 100 Zeichen lang sein');
  }

  if (data.dosage_morning < 0 || data.dosage_morning > 10) {
    errors.push('Morgens-Dosierung muss zwischen 0 und 10 liegen');
  }

  if (data.dosage_noon < 0 || data.dosage_noon > 10) {
    errors.push('Mittags-Dosierung muss zwischen 0 und 10 liegen');
  }

  if (data.dosage_evening < 0 || data.dosage_evening > 10) {
    errors.push('Abends-Dosierung muss zwischen 0 und 10 liegen');
  }

  if (data.tablets_per_package < 1 || data.tablets_per_package > 1000) {
    errors.push('Packungsgröße muss zwischen 1 und 1000 liegen');
  }


  if (data.current_stock < 0 || data.current_stock > 10000) {
    errors.push('Aktueller Bestand muss zwischen 0 und 10000 liegen');
  }

  if (data.warning_threshold_days < 1 || data.warning_threshold_days > 30) {
    errors.push('Warngrenze muss zwischen 1 und 30 Tagen liegen');
  }

  return errors;
}

module.exports = { validateEmail, validatePassword, validateMedication };
```

## Frontend-Implementierung

### services/api.js

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const headers = {
      ...(options.headers || {})
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ein Fehler ist aufgetreten');
    }

    return response.json();
  }

  // Auth
  async register(email, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    return data;
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  // Medications
  async getMedications() {
    return this.request('/medications');
  }

  async getMedication(id) {
    return this.request(`/medications/${id}`);
  }

  async createMedication(medicationData) {
    return this.request('/medications', {
      method: 'POST',
      body: JSON.stringify(medicationData),
    });
  }

  async createMedicationWithPhoto(data, photoFile) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    if (photoFile) {
      formData.append('photo', photoFile);
    }
    return this.request('/medications', {
      method: 'POST',
      body: formData
    });
  }

  async updateMedication(id, medicationData) {
    return this.request(`/medications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(medicationData),
    });
  }

  async deleteMedication(id) {
    return this.request(`/medications/${id}`, {
      method: 'DELETE',
    });
  }

  async updateStock(id, action, amount) {
    return this.request(`/medications/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify({ action, amount }),
    });
  }

  async getMedicationHistory(id, limit = 50) {
    return this.request(`/medications/${id}/history?limit=${limit}`);
  }

  async uploadMedicationPhoto(id, photoFile) {
    const formData = new FormData();
    formData.append('photo', photoFile);
    return this.request(`/medications/${id}/photo`, {
      method: 'POST',
      body: formData
    });
  }

  async deleteMedicationPhoto(id) {
    return this.request(`/medications/${id}/photo`, {
      method: 'DELETE'
    });
  }

  // User
  async getProfile() {
    return this.request('/user/profile');
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/user/password', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  }

  async getPreferences() {
    return this.request('/user/preferences');
  }

  async updatePreferences(preferences) {
    return this.request('/user/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences)
    });
  }
}

export default new ApiService();
```

### components/Layout/PrivateRoute.jsx

```jsx
import { Navigate } from 'react-router-dom';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

export default PrivateRoute;
```

### App.jsx (React Router Setup)

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CalendarPage from './pages/CalendarPage';
import MedicationDetailPage from './pages/MedicationDetailPage';
import PrivateRoute from './components/Layout/PrivateRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <PrivateRoute>
              <CalendarPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/medication/:id"
          element={
            <PrivateRoute>
              <MedicationDetailPage />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

## Docker-Setup

### Dockerfile

```dockerfile
# Multi-stage Dockerfile: builds frontend and backend, produces a small runtime image
FROM node:18-bullseye AS builder

WORKDIR /app

# Install build tools for native modules and copy backend deps
RUN apt-get update && apt-get install -y python3 build-essential libsqlite3-dev curl && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy frontend package files and install deps, then build
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Copy backend source (after installing deps to leverage layer caching)
COPY backend/ ./backend/

# Production image
FROM node:18-bullseye-slim

WORKDIR /app

# Copy backend (with installed node_modules from builder)
COPY --from=builder /app/backend /app/backend

# Copy frontend build output
COPY --from=builder /app/frontend/build /app/frontend/build

# Create data directory for SQLite DB
RUN mkdir -p /app/data
RUN apt-get update && apt-get install -y curl gosu && rm -rf /var/lib/apt/lists/*

# Create a non-root user for running the app (Debian-compatible)
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /usr/sbin/nologin appuser || true

# Copy entrypoint script that will chown and drop privileges
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/tabletto.db

EXPOSE 3000

WORKDIR /app/backend

# Use entrypoint to ensure /app/data is owned by appuser,
# then drop privileges and run as appuser for security
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
```

### compose.yaml

```yaml
services:
  tabletto:
    build: .
    container_name: tabletto-app
    ports:
      - "3000:3000"
    # Use a named volume for production-stable DB storage. For local dev, you can
    # replace with a bind mount: ./data:/app/data
    volumes:
      - tabletto-data:/app/data
    environment:
      - JWT_SECRET=${JWT_SECRET:-change-this-secret-key-in-production}
      - NODE_ENV=production
      - PORT=3000
      - DB_PATH=/app/data/tabletto.db
      - ENABLE_STOCK_SCHEDULER=${ENABLE_STOCK_SCHEDULER:-true}
      - STOCK_SCHEDULER_CRON=${STOCK_SCHEDULER_CRON:-0 2 * * *}
      - UPLOADS_PATH=${UPLOADS_PATH:-/app/data/uploads}
      - TZ=${TZ:-Europe/Berlin}
    restart: unless-stopped

volumes:
  tabletto-data:
    driver: local
```

### .dockerignore

```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.DS_Store
data
*.db
```

### .env.example

```
# JWT Secret Key (WICHTIG: In Produktion ändern!)
JWT_SECRET=your-very-secure-secret-key-here

# Server Port
PORT=3000

# Database Path
DB_PATH=/app/data/tabletto.db

# Node Environment
NODE_ENV=production

# Stock Scheduler Configuration
ENABLE_STOCK_SCHEDULER=true
STOCK_SCHEDULER_CRON=0 2 * * *
TZ=Europe/Berlin

# Uploads
UPLOADS_PATH=/app/data/uploads
```

## Deployment-Anleitung

### 1. Repository klonen oder Dateien erstellen

```bash
mkdir tabletto
cd tabletto
```

### 2. Umgebungsvariablen setzen

```bash
cp .env.example .env
# JWT_SECRET in .env mit sicherem Wert ersetzen
```

### 3. Docker Image bauen

```bash
docker compose build
```

### 4. Container starten

```bash
docker compose up -d
```

Hinweis: Die `compose.yaml` verwendet einen benannten Volume `tabletto-data` für die SQLite-Datei.
Für lokale Entwicklung kannst du alternativ `./data:/app/data` als Bind-Mount aktivieren (siehe `compose.yaml`).

Der Container stellt außerdem einen Health-Endpoint unter `GET /health` bereit. Docker prüft diesen Endpunkt automatisch und markiert den Container als unhealthy, falls er nicht erreichbar ist.

Hinweis zu `package-lock.json`:

Für reproduzierbare Builds ist es empfohlen, die `package-lock.json` für `backend` und `frontend` zu committen. Erzeuge sie lokal mit:

```bash
cd backend && npm install
cd ../frontend && npm install
```

und committe dann die entstandenen `package-lock.json` Dateien.

Es gibt eine GitHub Actions CI (`.github/workflows/ci.yml`), die beim Push die Installation, den Frontend-Build und den Docker-Build durchführt. Optional kann die Workflow-Action das Image in ein Container-Registry pushen, wenn die Secrets `DOCKER_USERNAME`, `DOCKER_PASSWORD` und `DOCKER_REGISTRY` gesetzt sind.

### 5. Logs prüfen

```bash
docker compose logs -f
```

### 6. Testen

```bash
curl http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234"}'
```

## Sicherheitshinweise

1. **JWT_SECRET**: MUSS in Produktion durch einen sicheren, zufälligen String ersetzt werden
2. **HTTPS**: In Produktion sollte die App hinter einem Reverse Proxy mit HTTPS laufen
3. **Backups**: Regelmäßige Backups der SQLite-Datenbank unter `/app/data/tabletto.db`
4. **Updates**: Regelmäßige Updates der Dependencies durchführen

## Entwicklung

### Backend lokal ausführen

```bash
cd backend
npm install
npm run dev
```

### Frontend lokal ausführen

```bash
cd frontend
npm install
npm run dev
```

### Tests ausführen

```bash
# Derzeit sind keine automatischen Tests konfiguriert.
```

## Wartung

### Backup erstellen

```bash
# innerhalb des Containers ein Backup erstellen
docker exec tabletto-app node /app/backend/scripts/backup.js

# Backup-Datei auf den Host kopieren
docker cp tabletto-app:/app/data/backups/ ./backups
```

### Logs einsehen

```bash
docker compose logs -f tabletto-app
```

### Container neu starten

```bash
docker compose restart
```

### Datenbank zurücksetzen (VORSICHT!)

```bash
docker compose down
rm -rf data/tabletto.db
docker compose up -d
```
