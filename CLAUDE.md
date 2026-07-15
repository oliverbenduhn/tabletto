# Claude-Arbeitsanleitung für Tabletto

`AGENTS.md` ist das verbindliche, werkzeugunabhängige Regelwerk dieses
Repositories. Lies es vollständig, bevor du Änderungen planst oder ausführst.
Diese Datei ergänzt nur Claude-spezifische Arbeitspraktiken.

## Arbeitsreihenfolge

1. `AGENTS.md` lesen.
2. `git status --short` prüfen und fremde Änderungen erhalten.
3. Betroffene Quelldateien, Tests und passende Seite unter `docs/` lesen.
4. Verhalten aus dem aktuellen Code ableiten; veraltete Dokumentation nicht als
   Implementierungsnachweis verwenden.
5. Einen kleinen, überprüfbaren Änderungssatz umsetzen.
6. Die Prüfmatrix aus `AGENTS.md` anwenden.
7. Geänderte Verträge und Betriebsabläufe im selben Änderungssatz dokumentieren.

## Kontext gezielt laden

| Aufgabe | Primäre Dateien |
|---|---|
| API | `backend/src/routes/`, zugehöriger Controller und Model, `docs/api.md` |
| Auth | `middleware/auth.js`, `config/jwt.js`, `authController.js`, `docs/security.md` |
| Schema | `config/database.js`, Models, `docs/data-model.md` |
| Bestand | `Medication.js`, `calculations.js`, `stockScheduler.js` |
| Frontend-Flow | Seite, verwendete Komponenten, `services/api.js`, E2E-Test |
| Betrieb | Docker-/Compose-Dateien, Entrypoint, `docs/operations.md` |
| PWA | `frontend/vite.config.js`, Auth-/API-Client, `docs/security.md` |

Lade keine generierten Verzeichnisse wie `frontend/build`, `playwright-report`
oder `test-results` als Architekturquelle.

## Umgang mit Widersprüchen

- Aktueller Code und ausführbare Tests beschreiben den Ist-Zustand.
- `docs/` beschreibt den beabsichtigten und bekannten Zustand.
- `CHANGELOG.md` ist historisch, nicht normativ.
- Bei einer Abweichung nicht stillschweigend eine Seite auswählen: Auswirkung
  bestimmen, die passend autorisierte Korrektur umsetzen und Dokumentation
  synchronisieren.

## Übergabe

Nenne am Ende knapp:

- welches Verhalten oder welche Dokumentation geändert wurde,
- welche Dateien wesentlich sind,
- welche Prüfungen liefen,
- welche bekannten Risiken oder Folgearbeiten verbleiben.

Wiederhole dabei nicht den gesamten Plan und behaupte keine Tests, die nicht
ausgeführt wurden.
