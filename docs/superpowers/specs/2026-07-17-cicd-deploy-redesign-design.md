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

Ein Workflow-Satz, ein Artefakt: CI testet und baut das Image (ohne Push),
GHCR (`ghcr.io/oliverbenduhn/tabletto`) ist die einzige Quelle für Produktion,
release-please steuert Versionen ohne manuellen Merge-Schritt (Auto-Merge des
Release-PRs), Komodo wird per Webhook aus dem Release-Build aktualisiert.

Entschiedene Alternativen:

- **Deploy-Modell:** CI baut das Image auf PR und `main` (kein Push); nur der
  Release-Workflow pusht nach GHCR. Komodo zieht Images aus GHCR.
  Statt: Komodo baut weiter selbst / parallele Image-Quellen.
- **Release-Fluss:** Tags sind die einzigen Produktion-Images. `:latest`
  zeigt auf das zuletzt getaggte Release. `main` selbst deployt nirgendwo
  hin.
  Statt: jeder `main`-Push = Prod / zusätzlicher `:main`-Image für Preview.
- **E2E-Isolation:** Jedes Playwright-Projekt startet einen eigenen
  Webserver mit eigener `DB_PATH`. Notification-Specs laufen auf beiden
  Projekten ohne Cross-Projekt-State-Leaks.
  Statt: `testIgnore` für Notifications auf Mobile / globale DB mit
  Projekt-Reihenfolge-Tricks.
- **Deploy-Trigger:** Komodo-Webhook wird vom Release-Workflow nach
  erfolgreichem Image-Push aufgerufen. Fehlende Secrets führen zu einem
  roten Workflow; eine Repo-Variable `DEPLOY_WEBHOOK_OPTIONAL=true`
  dokumentiert eine bewusste Übergangsphase, in der das Deploy-Signal
  abgeschaltet sein darf.
  Statt: manueller Redeploy / Registry-Polling / grüner Workflow bei
  fehlenden Secrets.
- **Versionierung:** `release-please` im Standard-PR-Modus, aber der
  Workflow merged den Release-PR sofort selbst (Auto-Merge) und ruft die
  Action im selben Lauf ein zweites Mal auf, die dann Tag +
  GitHub-Release erzeugt. Ergebnis ist der in ADR 0003 entschiedene
  Fluss ohne manuellen Merge-Schritt. (Eine Option `pull-request: false`
  existiert in release-please nicht; `skip-github-pull-request`
  überspringt den Versions-Commit komplett und scheidet aus.)
  `extra-files` synchronisiert `backend/` und `frontend/package.json`
  mit der Root-Version.
  Statt: Release-PR mit manuellem Merge / eigenes Bump-Skript /
  Werkzeugwechsel auf semantic-release.

## 1. CI (`.github/workflows/ci.yml`)

Das `ci.yml` dieses Branches (Node 22, echte Backend-Tests, Playwright-E2E)
ersetzt beim Merge den Node-18-Stand auf `main`. Änderungen:

- **E2E-Fix (Root Cause):** Das globale `webServer`-Array in
  `playwright.config.js` startet pro Projekt einen Server mit eigener `DB_PATH`
  (`/tmp/tabletto-e2e-desktop.db` und `/tmp/tabletto-e2e-mobile.db`).
  Projektspezifische `baseURL`-Werte wählen den jeweiligen Backend-Prozess mit
  frischer SQLite. Damit läuft jede Spec auf
  beiden Projekten, ohne dass persistente Server-State zwischen Projekten
  geteilt wird.
- **Docker-Job bleibt Build-only:** `docker/build-push-action` mit
  `push: false`, Image-Build auf PR und `main`-Push. Es entsteht **kein**
  `packages: write`-Bedarf mehr auf `ci.yml`. Permissions reduzieren sich
  auf die Default-Werte (`contents: read`). Gepushed wird ausschließlich
  aus dem Release-Workflow.

## 2. Releases (`release-please.yml`)

