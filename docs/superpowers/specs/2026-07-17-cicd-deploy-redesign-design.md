# CI/CD-Neuaufbau: Design

Datum: 2026-07-17
Status: Entwurf, vom Maintainer bestätigt
Branch: `agent/comprehensive-audit-hardening`

## Problem

1. **`main` ist seit 2026-07-14 rot.** Der dortige CI-Workflow nutzt Node 18;
   Vite 6 und die `engines`-Angabe (`node >= 20.17`) verlangen Node ≥ 20.
   Backend-Tests laufen dort mit `npm test || true` und werden ignoriert.
2. **Der Branch-CI schlägt in 11 E2E-Tests fehl.** Die Playwright-Projekte
   `desktop-chromium` und `mobile-pixel-7` laufen nacheinander gegen denselben
   Webserver mit derselben SQLite-DB. Die Notification-Dedup-Logik erzeugt pro
   Status-Verschlechterung genau eine Mail; der Desktop-Durchlauf verbraucht
   die Übergänge, der Mobile-Durchlauf erhält 0 Mails.
3. **CI-Artefakt und Prod-Artefakt sind entkoppelt.** `release.yml` baut bei
   einem Tag ein Docker-Image und verwirft es (kein Push), außerdem mit
   Node 18. Komodo baut in Produktion selbst aus Git — deployed wird nie das
   getestete Image.
4. **Versionierung ist manuell** (package.json editieren, `version:sync`,
   CHANGELOG, Tag von Hand) und fehleranfällig.

## Zielbild

Ein Workflow-Satz, ein Artefakt: CI testet und baut das Image, GHCR
(`ghcr.io/oliverbenduhn/tabletto`) ist die einzige Quelle für Produktion,
release-please steuert Versionen, Komodo wird per Webhook aktualisiert.

Entschiedene Alternativen:

- Deploy-Modell: **CI baut & pusht Image**, Komodo zieht nur noch
  (statt: Komodo baut weiter selbst / beides parallel).
- Release-Fluss: **Tags = Prod, main = Preview**
  (statt: jeder main-Push = Prod / nur Tags).
- E2E-Isolation: **Notification-Specs nur im Desktop-Projekt**
  (statt: frische DB pro Projekt / getrennte Server-Instanzen).
- Deploy-Trigger: **Webhook aus dem Release-Workflow an Komodo**
  (statt: manueller Redeploy / Registry-Polling).
- Versionierung: **release-please-Vollautomatik über Conventional Commits**
  (statt: manuelles Tag mit CI-Prüfung / Release-Skript).

## 1. CI (`.github/workflows/ci.yml`)

Das `ci.yml` dieses Branches (Node 22, echte Backend-Tests, Playwright-E2E)
ersetzt beim Merge den Node-18-Stand auf `main`. Änderungen daran:

- **E2E-Fix:** `playwright.config.js` erhält im Projekt `mobile-pixel-7`
  `testIgnore: '**/notifications.spec.js'`. Die Notification-Specs laufen nur
  noch auf `desktop-chromium`. Bekannter Trade-off: die Settings-Toggles der
  Benachrichtigungen werden auf Mobile nicht mehr E2E-geprüft.
- **Docker-Job wird Build-und-Push-Job:**
  - Pull Request: Image nur bauen (`push: false`), wie bisher.
  - Push auf `main`: zusätzlich Push nach
    `ghcr.io/oliverbenduhn/tabletto:main` und `:sha-<commit>`.
  - Login über `docker/login-action` mit `GITHUB_TOKEN`;
    Job-`permissions: contents: read, packages: write`.

## 2. Releases (release-please + neues `release.yml`)

