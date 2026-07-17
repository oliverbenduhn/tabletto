# Entwicklung

## Voraussetzungen

- Node.js 20.17 oder neuer; Node.js 22 empfohlen
- npm
- Git
- optional Docker Engine und Docker Compose v2
- Chromium-Abhängigkeiten für Playwright

Backend und Root verwenden CommonJS; das Frontend verwendet ES Modules.

## Einrichtung

```bash
git clone https://github.com/oliverbenduhn/tabletto.git
cd tabletto
npm run install:all
mkdir -p backend/data backend/uploads
cp .env.example .env
```

Lokale `.env`:

```dotenv
JWT_SECRET=only-for-local-development
PORT=3000
DB_PATH=./data/tabletto.db
UPLOADS_PATH=./uploads
ENABLE_STOCK_SCHEDULER=false
STOCK_SCHEDULER_CRON=*/5 * * * *
TZ=Europe/Berlin
FRONTEND_ORIGIN=http://localhost:5173
```

Der relative Datenbankpfad wird aus dem Backend-Arbeitsverzeichnis aufgelöst.

## Entwicklungsserver

Terminal 1:

```bash
npm run dev:backend
```

Terminal 2:

```bash
VITE_API_URL=http://localhost:3000/api npm run dev:frontend
```

Vite läuft üblicherweise auf Port 5173. Für produktionsnahe Prüfung kann das
Frontend gebaut und vom Backend ausgeliefert werden:

```bash
npm run build:frontend
npm start
```

## Nützliche Befehle

| Befehl | Zweck |
|---|---|
| `npm run install:all` | Backend- und Frontend-Abhängigkeiten installieren |
| `npm run dev:backend` | Express mit Nodemon starten |
| `npm run dev:frontend` | Vite-Dev-Server starten |
| `npm run build:frontend` | Produktionsbuild nach `frontend/build` |
| `npm run test:e2e` | Playwright headless |
| `npm run test:e2e:headed` | Playwright mit sichtbarem Browser |
| `npm run test:e2e:report` | letzten HTML-Report öffnen |
| `npm --prefix backend run backup` | konsistenter SQLite-Snapshot inklusive Uploads |

`npm test --prefix backend` führt Kern- und Migrationstests aus. API- und
UI-Verträge werden zusätzlich mit Playwright geprüft.

## Repository-Aufbau

```text
backend/src/
├── config/        SQLite- und JWT-Konfiguration
├── controllers/   HTTP-Orchestrierung
├── middleware/    Auth und Rate Limit
├── models/        normale Datenzugriffe
├── routes/        Endpunktdefinitionen
├── services/      Scheduler
├── utils/         Berechnung, Validierung, Uploadpfade
└── server.js      Prozesseinstieg

frontend/src/
├── components/    wiederverwendbare UI
├── pages/         Routen und Datenorchestrierung
├── services/      API und Auth
├── utils/         reine Hilfsfunktionen
├── App.jsx        Routing
└── index.jsx      React-Einstieg
```

## Backend-Konventionen

- CommonJS mit `require` und `module.exports`
- 2 Leerzeichen, bestehende Semikolonkonvention erhalten
- frühe Returns für ungültige Eingaben und fehlende Ressourcen
- Fehlerantworten als `{ error: string }`
- SQL-Werte ausschließlich über Platzhalter
- benutzerbezogene Abfragen immer mit `user_id`
- Routen definieren Transport, Controller orchestrieren, Models greifen auf
  Daten zu
- direkte SQL-Zugriffe außerhalb von Models nur für Migrationen, abgegrenzte
  Transaktionen, Scheduler und Betriebsskripte

Neue asynchrone Handler brauchen eine definierte Fehlerweitergabe. Der aktuelle
Code fängt Fehler nicht in jedem Controller ab; neue Arbeit sollte dieses Risiko
nicht vergrößern.

## Frontend-Konventionen

- funktionale React-Komponenten und Hooks
- Seiten koordinieren Laden, Dialoge und Navigation
- HTTP ausschließlich über `frontend/src/services/api.js`
- Authentifizierungsstatus nicht in einem zweiten Speicher duplizieren
- Lade-, Leer-, Erfolg- und Fehlerzustände darstellen
- deutsche UI-Texte; API-Felder nicht nur für die UI umbenennen
- mindestens 44 × 44 Pixel große Touch-Ziele
- Tastaturbedienung, Fokus und Dialogsemantik erhalten
- FullCalendar-DOM nur an der vorhandenen Bibliotheksgrenze imperativ ändern

## Neuen API-Endpunkt hinzufügen

1. Vertrag und Auth-Anforderung festlegen.
2. Route im passenden Router ergänzen.
3. Eingaben im Controller validieren.
4. Benutzergebundenen Datenzugriff im Model ergänzen.
5. API-Client-Methode hinzufügen, falls das Frontend den Endpunkt nutzt.
6. Erfolgs-, Fehler- und Fremdbenutzerfall testen.
7. `docs/api.md` aktualisieren.

## Schema ändern

1. Spalte/Constraint im Basisschema ergänzen.
2. Ist-Zustand einer bestehenden Datenbank prüfen.
3. Idempotente Migration und Datenüberführung ergänzen.
4. Models und Berechnungen aktualisieren.
5. Import und Export aktualisieren.
6. frische und migrierte Datenbank testen.
7. `docs/data-model.md` und API-Vertrag aktualisieren.

Migrationen laufen beim Prozessstart. Sie sollten keine großen, unkontrollierten
Umbauten unter Produktionslast durchführen.

## Versionierung

Release-Please aktualisiert Root-, Backend- und Frontend-Paketversion sowie das
Changelog automatisch. Der Header liest die Frontend-Paketversion zur Build-Zeit;
das Release-Image erhält die Version über `APP_VERSION`. Der vollständige Ablauf
steht in [`PUBLISH.md`](../PUBLISH.md).

## Debugging

Backendlog:

```bash
npm run dev:backend
```

Produktionscontainer:

```bash
docker compose logs -f tabletto
docker compose exec tabletto sh
```

SQLite-Schema prüfen:

```bash
sqlite3 backend/data/tabletto.db '.schema'
sqlite3 backend/data/tabletto.db 'PRAGMA foreign_key_check;'
```

Keine echten Passwörter, JWTs oder Gesundheitsdaten in Issues, Logs oder
Testfixtures kopieren.

## Definition of Done

- fachliche und Mandantengrenzen erhalten
- Fehlerfälle und Nebenwirkungen geprüft
- passende Build-/Testbefehle erfolgreich
- keine fremden Workspace-Änderungen überschrieben
- API, Schema, Betrieb und Changelog bei Bedarf synchronisiert
- bekannte nicht behobene Risiken in der Übergabe genannt