- **Neuer Workflow `release-please.yml`**, Trigger: erfolgreich abgeschlossener
  `CI`-Workflow für einen Push auf `main` (`workflow_run`). So kann das Release
  nicht vor dem Testergebnis entstehen. `workflow_dispatch` dient als Recovery
  und kann eine bereits veröffentlichte Version erneut bauen/deployen.
  Ablauf in einem Lauf:
  1. `googleapis/release-please-action@v4` (Manifest-Modus,
     `release-type: node`) prüft, ob seit dem letzten Release
     Conventional Commits (`feat:`, `fix:`, `BREAKING CHANGE:`) liegen,
     und erstellt bzw. aktualisiert den Release-PR mit Versionsbumps in
     `package.json` (Root, `backend/`, `frontend/` via `extra-files`)
     und `CHANGELOG.md`.
  2. Der Workflow merged diesen PR synchron per Squash über die GitHub-API und
     prüft `merged: true`. Er verwendet bewusst nicht `gh pr merge`, weil dieser
     bei Branch Protection nur Auto-Merge vormerken und erfolgreich zurückkehren
     kann, obwohl der PR noch offen ist.
  3. Die Action läuft ein zweites Mal, findet den gemergten
     Release-Commit und erzeugt Tag `vX.Y.Z` + GitHub-Release; erst
     dieser zweite Aufruf setzt `release_created`/`tag_name`.
  Der Bump-Commit triggert wegen des
  `GITHUB_TOKEN`-Rekursionsschutzes keine erneuten Workflow-Runs.
- **Image-Build und Push** (im selben Workflow, konditional auf den
  Action-Output `release_created`):
  1. Checkout, `docker/setup-buildx-action@v3`,
     `docker/login-action@v3` gegen `ghcr.io` mit `GITHUB_TOKEN`.
  2. `docker/build-push-action@v6` mit `push: true` und Tags
     `:X.Y.Z` und `:latest`. Permissions für den Workflow:
     `contents: write`, `packages: write`, `pull-requests: write`.
  3. Kein Node-Setup im Runner — der Frontend-Build passiert im
     Dockerfile (Node 22).
- **Komodo-Webhook:** Nach erfolgreichem Image-Push ruft der Workflow den
  Komodo-Deploy-Webhook auf. Authentifizierung gegen
  `KOMODO_WEBHOOK_URL` und `KOMODO_WEBHOOK_SECRET` im GitHub-kompatiblen Format
  (HMAC-SHA256 in `X-Hub-Signature-256`). Fehlende Secrets oder ein
  fehlgeschlagener Aufruf lassen
  den Workflow rot werden; das Image liegt bereits in GHCR und ein
  manueller Redeploy in Komodo bleibt möglich. Eine Repo-Variable
  `DEPLOY_WEBHOOK_OPTIONAL=true` schaltet den Webhook-Step sauber als
  „skip mit Hinweis" ab und ist ausschließlich für die Übergangsphase
  gedacht, in der die Maintainer-Voraussetzungen noch nicht erfüllt sind.
- **Voraussetzung:** Conventional Commits auf `main` — entspricht der
  bereits gelebten Praxis im Repo (verifiziert via `git log`).

### Konfiguration

`release-please-config.json` (neu, Repo-Root, Manifest-Modus):

```json
{
  "bootstrap-sha": "b2fbd9d42662abaa7b560f16c0075a1fbbeed7e5",
  "packages": {
    ".": {
      "release-type": "node",
      "extra-files": [
        { "type": "json", "path": "backend/package.json", "jsonpath": "$.version" },
        { "type": "json", "path": "frontend/package.json", "jsonpath": "$.version" }
      ]
    }
  }
}
```

`bootstrap-sha` ist der bestehende 1.5.0-Bump-Commit. Da `v1.5.0` nie
veröffentlicht wurde (letzter Remote-Tag: `v1.3.0`), begrenzt er beim ersten
Release-Please-Lauf die Commit-Suche auf Änderungen nach dem dokumentierten
1.5.0-Stand.

`.release-please-manifest.json` (neu, Repo-Root, Startstand):

```json
{
  ".": "1.5.0"
}
```

## 3. Komodo / Compose

- `compose.yaml` wird zur einzigen Compose-Datei und Prod-Referenz.
  `build: .` entfällt, stattdessen
  `image: ghcr.io/oliverbenduhn/tabletto:latest`. Die Niceties aus
  `docker-compose.prod.yml` (Resource-Limits, Logging, `security_opt`,
  Netzwerk, ausführlicher Healthcheck, benanntes Volume) werden in
  `compose.yaml` übernommen.