- **Neuer Workflow `release-please.yml`**, Trigger: Push auf `main`.
  `googleapis/release-please-action`, `release-type: node`. Der Release-PR
  bumpt die Version in `package.json` sowie via `extra-files`
  `backend/package.json` und `frontend/package.json` (ersetzt `version:sync`
  im Release-Fluss; das Skript bleibt für lokale Nutzung erhalten) und pflegt
  `CHANGELOG.md`. Merge des PRs erzeugt Tag `vX.Y.Z` und das GitHub-Release.
- **`release.yml` wird ersatzlos gelöscht**, der Release-Build wandert in
  `release-please.yml`: Ein von release-please mit dem Standard-`GITHUB_TOKEN`
  erzeugtes Tag löst aus GitHub-Rekursionsschutz keine weiteren Workflows aus
  — ein separater Tag-getriggerter Workflow würde nie feuern. Stattdessen
  laufen im selben Workflow, wenn der Action-Output `release_created` gesetzt
  ist: Checkout, Buildx, Login GHCR, ein Image-Build mit Push der Tags
  `:X.Y.Z` und `:latest`. Kein Node-Setup im Runner nötig — der
  Frontend-Build passiert im Dockerfile (Node 22).
- **Komodo-Webhook:** Nach erfolgreichem Push ruft derselbe Workflow den
  Komodo-Deploy-Webhook auf. Konfiguration über GitHub-Secrets
  `KOMODO_WEBHOOK_URL` und `KOMODO_WEBHOOK_SECRET`. Fehlen die Secrets, wird
  der Schritt sauber übersprungen (Skip mit Hinweis, Workflow bleibt grün).
- Voraussetzung: Conventional Commits auf `main` — entspricht der bereits
  gelebten Praxis im Repo.

## 3. Komodo / Compose

- `compose.yaml`: `build:` entfällt, stattdessen
  `image: ghcr.io/oliverbenduhn/tabletto:latest`; Doku empfiehlt das Pinnen
  auf eine feste Version. Kein Build mehr auf dem Prod-Host.
- GHCR-Package auf **public** stellen (Repo ist public) — der Komodo-Host
  braucht dann keine Pull-Credentials.
- **Rollback:** In Komodo das Image-Tag auf die Vorversion setzen und
  redeployen. Wird in `DEPLOY-KOMODO.md` dokumentiert.
- `docker-compose.prod.yml` wird auf das Image-Modell umgestellt oder klar
  als lokale Build-Variante gekennzeichnet.

## 4. Aufräumen & Dokumentation (gleicher Änderungssatz)

- Toter Registry-Push-Code verschwindet mit dem alten `ci.yml`.
- `DEPLOY-KOMODO.md`, `PUBLISH.md` und `docs/operations.md` beschreiben den
  neuen Fluss: Release = Release-PR mergen, sonst nichts.

## Fehlerbehandlung

- Webhook-Aufruf schlägt fehl → Workflow wird rot, das Image liegt trotzdem
  in GHCR; manueller Redeploy in Komodo bleibt möglich.
- Ein Tag ohne grünes CI kann nicht entstehen: das Tag entsteht nur aus dem
  gemergten Release-PR, und `main` ist durch CI gedeckt.
- Image-Push auf `main` läuft nur nach erfolgreichem `test`-Job
  (`needs: test`).

## Tests / Verifikation

- `npm test --prefix backend` und `npm run test:e2e` lokal grün (inklusive
  der E2E-Isolation: Notification-Specs erscheinen nicht mehr im
  Mobile-Projekt-Report).
- CI-Lauf des PRs grün.
- Nach Merge: main-Push erzeugt `:main`-Image in GHCR.
- Erster Release-PR-Merge: `:X.Y.Z` + `:latest` in GHCR, Komodo-Webhook
  feuert, Stack zieht das neue Image.

## Offene Voraussetzungen (Maintainer)

- Komodo-Stack-Webhook aktivieren; `KOMODO_WEBHOOK_URL` und
  `KOMODO_WEBHOOK_SECRET` als GitHub-Secrets hinterlegen.
- GHCR-Package nach dem ersten Push auf public stellen.
