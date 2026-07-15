# Releases veröffentlichen

Tabletto verwendet Semantic Versioning, Git-Tags `vMAJOR.MINOR.PATCH` und den
GitHub-Workflow `.github/workflows/release.yml`.

## Voraussetzungen

- sauberer, geprüfter Release-Commit auf `main`
- Schreibrecht für Repository und Tags
- GitHub Actions aktiviert
- aktualisiertes `CHANGELOG.md`
- erfolgreiches Frontend- und Docker-Build
- vollständiges Backup und Migrationshinweise bei Schemaänderungen

## Versionsquellen

Die beabsichtigte kanonische Version steht in `package.json`. Synchronisiert
werden:

```bash
npm run version:sync
```

Das Skript aktualisiert:

- `backend/package.json`
- `frontend/package.json`

Zusätzlich manuell prüfen:

- beide Lockfiles der Teilprojekte
- Root-Lockfile
- Docker-Label in `Dockerfile`
- `CHANGELOG.md`
- Exportformatversion in `dataController.js`, falls das Format geändert wurde

Die UI liest die Frontend-Paketversion beim Build. Ein alter Kommentar im
Versionsskript erwähnt einen direkten Header-String; maßgeblich ist der aktuelle
Headercode.

## Release-Checkliste

1. Zielversion und Breaking-Change-Charakter bestimmen.
2. Version in `package.json` ändern.
3. `npm run version:sync` ausführen.
4. Lockfiles mit dem vorgesehenen npm aktualisieren.
5. `CHANGELOG.md` mit Datum und konkreten Änderungen ergänzen.
6. Dokumentation und bekannte Einschränkungen synchronisieren.
7. Prüfungen ausführen.
8. Release-Commit erstellen und nach `main` bringen.
9. signierten oder annotierten Tag setzen und pushen.
10. GitHub-Workflow und erzeugtes Release prüfen.

## Prüfungen

```bash
npm ci
npm ci --prefix backend
npm ci --prefix frontend
npm run build:frontend
npm run test:e2e
docker build -t tabletto:release-candidate .
```

Zusätzlich einen Container mit temporärem Volume starten und mindestens Login,
Persistenz, Uploads und – nach Korrektur der bekannten Route – den JSON-Health
Check prüfen.

Bei Schemaänderungen außerdem:

- frische Datenbank initialisieren,
- repräsentative Vorversion migrieren,
- Daten und Foreign Keys prüfen,
- Rollback-/Restore-Verfahren dokumentieren.

## Commit und Tag

Beispiel für Version `1.6.0`:

```bash
git add package.json package-lock.json \
  backend/package.json backend/package-lock.json \
  frontend/package.json frontend/package-lock.json \
  Dockerfile CHANGELOG.md
git commit -m "chore: release 1.6.0"
git tag -a v1.6.0 -m "Tabletto 1.6.0"
git push origin main
git push origin v1.6.0
```

Vor `git add` den tatsächlichen Diff prüfen und keine fremden Änderungen oder
lokalen Daten versehentlich aufnehmen.

## GitHub-Release-Workflow

Ein Tag passend zu `v*.*.*` startet den Workflow:

1. Checkout
2. Versionsableitung aus dem Tag
3. Node.js 18
4. Backend- und Frontendinstallation
5. Frontend-Build
6. lokaler Docker-Image-Build
7. GitHub Release mit automatisch erzeugten Notes

Der Workflow veröffentlicht das gebaute Docker-Image nicht in eine Registry und
führt derzeit keine Playwright-Tests aus. Diese Prüfungen müssen vor dem Tag
erfolgreich gelaufen sein.

## Release verifizieren

- GitHub Action grün
- Tag zeigt auf den beabsichtigten Commit
- Release Notes stimmen mit Changelog überein
- Quellarchiv enthält keine `.env`, DB oder Uploads
- Build aus dem Tag erfolgreich
- angezeigte UI-Version stimmt
- Installations- und Updateanleitung funktionieren

## Fehlerhaftes Release

Einen veröffentlichten Tag nicht stillschweigend neu setzen. Stattdessen:

1. Auswirkung dokumentieren.
2. bei Sicherheitsproblemen betroffene Nutzer informieren und Secretrotation
   bewerten.
3. korrigierende Patchversion erstellen.
4. bei Datenrisiko Deployment stoppen und Restore-Anleitung bereitstellen.
5. GitHub-Release nur als fehlerhaft markieren oder entfernen, wenn die
   Repositoryrichtlinie dies vorsieht; Git-Historie nachvollziehbar lassen.
