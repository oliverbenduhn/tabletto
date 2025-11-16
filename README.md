# tabletto
Kleines Tool zur Verwaltung der eigenen Medikamente
# Medikamenten-Verwaltungssystem - Technische Spezifikation

## Projekt-Übersicht

Ein Webbasiertes System zur Verwaltung von Medikamentenbeständen mit Benutzerauthentifizierung, Verbrauchsberechnung und Warnungen bei niedrigem Bestand.

## Technologie-Stack

- **Backend**: Node.js, Express.js, SQLite
- **Frontend**: React, Tailwind CSS
- **Authentifizierung**: JWT, bcrypt
- **Deployment**: Docker Container (Port 3000)

## Projektstruktur

```
medikamente-app/
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
│   │   │   └── user.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── medicationController.js
│   │   │   └── userController.js
│   │   ├── utils/
│   │   │   ├── calculations.js
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
│   │   │   └── MedicationDetailPage.jsx
│   │   ├── App.jsx
│   │   └── index.js
│   ├── package.json
│   └── tailwind.config.js
├── Dockerfile
├── docker-compose.yml
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
  dosage_evening REAL NOT NULL DEFAULT 0,
  tablets_per_package INTEGER NOT NULL,
  current_stock REAL NOT NULL DEFAULT 0,
  warning_threshold_days INTEGER NOT NULL DEFAULT 7,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      "dosage_evening": 1.0,
      "tablets_per_package": 20,
      "current_stock": 8.0,
      "warning_threshold_days": 7,
      "daily_consumption": 2.0,
      "days_remaining": 4.0,
      "depletion_date": "2025-11-20T00:00:00.000Z",
      "warning_status": "critical",
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
- dosage_morning, dosage_evening: >= 0, max 10
- tablets_per_package: > 0, max 1000
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
  "tablets_per_package": 20,
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
- `add_package`: Fügt eine neue Packung hinzu (current_stock += tablets_per_package)
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

## Backend-Implementierung

### server.js

```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./config/database');
const authRoutes = require('./routes/auth');
const medicationRoutes = require('./routes/medications');
const userRoutes = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/user', userRoutes);

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

// Initialize database and start server
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
```

### config/database.js

```javascript
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db = null;

async function initDatabase() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/medikamente.db');
  
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      dosage_morning REAL NOT NULL DEFAULT 0,
      dosage_evening REAL NOT NULL DEFAULT 0,
      tablets_per_package INTEGER NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0,
      warning_threshold_days INTEGER NOT NULL DEFAULT 7,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Kein Token vorhanden' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
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
  const dailyConsumption = medication.dosage_morning + medication.dosage_evening;
  
  if (dailyConsumption === 0) {
    return {
      daily_consumption: 0,
      days_remaining: Infinity,
      depletion_date: null,
      warning_status: 'good'
    };
  }

  const daysRemaining = medication.current_stock / dailyConsumption;
  
  const depletionDate = new Date();
  depletionDate.setDate(depletionDate.getDate() + Math.floor(daysRemaining));

  let warningStatus = 'good';
  if (daysRemaining < medication.warning_threshold_days) {
    warningStatus = 'critical';
  } else if (daysRemaining < 14) {
    warningStatus = 'warning';
  }

  return {
    daily_consumption: dailyConsumption,
    days_remaining: daysRemaining,
    depletion_date: depletionDate.toISOString(),
    warning_status: warningStatus
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

  if (data.dosage_evening < 0 || data.dosage_evening > 10) {
    errors.push('Abends-Dosierung muss zwischen 0 und 10 liegen');
  }

  if (data.tablets_per_package <= 0 || data.tablets_per_package > 1000) {
    errors.push('Tabletten pro Packung muss zwischen 1 und 1000 liegen');
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
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

class ApiService {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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
# Build Stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Install frontend dependencies and build
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Production Stage
FROM node:18-alpine

WORKDIR /app

# Copy backend
COPY --from=builder /app/backend ./backend
COPY backend/src ./backend/src

# Copy frontend build
COPY --from=builder /app/frontend/build ./frontend/build

# Create data directory
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/medikamente.db

EXPOSE 3000

WORKDIR /app/backend

CMD ["node", "src/server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  medikamente-app:
    build: .
    container_name: medikamente-verwaltung
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - JWT_SECRET=${JWT_SECRET:-change-this-secret-key-in-production}
      - NODE_ENV=production
      - PORT=3000
      - DB_PATH=/app/data/medikamente.db
    restart: unless-stopped
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
DB_PATH=/app/data/medikamente.db

# Node Environment
NODE_ENV=production
```

## Deployment-Anleitung

### 1. Repository klonen oder Dateien erstellen

```bash
mkdir medikamente-app
cd medikamente-app
```

### 2. Umgebungsvariablen setzen

```bash
cp .env.example .env
# JWT_SECRET in .env mit sicherem Wert ersetzen
```

### 3. Docker Image bauen

```bash
docker-compose build
```

### 4. Container starten

```bash
docker-compose up -d
```

Hinweis: Die `docker-compose.yml` verwendet einen benannten Volume `med-data` für die SQLite-Datei.
Für lokale Entwicklung kannst du alternativ `./data:/app/data` als Bind-Mount aktivieren (siehe `docker-compose.yml`).

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
docker-compose logs -f
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
3. **Backups**: Regelmäßige Backups der SQLite-Datenbank unter `/app/data/medikamente.db`
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
npm start
```

### Tests ausführen

```bash
# Backend Tests
cd backend
npm test

# Frontend Tests
cd frontend
npm test
```

## Wartung

### Backup erstellen

```bash
docker exec medikamente-verwaltung sqlite3 /app/data/medikamente.db ".backup /app/data/backup.db"
docker cp medikamente-verwaltung:/app/data/backup.db ./backup-$(date +%Y%m%d).db
```

### Logs einsehen

```bash
docker-compose logs -f medikamente-app
```

### Container neu starten

```bash
docker-compose restart
```

### Datenbank zurücksetzen (VORSICHT!)

```bash
docker-compose down
rm -rf data/medikamente.db
docker-compose up -d
```