- GHCR-Package auf **public** stellen (Repo ist public) — der Komodo-Host
  braucht dann keine Pull-Credentials.
- **Rollback:** In Komodo das Image-Tag auf die Vorversion (`X.Y.Z`, ohne `v`)
  setzen und redeployen. Wird in `DEPLOY-KOMODO.md` dokumentiert. Ein
  reiner Image-Rollback reicht nur bei kompatiblen Schema-Änderungen;
  bei inkompatiblem Schema ist zusätzlich ein Daten-Restore nötig (siehe
  `docs/operations.md`).
- `docker-compose.prod.yml` wird ersatzlos gelöscht.

## 4. Aufräumen & Dokumentation (gleicher Änderungssatz)

- `release.yml` wird gelöscht (ersetzt durch `release-please.yml`).
- `docker-compose.prod.yml` wird gelöscht (Inhalt nach `compose.yaml`).
- `scripts/sync-version.js` wird gelöscht; der zugehörige
  `version:sync`-Eintrag in `package.json` entfällt. Synchronisierung
  läuft zentral über `release-please` mit `extra-files`.
- `release-please-config.json` kommt neu hinzu.
- `DEPLOY-KOMODO.md`, `PUBLISH.md` und `docs/operations.md` beschreiben
  den neuen Fluss: Release entsteht durch Merge eines
  Conventional-Commits auf `main`, alles andere läuft automatisch.

## Fehlerbehandlung

- **Webhook fehlt oder schlägt fehl** → Workflow rot, Image liegt in
  GHCR, manueller Redeploy in Komodo bleibt möglich. Mit
  `DEPLOY_WEBHOOK_OPTIONAL=true` ist der Step explizit deaktivierbar.
- **Der auto-gemergte Release-Bump-Commit auf `main`** triggert wegen
  `GITHUB_TOKEN`-Rekursionsschutz keine erneuten Workflow-Runs.
  CI-Lücken auf dem Bump-Commit sind akzeptiertes Restrisiko bei
  deterministischem Bump; ein re-Push oder ein Hotfix-Commit reaktiviert
  CI falls nötig.
- **Image-Build-Fehler im Release** → Tag und GitHub-Release existieren bereits,
  aber das Produktionsimage fehlt. `workflow_dispatch` veröffentlicht die
  angegebene oder neueste Version erneut; der Komodo-Webhook läuft erst nach
  erfolgreichem Image-Push.
- **Main-Branch-CI ist grün** ist Voraussetzung: Der Release-Workflow wird nur
  nach einem erfolgreichen `CI`-Lauf für einen `main`-Push gestartet.

## Tests / Verifikation

- `npm test --prefix backend` und `npm run test:e2e` lokal grün.
  Notification-Specs erscheinen in beiden Playwright-Projekten und sind
  grün.
- CI-Lauf des PRs grün.
- Nach Merge: `ci.yml` baut das Image ohne Push; erst sein erfolgreicher Abschluss
  startet den Release-Workflow.
- Erster release-please-Lauf auf `main` mit versionierungsrelevantem
  Commit: Direkt-Commit + `:X.Y.Z` + `:latest` in GHCR, Komodo-Webhook
  feuert, Stack zieht das neue Image.
- `git tag` zeigt nach dem ersten Release das von release-please
  erzeugte `vX.Y.Z`-Tag.

## Offene Voraussetzungen (Maintainer)

- Komodo-Stack-Webhook aktivieren und Komodo-Stack auf
  `ghcr.io/oliverbenduhn/tabletto:latest` mit Pull-Policy `always`
  umstellen.
- `KOMODO_WEBHOOK_URL` und `KOMODO_WEBHOOK_SECRET` als GitHub-Secrets
  hinterlegen; Komodo verwendet das GitHub-kompatible HMAC-Schema.
- GHCR-Package nach dem ersten Push auf public stellen.
- Für die Übergangsphase (vor erfüllten Voraussetzungen):
  Repo-Variable `DEPLOY_WEBHOOK_OPTIONAL=true` setzen, damit der
  Release-Workflow nicht durch fehlende Secrets rot wird. Nach
  Aktivierung des Webhooks wieder entfernen.
