# Tests und Qualitätssicherung

## Aktueller Stand

Automatisiert vorhanden:

- Vite-Produktionsbuild
- ein durchgehender Playwright-UI-Test und API-Vertragstests
- Ausführung in Desktop Chrome und emulierter Pixel-7-Ansicht
- sichtbarer UX-Audit an wichtigen Checkpoints
- Backend-Tests für Validierung, Pfadschutz, Berechnung, Scheduler und Migration
- Mandantentrennungs-, Import-/Export-, Concurrency- und Upload-E2E
- Backend, Frontend, Playwright und Docker-Image-Build in GitHub Actions

Noch nicht vorhanden sind eigenständige Frontend-Komponententests und ein
vollständiger Restore-Test eines extern gesicherten Produktionsbackups.

## Playwright-Konfiguration

`playwright.config.js` verwendet:

- `baseURL`: `http://127.0.0.1:3000`
- Locale `de-DE`
- Zeitzone `Europe/Berlin`
- einen Worker und keine vollständige Parallelisierung
- Screenshots nur bei Fehlern
- Trace und Video bei Fehlern
- HTML-Report in `playwright-report/`
- Artefakte in `test-results/artifacts/`

Der Webserver-Befehl baut das Frontend und startet das Backend. Testwerte:

```text
JWT_SECRET=tabletto-e2e-only-secret
DB_PATH=/tmp/tabletto-e2e.db
ENABLE_STOCK_SCHEDULER=false
PORT=3000
```

Eindeutige E-Mail- und Medikamentnamen verhindern Kollisionen. Backend-Tests
verwenden pro Prozess temporäre Verzeichnisse und räumen sie wieder auf.

## Abgedeckte Benutzerreise

Der Test `kritische Tabletto-Prozessketten und visueller UX-Audit` deckt ab:

1. Registrierung und Login
2. leeres Dashboard
3. Medikament anlegen
4. Suche und leeres Suchergebnis
5. Detailseite öffnen
6. Bestand setzen und Packung addieren
7. History anzeigen
8. Medikament bearbeiten
9. Dashboard- und Kalenderpräferenzen speichern
10. Navigation und Persistenz der Präferenzen
11. Kalender öffnen
12. Medikament löschen
13. Logout und geschützte Route

Die API-Suite ergänzt Health, Intervallfelder, parallele Bestandsaddition,
Importrollback, leeren Restore, fremde Benutzerzugriffe und manipulierte Uploads.
Noch nicht automatisiert sind Passwortänderung, Rate-Limit-Zeitfenster und ein
vollständiger externer Restore.

## UX-Audit

An Checkpoints prüft der Test:

- keinen horizontalen Seitenscroll,
- keine sichtbar aus dem Viewport ragenden Elemente,
- keine sichtbaren Interaktionsziele unter 44 × 44 Pixel,
- Cumulative Layout Shift höchstens 0,1.

Die Prüfungen sind teilweise `expect.soft`: Der Flow läuft nach einem Fund weiter,
der Test gilt am Ende dennoch als fehlgeschlagen.

## Lokal ausführen

```bash
npm run test:e2e
```

Nur ein Projekt:

```bash
npx playwright test --project=desktop-chromium
npx playwright test --project=mobile-pixel-7
```

Interaktiv und Report:

```bash
npm run test:e2e:headed
npm run test:e2e:report
```

Falls Browser fehlen:

```bash
npx playwright install --with-deps chromium
```

## CI

`.github/workflows/ci.yml` läuft bei Push und Pull Request gegen `main`:

1. Checkout
2. Node.js 22
3. Backend-Abhängigkeiten und Backend-Tests
4. Frontend-Abhängigkeiten und Build
5. Playwright Chromium mit Desktop- und Mobile-Projekt
6. Fehlerartefakte hochladen
7. Docker-Image-Build nach erfolgreichen Tests

## Prüfmatrix für Änderungen

| Bereich | Erforderliche Prüfung |
|---|---|
| Dokumentation | Links, Pfade, Befehle, `git diff --check` |
| Backend-Syntax | `node --check <datei>` |
| Frontend | Produktionsbuild |
| Auth/API | Erfolg, ungültige Eingabe, fehlender/ungültiger Token |
| Mandantengrenze | Ressource eines zweiten Benutzers nicht zugänglich |
| Datenmodell | frische DB und Migration einer alten DB |
| Bestand | Wert und zugehörige History atomar prüfen |
| Scheduler | Morgen/Mittag/Abend, Intervall, Zeitzone, Idempotenz |
| E-Mail-Testversand | eigener Empfänger, unabhängig vom Opt-in, Auth, Rate-Limit, SMTP-Fehler |
| Upload | Größe, MIME, Pfad, Ersetzen, Löschen, Fremdbenutzer |
| Import | Commit, Rollback, ID-Mapping, Intervallfelder, Fotos |
| UI | Desktop und Mobile, Tastatur, Lade-/Fehlerzustände |
| Docker | Build, Start, JSON-Healthcheck, persistente Daten |

## Nächste Testausbaustufen

1. Frontend-Komponententests für Modal, Menü und Medikamentenformular
2. vollständiger Backup-/Restore-Test inklusive Uploads
3. Rate-Limit- und Passwortänderungsfälle
4. weitere repräsentative historische Schemaversionen
