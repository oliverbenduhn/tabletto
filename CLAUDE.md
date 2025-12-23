# CLAUDE.md - AI Assistant Guide for Tabletto

This document provides comprehensive guidance for AI assistants working with the Tabletto codebase. Last updated: 2025-11-23

## Table of Contents

1. [Project Overview](#project-overview)
2. [Repository Structure](#repository-structure)
3. [Technology Stack](#technology-stack)
4. [Development Workflows](#development-workflows)
5. [Code Conventions](#code-conventions)
6. [API Architecture](#api-architecture)
7. [Database Schema](#database-schema)
8. [Key Files Reference](#key-files-reference)
9. [Common Tasks](#common-tasks)
10. [Testing & Quality](#testing--quality)
11. [Deployment](#deployment)
12. [Security Considerations](#security-considerations)

---

## Project Overview

**Tabletto** is a web-based medication management system with the following core features:

- **User Authentication**: JWT-based authentication with bcrypt password hashing
- **Medication Tracking**: Track medication inventory, dosage schedules, and consumption
- **Stock Management**: Monitor current stock levels with automatic depletion calculations
- **Warning System**: Alert users when medication stock is running low
- **History Tracking**: Maintain audit logs of all stock changes

**Target Users**: Individuals managing personal medication regimens
**Language**: German (UI, error messages, and documentation)
**Deployment**: Docker containerized application on port 3000

---

## Repository Structure

```
tabletto/
├── backend/                    # Node.js/Express API server
│   ├── src/
│   │   ├── config/            # Database and JWT configuration
│   │   │   ├── database.js    # SQLite setup and schema
│   │   │   └── jwt.js         # JWT configuration
│   │   ├── middleware/        # Express middleware
│   │   │   ├── auth.js        # JWT authentication middleware
│   │   │   └── rateLimiter.js # Rate limiting for auth endpoints
│   │   ├── models/            # Data models
│   │   │   ├── User.js        # User model
│   │   │   ├── Medication.js  # Medication model
│   │   │   └── History.js     # History/audit log model
│   │   ├── routes/            # Express route definitions
│   │   │   ├── auth.js        # Authentication routes
│   │   │   ├── medications.js # Medication CRUD routes
│   │   │   └── user.js        # User profile routes
│   │   ├── controllers/       # Route handlers/business logic
│   │   │   ├── authController.js
│   │   │   ├── medicationController.js
│   │   │   └── userController.js
│   │   ├── utils/             # Utility functions
│   │   │   ├── calculations.js # Medication stats calculations
│   │   │   └── validation.js   # Input validation helpers
│   │   └── server.js          # Main application entry point
│   ├── scripts/
│   │   └── backup.js          # Database backup utility
│   └── package.json           # Backend dependencies (CommonJS)
│
├── frontend/                   # React frontend (Vite)
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── Auth/          # Login, Register components
│   │   │   ├── Medications/   # Medication list, card, form, detail
│   │   │   ├── Dashboard/     # Dashboard-specific components
│   │   │   ├── Layout/        # Header, PrivateRoute
│   │   │   └── Common/        # Reusable UI components (Button, Input, etc.)
│   │   ├── pages/             # Page-level components
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   └── MedicationDetailPage.jsx
│   │   ├── services/          # API service layer
│   │   │   └── api.js         # Centralized API client
│   │   ├── utils/             # Frontend utilities
│   │   ├── App.jsx            # Main app component with routing
│   │   └── index.jsx          # Application entry point
│   ├── vite.config.js         # Vite build configuration
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   └── package.json           # Frontend dependencies (ES modules)
│
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI pipeline
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Docker Compose orchestration
├── .env.example               # Environment variables template
├── .dockerignore              # Docker build exclusions
└── README.md                  # Comprehensive project documentation
```

---

## Technology Stack

### Backend
- **Runtime**: Node.js 18
- **Framework**: Express.js 4.x
- **Database**: SQLite 3 (via `sqlite` and `sqlite3` packages)
- **Authentication**: JWT (jsonwebtoken) + bcryptjs
- **Security**: express-rate-limit, CORS middleware
- **Module System**: CommonJS (`require`/`module.exports`)

### Frontend
- **Framework**: React 18.3
- **Build Tool**: Vite 6.x
- **Routing**: React Router DOM v6
- **Styling**: Tailwind CSS 3.x with PostCSS
- **Module System**: ES Modules (`import`/`export`)
- **Environment Variables**: Vite env vars (prefix: `VITE_`)

### DevOps
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose
- **CI/CD**: GitHub Actions
- **Development**: nodemon (backend), Vite dev server (frontend)

---

## Development Workflows

### Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd tabletto

# Setup environment variables
cp .env.example .env
# Edit .env and set JWT_SECRET to a secure random string

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
```

### Local Development

#### Backend Development
```bash
cd backend
npm run dev  # Starts nodemon on port 3000
```

#### Frontend Development
```bash
cd frontend
npm run dev  # Starts Vite dev server (typically port 5173)
```

**Note**: For local development, configure `VITE_API_URL=http://localhost:3000/api` in frontend `.env` file.

### Docker Development

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Rebuild after code changes
docker-compose up -d --build

# Stop containers
docker-compose down
```

### Database Management

```bash
# Backup database
docker exec tabletto-app node /app/backend/scripts/backup.js
# Or manually:
docker exec tabletto-app sqlite3 /app/data/tabletto.db ".backup /app/data/backup.db"
docker cp tabletto-app:/app/data/backup.db ./backup-$(date +%Y%m%d).db

# Reset database (DESTRUCTIVE!)
docker-compose down
rm -rf data/tabletto.db
docker-compose up -d
```

---

## Code Conventions

### General Principles

1. **Language**: All user-facing text, error messages, and comments in German
2. **File Naming**:
   - Backend: camelCase (e.g., `authController.js`)
   - Frontend: PascalCase for components (e.g., `MedicationCard.jsx`)
3. **Code Style**:
   - Use 2-space indentation
   - Semicolons optional but be consistent within files
   - Modern JavaScript (ES6+ features encouraged)

### Backend Conventions

#### Module Pattern
```javascript
// Models: Export object with methods
const User = {
  async findByEmail(email) { /* ... */ },
  async create(userData) { /* ... */ }
};
module.exports = User;

// Controllers: Export named functions
async function getMedications(req, res) { /* ... */ }
module.exports = { getMedications, createMedication };

// Routes: Use Express Router
const router = require('express').Router();
router.get('/', controller.getMedications);
module.exports = router;
```

#### Error Handling
```javascript
// Controllers should return appropriate HTTP status codes
if (!medication) {
  return res.status(404).json({ error: 'Medikament nicht gefunden' });
}

// Validation errors: 400
// Authentication errors: 401
// Authorization errors: 403
// Not found: 404
// Server errors: 500
```

#### Database Queries
```javascript
// Use prepared statements to prevent SQL injection
const db = getDatabase();
await db.get('SELECT * FROM users WHERE email = ?', [email]);
await db.run('UPDATE medications SET stock = ? WHERE id = ?', [stock, id]);
```

#### Middleware Usage
```javascript
// Auth middleware: req.user populated with JWT payload
const { authenticateToken } = require('../middleware/auth');
router.get('/medications', authenticateToken, controller.getMedications);

// Rate limiting: Apply to auth routes only
const { authLimiter } = require('../middleware/rateLimiter');
router.post('/login', authLimiter, controller.login);
```

### Frontend Conventions

#### Component Structure
```jsx
// Functional components with hooks
import { useState, useEffect } from 'react';
import api from '@/services/api'; // Use @ alias for src/

function MedicationCard({ medication, onUpdate }) {
  const [loading, setLoading] = useState(false);

  // JSX with Tailwind classes
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Component content */}
    </div>
  );
}

export default MedicationCard;
```

#### API Calls
```javascript
// Use centralized API service (src/services/api.js)
import api from '@/services/api';

// All API methods return promises
try {
  const { medications } = await api.getMedications();
  setMedications(medications);
} catch (error) {
  console.error('Fehler beim Laden:', error.message);
}
```

#### State Management
- **Local state**: `useState` for component-specific state
- **Auth state**: Stored in localStorage (`token`, `user`)
- **No global state library**: Keep it simple with prop drilling or context when needed

#### Routing
```jsx
// Protected routes wrapped with PrivateRoute component
<Route
  path="/dashboard"
  element={
    <PrivateRoute>
      <DashboardPage />
    </PrivateRoute>
  }
/>
```

### Styling Conventions

#### Tailwind CSS Usage
- **Responsive**: Use `sm:`, `md:`, `lg:` breakpoint prefixes
- **Colors**: Consistent color scheme (green for good, yellow for warning, red for critical)
- **Spacing**: Use Tailwind spacing scale (p-4, m-2, gap-4, etc.)
- **Components**: Extract repeated patterns into component files

#### Status Colors
```javascript
// Warning status color mapping
const statusColors = {
  good: 'bg-green-100 text-green-800',      // > 14 days
  warning: 'bg-yellow-100 text-yellow-800',  // 7-14 days
  critical: 'bg-red-100 text-red-800'        // < 7 days
};
```

---

## API Architecture

### Authentication Flow

1. **Registration**: POST `/api/auth/register`
   - Validates email format and password length (min 8 chars)
   - Hashes password with bcrypt
   - Returns user object (no auto-login)

2. **Login**: POST `/api/auth/login`
   - Rate limited: 5 requests per minute
   - Validates credentials
   - Returns JWT token (expires in 7 days by default)
   - Updates `last_login` timestamp

3. **Protected Routes**:
   - Require `Authorization: Bearer <token>` header
   - Middleware validates token and populates `req.user`

### Medication Calculations

The backend enriches medication data with calculated fields:

```javascript
// From utils/calculations.js
{
  daily_consumption: dosage_morning + dosage_evening,
  days_remaining: current_stock / daily_consumption,
  depletion_date: new Date() + days_remaining,
  warning_status: 'good' | 'warning' | 'critical'
}
```

**Warning Status Rules**:
- `good`: > 14 days remaining
- `warning`: 7-14 days remaining
- `critical`: < warning_threshold_days (default 7)
- If daily_consumption = 0: infinite days, status = 'good'

### Stock Update Actions

POST `/api/medications/:id/stock` supports two actions:

1. **add_package**: Adds one full package
   ```json
   {
     "action": "add_package",
     "amount": <tablets_per_package>
   }
   ```
   Result: `current_stock += tablets_per_package`

2. **set_stock**: Sets absolute stock value
   ```json
   {
     "action": "set_stock",
     "amount": 15.5
   }
   ```
   Result: `current_stock = amount`

Both actions create history entries with old/new stock values.

---

## Database Schema

### Tables

#### users
```sql
id                INTEGER PRIMARY KEY AUTOINCREMENT
email             TEXT UNIQUE NOT NULL
password_hash     TEXT NOT NULL
created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
last_login        DATETIME
```

#### medications
```sql
id                      INTEGER PRIMARY KEY AUTOINCREMENT
user_id                 INTEGER NOT NULL (FK -> users.id)
name                    TEXT NOT NULL
dosage_morning          REAL NOT NULL DEFAULT 0
dosage_evening          REAL NOT NULL DEFAULT 0
tablets_per_package     INTEGER NOT NULL
current_stock           REAL NOT NULL DEFAULT 0
warning_threshold_days  INTEGER NOT NULL DEFAULT 7
created_at              DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### history
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
medication_id   INTEGER NOT NULL (FK -> medications.id)
user_id         INTEGER NOT NULL (FK -> users.id)
action          TEXT NOT NULL ('add_package' | 'set_stock')
old_stock       REAL
new_stock       REAL
timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP
```

### Database Configuration

- **Location**: `/app/data/tabletto.db` (in container)
- **Foreign Keys**: Enabled (`PRAGMA foreign_keys = ON`)
- **Cascade Deletes**: Deleting a user deletes all their medications and history
- **Indexes**: Created on email, user_id, medication_id for performance

---

## Key Files Reference

### Backend Core Files

#### `backend/src/server.js`
- Express app initialization
- Route mounting (`/api/auth`, `/api/medications`, `/api/user`)
- Static file serving for frontend build
- Health check endpoint at `/health`
- Global error handler middleware
- Database initialization and server startup

#### `backend/src/config/database.js`
- SQLite database connection management
- Schema creation (tables, indexes)
- Exports: `initDatabase()`, `getDatabase()`

#### `backend/src/middleware/auth.js`
- `authenticateToken()`: Validates JWT, populates `req.user`
- Responds with 401 if no token, 403 if invalid

#### `backend/src/utils/calculations.js`
- `calculateMedicationStats(medication)`: Core business logic
- Computes daily consumption, days remaining, depletion date, warning status

#### `backend/src/utils/validation.js`
- Input validation functions
- `validateEmail()`, `validatePassword()`, `validateMedication()`
- Returns array of error messages (empty = valid)

### Frontend Core Files

#### `frontend/src/App.jsx`
- React Router setup
- Route definitions (/, /login, /register, /dashboard, /medication/:id)
- PrivateRoute wrapper for authenticated routes

#### `frontend/src/services/api.js`
- Centralized API client singleton
- Handles JWT token injection
- Manages localStorage for auth state
- All API methods (register, login, getMedications, etc.)

#### `frontend/src/components/Layout/PrivateRoute.jsx`
- Route guard component
- Redirects to /login if no token in localStorage

#### `frontend/vite.config.js`
- Vite configuration
- Build output directory: `build` (not default `dist`)
- Path alias: `@` -> `./src`

### Configuration Files

#### `.env.example`
```bash
JWT_SECRET=your-very-secure-secret-key-here
PORT=3000
DB_PATH=/app/data/tabletto.db
NODE_ENV=production
```

#### `docker-compose.yml`
- Single service: `tabletto`
- Port mapping: 3000:3000
- Named volume: `tabletto-data` for persistence
- Health check: `/health` endpoint every 30s
- Environment variables from .env file

#### `.github/workflows/ci.yml`
- Runs on push/PR to main branch
- Steps: Install deps, run tests, build frontend, build Docker image
- Optional: Push to registry if Docker secrets configured

---

## Common Tasks

### Adding a New API Endpoint

1. **Create controller function** in `backend/src/controllers/`
   ```javascript
   async function newEndpoint(req, res) {
     // Implementation
   }
   module.exports = { ..., newEndpoint };
   ```

2. **Add route** in appropriate route file
   ```javascript
   const { authenticateToken } = require('../middleware/auth');
   router.post('/new-endpoint', authenticateToken, controller.newEndpoint);
   ```

3. **Add API method** in `frontend/src/services/api.js`
   ```javascript
   async newEndpoint(data) {
     return this.request('/endpoint', {
       method: 'POST',
       body: JSON.stringify(data)
     });
   }
   ```

### Adding a New Model

1. Create file in `backend/src/models/ModelName.js`
2. Implement database query methods
3. Export object with methods
4. Update database schema if new table needed (in `config/database.js`)

### Adding a New React Component

1. Create component file in appropriate `frontend/src/components/` subdirectory
2. Use functional component pattern with hooks
3. Import and use in parent component or page
4. Apply Tailwind classes for styling

### Adding Database Migration

Since this uses SQLite with `CREATE TABLE IF NOT EXISTS`, schema changes should:

1. Update `backend/src/config/database.js` with new schema
2. For existing databases, consider:
   - Adding columns with ALTER TABLE (backward compatible)
   - Creating migration script in `backend/scripts/`
   - Documenting breaking changes

### Environment Variable Changes

1. Update `.env.example` with new variable
2. Update `docker-compose.yml` environment section if needed
3. Use in backend: `process.env.VAR_NAME`
4. Use in frontend: `import.meta.env.VITE_VAR_NAME` (must start with VITE_)

---

## Testing & Quality

### Current State

- **Backend**: Test placeholder exists (`npm test` exits 0)
- **Frontend**: No tests configured yet
- **CI**: Runs test commands but allows failures

### Testing Recommendations

#### Backend Testing
- Use Jest or Mocha for unit tests
- Test controllers with mocked database
- Test models with in-memory SQLite
- Test middleware in isolation
- Integration tests for API endpoints

#### Frontend Testing
- Use Vitest (Vite's test runner) or Jest
- React Testing Library for component tests
- Mock API service for isolated component tests
- E2E tests with Playwright or Cypress

### Manual Testing

```bash
# Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234"}'

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234"}'

# Test protected endpoint (replace TOKEN)
curl http://localhost:3000/api/medications \
  -H "Authorization: Bearer TOKEN"

# Test health endpoint
curl http://localhost:3000/health
```

---

## Deployment

### Docker Production Deployment

```bash
# 1. Prepare environment
cp .env.example .env
# Edit .env with secure JWT_SECRET

# 2. Build and start
docker-compose up -d --build

# 3. Verify health
curl http://localhost:3000/health

# 4. Check logs
docker-compose logs -f tabletto
```

### Multi-Stage Build Process

The Dockerfile uses a two-stage build:

1. **Builder stage**:
   - Installs all dependencies
   - Builds frontend (Vite creates optimized bundle)

2. **Production stage**:
   - Copies built artifacts only
   - Production dependencies only
   - Minimal image size

### Persistence

- Database stored in Docker volume `tabletto-data`
- For local development, can use bind mount: `./data:/app/data`
- **Important**: Back up the volume regularly!

### Reverse Proxy Setup (Production)

Use nginx or Caddy in front of the container:

```nginx
# Example nginx config
server {
  listen 80;
  server_name tabletto.example.com;

  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

Enable HTTPS with Let's Encrypt for production deployments.

---

## Security Considerations

### Critical Security Practices

1. **JWT_SECRET**:
   - MUST be changed from default in production
   - Use long, random string (32+ characters)
   - Never commit to version control

2. **Password Hashing**:
   - bcryptjs with default salt rounds (10)
   - Never store plaintext passwords
   - Password requirements: minimum 8 characters

3. **SQL Injection Prevention**:
   - All database queries use parameterized statements
   - Never concatenate user input into SQL strings

4. **Rate Limiting**:
   - Auth endpoints limited to 5 requests/minute
   - Prevents brute force attacks
   - Consider adding to other sensitive endpoints

5. **CORS Configuration**:
   - Default: Allow all origins (`*`)
   - Production: Set `FRONTEND_ORIGIN` env var to specific domain

6. **JWT Expiration**:
   - Tokens expire after 7 days (configurable in `config/jwt.js`)
   - Frontend should handle 403 errors and redirect to login

7. **Input Validation**:
   - Server-side validation is mandatory
   - Frontend validation is UX enhancement only
   - Validate all user inputs before database operations

### Security Checklist for Production

- [ ] Change JWT_SECRET to secure random value
- [ ] Enable HTTPS via reverse proxy
- [ ] Configure CORS to specific origin
- [ ] Set up regular database backups
- [ ] Monitor logs for suspicious activity
- [ ] Keep dependencies updated (npm audit)
- [ ] Disable Node.js debug mode
- [ ] Review rate limiting configuration
- [ ] Implement HTTPS-only cookies if using sessions
- [ ] Add security headers (Helmet.js recommended)

---

## Best Practices for AI Assistants

### When Reading Code

1. **Check module system**: Backend uses CommonJS, frontend uses ES modules
2. **Verify file paths**: Use absolute paths, check @ alias in frontend
3. **Understand authentication**: Protected routes need `authenticateToken` middleware
4. **Database queries**: Always use parameterized queries, get DB from `getDatabase()`

### When Writing Code

1. **Error messages**: Always in German for user-facing text
2. **HTTP status codes**: Follow REST conventions (200, 201, 400, 401, 404, 500)
3. **Validation**: Use existing validation utilities or add to `utils/validation.js`
4. **Calculations**: Medication stats use `calculateMedicationStats()` - don't duplicate
5. **API responses**: Match existing response structure (e.g., `{ medications: [...] }`)

### When Modifying Database Schema

1. Update `config/database.js` schema
2. Consider backward compatibility
3. Update models to handle new fields
4. Update validation if new constraints added
5. Document migration path for existing deployments

### When Adding Dependencies

1. Use correct package manager: `npm` (not yarn or pnpm)
2. Add to correct package.json (backend vs frontend)
3. Consider security implications
4. Keep dependencies minimal
5. Update Dockerfile if system-level deps needed

### When Debugging

1. Check Docker logs: `docker-compose logs -f`
2. Verify environment variables are set
3. Check database file exists and is writable
4. Test API with curl before assuming frontend issue
5. Use `/health` endpoint to verify backend status

### Common Pitfalls to Avoid

- ❌ Don't mix CommonJS and ES modules in same file
- ❌ Don't use `import.meta.env` in backend (use `process.env`)
- ❌ Don't use `process.env` in frontend (use `import.meta.env`)
- ❌ Don't skip authentication middleware on protected routes
- ❌ Don't concatenate SQL strings with user input
- ❌ Don't forget to enrich medications with calculated stats
- ❌ Don't modify localStorage directly (use api.login/logout)
- ❌ Don't use absolute imports in backend (no @ alias there)

---

## Changelog

### Recent Updates (as of 2025-11-23)

- Health check endpoint added at `/health`
- CORS configuration via `FRONTEND_ORIGIN` env var
- Named Docker volumes for production stability
- GitHub Actions CI pipeline implemented
- Vite build output configured to `build` directory
- Database backup script added
- Frontend uses @ path alias for imports

---

## Additional Resources

- **README.md**: Comprehensive project documentation in German
- **API Documentation**: See README.md for full endpoint specifications
- **Docker Documentation**: https://docs.docker.com/
- **React Router**: https://reactrouter.com/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Express.js**: https://expressjs.com/
- **SQLite**: https://www.sqlite.org/docs.html

---

## Getting Help

For questions or issues:

1. Check this CLAUDE.md file
2. Review README.md for API specifications
3. Examine existing code patterns in similar files
4. Check logs: `docker-compose logs -f`
5. Verify environment variables and configuration

---

**Last Updated**: 2025-11-23
**Document Version**: 1.0.0
**Project Version**: 1.2.1
