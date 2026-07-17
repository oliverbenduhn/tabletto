# CI/CD-Neuaufbau Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CI wird grün und ehrlich, Releases laufen vollautomatisch über release-please + Auto-Merge, das getestete Docker-Image aus GHCR ist die einzige Prod-Quelle, Komodo deployed per Webhook.

**Architecture:** `ci.yml` testet (Backend-Unit + Playwright-E2E mit zwei isolierten Webserver-Instanzen) und baut das Image ohne Push. Ein neuer Workflow `release-please.yml` erstellt bei releasebaren Commits auf `main` den Release-PR, merged ihn sofort selbst, erzeugt im zweiten Action-Aufruf Tag + GitHub-Release, pusht das Image nach `ghcr.io/oliverbenduhn/tabletto` (`:X.Y.Z`, `:latest`) und ruft den Komodo-Webhook auf. `compose.yaml` referenziert nur noch das GHCR-Image.

**Tech Stack:** GitHub Actions, googleapis/release-please-action@v4 (Manifest-Modus), docker/build-push-action@v6, GHCR, Playwright, Komodo (GitHub-kompatibler Webhook-Listener mit HMAC-SHA256).

**Spec:** `docs/superpowers/specs/2026-07-17-cicd-deploy-redesign-design.md` (verbindlich), ADRs 0002–0005 in `docs/adr/`.

> **Umsetzungshinweis (2026-07-17):** Die kritische Prüfung hat den Release-
> Trigger auf `workflow_run` nach erfolgreicher CI, eine Recovery für bereits
> erzeugte Releases, `bootstrap-sha` für den nie getaggten 1.5.0-Stand sowie die
> aktuellen Node-24-basierten Action-Majors ergänzt. Maßgeblich sind der
> implementierte Workflow, die aktualisierte Spec und ADRs; die Task-Snippets
> darunter dokumentieren den ursprünglichen Planungsstand.

## Global Constraints

- Node ≥ 20.17 (engines in `backend/package.json` und `frontend/package.json`); CI und Dockerfile nutzen Node 22.
- Image-Name exakt: `ghcr.io/oliverbenduhn/tabletto`.
- Nur der Release-Workflow pusht Images; `ci.yml` bleibt `push: false` und `contents: read`.
- Fehlende Webhook-Secrets machen den Release-Workflow rot, außer Repo-Variable `DEPLOY_WEBHOOK_OPTIONAL=true` ist gesetzt (ADR 0005).
- Alle Commits Conventional Commits (deutsch beschreibende Bodies ok, Prefixe englisch: `feat:`, `fix:`, `ci:`, `docs:`, `chore:`).
- Doku-Änderungen gehören in denselben Änderungssatz wie die Verhaltensänderung (AGENTS.md).
- Fremde Änderungen erhalten: `assets/` (untracked) nicht anfassen, nicht committen.

---

### Task 1: E2E-Isolation — zwei Webserver mit eigener DB

**Files:**
- Modify: `playwright.config.js`
- Modify: `package.json` (Root, scripts)

**Interfaces:**
- Produces: Desktop-Projekt läuft gegen `http://127.0.0.1:3030`, Mobile-Projekt gegen `http://127.0.0.1:3031`; beide Backends senden SMTP an `127.0.0.1:2587` (geteilter fake-smtp, unkritisch weil `workers: 1` und Scheduler deaktiviert — Mails entstehen nur durch explizite Test-Trigger).
- Consumes: nichts.

Hintergrund: Playwright kennt **keinen** `webServer` pro Projekt — nur einen globalen Block oder ein Array. Die Isolation entsteht durch zwei Server-Einträge mit eigenem Port und eigener `DB_PATH`, plus projekt-spezifischer `baseURL`. Der Frontend-Build wandert aus dem Server-Command in ein `pretest:e2e`-Script, sonst bauen beide Server-Commands parallel in dasselbe `frontend/build` (Race).

- [ ] **Step 1: `package.json` — pretest-Script ergänzen**

In `package.json` (Root) im `scripts`-Block vor `"test:e2e"` einfügen:

```json
    "pretest:e2e": "npm run build:frontend",
```

(npm führt `pretest:e2e` automatisch vor `test:e2e` aus.)

- [ ] **Step 2: `playwright.config.js` umbauen**

Den kompletten `projects`- und `webServer`-Teil ersetzen. Neuer vollständiger Dateiinhalt:

```js
const { defineConfig, devices } = require('@playwright/test');

const serverEnv = {
  ...process.env,
  JWT_SECRET: 'tabletto-e2e-only-secret',
  ENABLE_STOCK_SCHEDULER: 'false',
  ENABLE_INTERNAL_ENDPOINTS: 'true',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '2587',
  SMTP_FROM: 'tabletto-e2e@example.test'
};

module.exports = defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/artifacts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 8_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        baseURL: 'http://127.0.0.1:3030'
      }
    },
    {
      name: 'mobile-pixel-7',
      use: {
        ...devices['Pixel 7'],
        baseURL: 'http://127.0.0.1:3031'
      }
    }
  ],
  // Ein Server pro Projekt: eigene DB, eigener Port. Playwright startet beide
  // vor dem Lauf; der Frontend-Build passiert einmalig via pretest:e2e.
  webServer: [
    {
      command: 'rm -f /tmp/tabletto-e2e-desktop.db && npm start',
      url: 'http://127.0.0.1:3030/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { ...serverEnv, DB_PATH: '/tmp/tabletto-e2e-desktop.db', PORT: '3030' }
    },
    {
      command: 'rm -f /tmp/tabletto-e2e-mobile.db && npm start',
      url: 'http://127.0.0.1:3031/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { ...serverEnv, DB_PATH: '/tmp/tabletto-e2e-mobile.db', PORT: '3031' }
    }
  ]
});
```

Hinweis: `url` wechselt von `/login` auf `/health`, damit die Bereitschaftsprüfung nicht vom Frontend-Build abhängt. Falls `/health` von der SPA-Wildcard abgefangen wird und kein 2xx liefert (siehe `docs/operations.md`), stattdessen `/login` beibehalten — dann funktioniert die Prüfung wie bisher, weil der Build durch `pretest:e2e` schon vorliegt.

- [ ] **Step 3: E2E lokal ausführen — Notification-Specs müssen auf BEIDEN Projekten grün sein**

```bash
npm ci && npm ci --prefix backend && npm ci --prefix frontend
npm run test:e2e 2>&1 | tail -20
```

Erwartet: `0 failed`; im Report tauchen `notifications.spec.js`-Tests unter `desktop-chromium` UND `mobile-pixel-7` auf, alle grün. (Vorher: 11 rote Tests auf `mobile-pixel-7`.)

- [ ] **Step 4: Commit**

```bash
git add playwright.config.js package.json
git commit -m "fix(e2e): eigener Webserver mit eigener DB pro Playwright-Projekt

Root-Cause-Fix für 11 rote Notification-Tests auf mobile-pixel-7:
geteilter Server-State (Dedup) zwischen den Projekten entfällt.
Frontend-Build läuft einmalig via pretest:e2e statt im Server-Command.
Siehe docs/adr/0004-e2e-per-project-webserver.md."
```

---

### Task 2: `ci.yml` — Permissions minimieren, redundanten Build-Step entfernen

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `pretest:e2e` aus Task 1 (baut das Frontend vor `playwright test`).
- Produces: CI-Workflow, der beim Merge den kaputten Node-18-Stand auf `main` ersetzt.

- [ ] **Step 1: `ci.yml` anpassen**

Vollständiger neuer Inhalt:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: |
            package-lock.json
            backend/package-lock.json
            frontend/package-lock.json
      - run: npm ci
      - run: npm ci --prefix backend
      - run: npm ci --prefix frontend
      - run: npm test --prefix backend
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-artifacts
          path: |
            playwright-report/
            test-results/artifacts/
          retention-days: 7

  docker:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: false
          tags: tabletto:ci
```

Änderungen gegenüber vorher: `permissions: contents: read` auf Workflow-Ebene (ADR 0002: `ci.yml` pusht nie, braucht kein `packages: write`); der Step `npm run build:frontend` entfällt (läuft jetzt via `pretest:e2e` innerhalb von `npm run test:e2e`).

- [ ] **Step 2: YAML-Syntax prüfen**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('ok')"
```

Erwartet: `ok`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: Least-Privilege-Permissions, Frontend-Build via pretest:e2e"
```

---

### Task 3: release-please-Konfiguration + Release-Workflow

**Files:**
- Create: `release-please-config.json`
- Create: `.release-please-manifest.json`
- Create: `.github/workflows/release-please.yml`
- Delete: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: grüner CI-Workflow aus Task 2 (Tag entsteht nur nach CI-geprüftem `main`-Push).
- Produces: GHCR-Images `ghcr.io/oliverbenduhn/tabletto:X.Y.Z` und `:latest`; GitHub-Release + Tag `vX.Y.Z`; Komodo-Webhook-Aufruf. Secrets-Kontrakt: `KOMODO_WEBHOOK_URL`, `KOMODO_WEBHOOK_SECRET`; Repo-Variable `DEPLOY_WEBHOOK_OPTIONAL`.

- [ ] **Step 1: `release-please-config.json` anlegen (Repo-Root)**

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
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

- [ ] **Step 2: `.release-please-manifest.json` anlegen (Repo-Root)**

Aktuelle Version aller drei package.json ist 1.5.0 (verifiziert):

```json
{
  ".": "1.5.0"
}
```

- [ ] **Step 3: `.github/workflows/release-please.yml` anlegen**

```yaml
name: Release

on:
  push:
    branches: [main]
  # Manueller Recovery-Trigger, falls ein Lauf nach dem Auto-Merge abbricht.
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write
  packages: write

concurrency:
  group: release-please
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      # 1. Lauf: erstellt/aktualisiert den Release-PR (Versionsbumps + CHANGELOG).
      - uses: googleapis/release-please-action@v4
        id: release-pr
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      # Auto-Merge: kein manueller Schritt (ADR 0003).
      - name: Release-PR sofort mergen
        if: steps.release-pr.outputs.prs_created == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          pr_number=$(echo '${{ steps.release-pr.outputs.pr }}' | jq -r '.number')
          gh pr merge "$pr_number" --squash --delete-branch --repo "$GITHUB_REPOSITORY"

      # 2. Lauf: sieht den gemergten Release-Commit und erzeugt Tag + GitHub-Release.
      - uses: googleapis/release-please-action@v4
        id: release
        if: steps.release-pr.outputs.prs_created == 'true'
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      # Robustheit: Falls ein früherer Lauf nach dem Merge abbrach, erzeugt
      # schon der ERSTE Action-Aufruf das Release. Outputs beider Aufrufe
      # werden deshalb konsolidiert — sonst entstünde ein Release ohne Image.
      - name: Release-Ausgaben konsolidieren
        id: rel
        run: |
          echo "created=${{ steps.release.outputs.release_created == 'true' || steps.release-pr.outputs.release_created == 'true' }}" >> "$GITHUB_OUTPUT"
          echo "version=${{ steps.release.outputs.version || steps.release-pr.outputs.version }}" >> "$GITHUB_OUTPUT"

      - uses: actions/checkout@v4
        if: steps.rel.outputs.created == 'true'
        with:
          ref: v${{ steps.rel.outputs.version }}

      - uses: docker/setup-buildx-action@v3
        if: steps.rel.outputs.created == 'true'

      - uses: docker/login-action@v3
        if: steps.rel.outputs.created == 'true'
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v6
        if: steps.rel.outputs.created == 'true'
        with:
          context: .
          push: true
          tags: |
            ghcr.io/oliverbenduhn/tabletto:${{ steps.rel.outputs.version }}
            ghcr.io/oliverbenduhn/tabletto:latest

      # Komodo-Deploy: strikt rot bei fehlenden Secrets (ADR 0005),
      # außer DEPLOY_WEBHOOK_OPTIONAL=true (Übergangsphase).
      - name: Komodo-Deploy auslösen
        if: steps.rel.outputs.created == 'true'
        env:
          WEBHOOK_URL: ${{ secrets.KOMODO_WEBHOOK_URL }}
          WEBHOOK_SECRET: ${{ secrets.KOMODO_WEBHOOK_SECRET }}
          WEBHOOK_OPTIONAL: ${{ vars.DEPLOY_WEBHOOK_OPTIONAL }}
        run: |
          if [ -z "$WEBHOOK_URL" ] || [ -z "$WEBHOOK_SECRET" ]; then
            if [ "$WEBHOOK_OPTIONAL" = "true" ]; then
              echo "::notice::Komodo-Webhook übersprungen (DEPLOY_WEBHOOK_OPTIONAL=true, Secrets fehlen)."
              exit 0
            fi
            echo "::error::KOMODO_WEBHOOK_URL/KOMODO_WEBHOOK_SECRET fehlen. Image liegt in GHCR; manueller Redeploy in Komodo möglich."
            exit 1
          fi
          # Komodo-Listener erwartet GitHub-Webhook-Format: HMAC-SHA256 über den Body.
          body='{"ref":"refs/heads/main"}'
          sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')
          curl -fsS -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -H "X-GitHub-Event: push" \
            -H "X-Hub-Signature-256: sha256=$sig" \
            -d "$body"
          echo "Komodo-Deploy ausgelöst."
```

Hinweis für den Implementierer: Der zweite Action-Aufruf arbeitet über die GitHub-API gegen den Remote-Stand — er sieht den soeben gemergten Release-Commit auch ohne erneuten Checkout.

- [ ] **Step 4: `release.yml` löschen**

```bash
git rm .github/workflows/release.yml
```

- [ ] **Step 5: YAML-Syntax prüfen**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release-please.yml')); print('ok')"
python3 -c "import json; json.load(open('release-please-config.json')); json.load(open('.release-please-manifest.json')); print('ok')"
```

Erwartet: zweimal `ok`

- [ ] **Step 6: Commit**

```bash
git add release-please-config.json .release-please-manifest.json .github/workflows/release-please.yml
git commit -m "feat(release): release-please mit Auto-Merge, GHCR-Push und Komodo-Webhook

Ersetzt release.yml (baute das Image und verwarf es, Node 18).
Siehe docs/adr/0003-release-please-direct-commit.md und 0005."
```

---

### Task 4: `compose.yaml` auf GHCR-Image umstellen, `docker-compose.prod.yml` löschen

**Files:**
- Modify: `compose.yaml`
- Delete: `docker-compose.prod.yml`

**Interfaces:**
- Consumes: Image `ghcr.io/oliverbenduhn/tabletto:latest` aus Task 3.
- Produces: einzige Compose-Datei = Prod-Referenz für Komodo.

- [ ] **Step 1: `compose.yaml` ersetzen**

Vollständiger neuer Inhalt (übernimmt die Prod-Niceties aus `docker-compose.prod.yml`: `security_opt`, Ressourcen-Limits, `start_period`, Netzwerk entfällt bewusst — Single-Service-Stack braucht kein benanntes Netz):

```yaml
# Produktions-Compose für Tabletto. Komodo (oder docker compose) zieht das
# in CI gebaute und getestete Image aus GHCR — auf dem Host wird nicht gebaut.
# Für reproduzierbare Deployments :latest durch eine feste Version ersetzen,
# z. B. image: ghcr.io/oliverbenduhn/tabletto:1.6.0
services:
  tabletto:
    image: ghcr.io/oliverbenduhn/tabletto:latest
    pull_policy: always
    container_name: tabletto-app
    ports:
      - "3000:3000"
    volumes:
      - tabletto-data:/app/data
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
      - PORT=3000
      - DB_PATH=/app/data/tabletto.db
      - ENABLE_STOCK_SCHEDULER=${ENABLE_STOCK_SCHEDULER:-true}
      - STOCK_SCHEDULER_CRON=${STOCK_SCHEDULER_CRON:-*/5 * * * *}
      - UPLOADS_PATH=${UPLOADS_PATH:-/app/data/uploads}
      - TZ=${TZ:-Europe/Berlin}
      - TRUST_PROXY=${TRUST_PROXY:-}
    env_file:
      - .env
    healthcheck:
      test: [ "CMD-SHELL", "curl -fsS http://localhost:3000/health | grep -q '\"status\":\"ok\"'" ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

volumes:
  tabletto-data:
    driver: local
```

Achtung: SMTP-Variablen (`SMTP_HOST` etc. aus dem Notification-Feature dieses Branches) kommen über `env_file: .env` herein — prüfe vor dem Ersetzen mit `git diff origin/main -- compose.yaml`, ob dieser Branch bereits weitere `environment`-Einträge ergänzt hat, und übernimm sie.

- [ ] **Step 2: `docker-compose.prod.yml` löschen und Referenzen bereinigen**

```bash
git rm docker-compose.prod.yml
grep -rn 'docker-compose.prod' --include='*.md' . | grep -v node_modules | grep -v superpowers
```

Jede Fundstelle (bekannt: `docs/security.md`, `docs/operations.md`, `docs/development.md`, `PUBLISH.md`) auf `compose.yaml` umstellen bzw. den Satz streichen, wenn er nur die Existenz der zweiten Datei erklärt.

- [ ] **Step 3: Compose-Syntax prüfen**

```bash
docker compose -f compose.yaml config --quiet && echo ok
```

Erwartet: `ok` (Warnung über fehlende `.env`-Datei ist ok; falls sie hart fehlschlägt: `touch .env` im Scratchpad-Kontext vermeiden — stattdessen `JWT_SECRET=x docker compose -f compose.yaml config --quiet`).

- [ ] **Step 4: Commit**

```bash
git add compose.yaml docs/ PUBLISH.md
git commit -m "feat(deploy): compose.yaml zieht GHCR-Image statt Host-Build

docker-compose.prod.yml aufgelöst, Niceties übernommen.
Siehe docs/adr/0002-ghcr-single-image-source.md."
```

---

### Task 5: `version:sync` entfernen

**Files:**
- Delete: `scripts/sync-version.js`
- Modify: `package.json` (Root: Script-Eintrag `version:sync` entfernen)

**Interfaces:**
- Consumes: release-please `extra-files` aus Task 3 (übernimmt die Synchronisierung).
- Produces: nichts — reine Entfernung.

- [ ] **Step 1: Löschen und Script-Eintrag entfernen**

```bash
git rm scripts/sync-version.js
```

In `package.json` die Zeile `"version:sync": "node scripts/sync-version.js",` löschen.

- [ ] **Step 2: Referenzen prüfen**

```bash
grep -rn 'version:sync\|sync-version' --include='*.md' --include='*.json' . | grep -v node_modules | grep -v package-lock | grep -v superpowers
```

Erwartet: nur noch Treffer in `PUBLISH.md` (wird in Task 6 neu geschrieben) — falls andere auftauchen, dort ebenfalls entfernen.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(release): version:sync entfernt, release-please extra-files übernimmt"
```

---

### Task 6: Dokumentation auf den neuen Fluss umschreiben

**Files:**
- Modify: `PUBLISH.md`
- Modify: `DEPLOY-KOMODO.md`
- Modify: `docs/operations.md`

**Interfaces:**
- Consumes: alle vorherigen Tasks (beschreibt deren Endzustand).
- Produces: konsistente Betriebs- und Release-Doku.

- [ ] **Step 1: `PUBLISH.md` neu schreiben**

Kerninhalt (in der bestehenden Doku-Sprache, Deutsch):

- Releases entstehen automatisch: Conventional Commit (`feat:`/`fix:`/`BREAKING CHANGE:`) auf `main` pushen → `release-please.yml` erstellt und merged den Release-PR selbst, erzeugt Tag `vX.Y.Z` + GitHub-Release, baut und pusht `ghcr.io/oliverbenduhn/tabletto:X.Y.Z` und `:latest`, ruft den Komodo-Webhook auf.
- Versionsquellen: release-please bumpt Root-, `backend/`- und `frontend/package.json` synchron (`extra-files`); `CHANGELOG.md` wird generiert. Kein `version:sync`, kein manuelles Tag mehr.
- Version erzwingen: leerer Commit mit `Release-As:`-Footer (`git commit --allow-empty -m "chore: release 2.0.0" -m "Release-As: 2.0.0"`).
- Bekannte Grenze: Der Bump-Commit selbst durchläuft kein CI (GITHUB_TOKEN-Rekursionsschutz) — akzeptiertes Restrisiko, da der Bump deterministisch ist.
- Voraussetzungen-Abschnitt (Secrets `KOMODO_WEBHOOK_URL`/`KOMODO_WEBHOOK_SECRET`, Variable `DEPLOY_WEBHOOK_OPTIONAL` für die Übergangsphase, GHCR-Package public).

- [ ] **Step 2: `DEPLOY-KOMODO.md` aktualisieren**

Ändern:

- Stack-Tabelle: Compose-Pfad bleibt `compose.yaml`, aber Hinweis, dass der Stack das GHCR-Image zieht statt zu bauen; Branch-Empfehlung bleibt Tag-Pinning (Image-Version statt Git-Ref pinnen).
- Neuer Abschnitt „Webhook-Deploy“: In Komodo den Stack-Webhook aktivieren, URL + Secret in GitHub-Secrets `KOMODO_WEBHOOK_URL`/`KOMODO_WEBHOOK_SECRET` hinterlegen; Format ist GitHub-kompatibel (HMAC-SHA256, `X-Hub-Signature-256`).
- Abschnitt „Update und Rollback“ ersetzen: Update = Release mergen (passiert automatisch) oder in Komodo Redeploy klicken (zieht `:latest` per `pull_policy: always`). Rollback = Image-Tag in `compose.yaml`/Komodo auf `X.Y.Z` der Vorversion setzen + Redeploy; bei inkompatiblem Schema zusätzlich Daten-Restore (Verweis `docs/operations.md` bleibt).
- „Häufige Fehler“: Zeile „Build läuft aus Speicher“ ersetzen durch „Image-Pull schlägt fehl → GHCR-Package public? Netzwerk? Tag existiert?“.

- [ ] **Step 3: `docs/operations.md` anpassen**

Alle Stellen, die Host-Build oder `docker-compose.prod.yml` beschreiben, auf das Image-Modell umstellen (Deploy = Image-Pull; Build passiert nur in CI). Backup-/Restore-Abläufe bleiben unverändert.

- [ ] **Step 4: Konsistenz-Grep**

```bash
grep -rn 'docker-compose.prod\|version:sync\|sync-version\|release.yml' --include='*.md' . | grep -v node_modules | grep -v CHANGELOG | grep -v superpowers
```

Erwartet: keine Treffer mehr (CHANGELOG ist historisch und bleibt unangetastet).

- [ ] **Step 5: Commit**

```bash
git add PUBLISH.md DEPLOY-KOMODO.md docs/operations.md
git commit -m "docs(deploy): Release- und Betriebsdoku auf GHCR + release-please + Webhook"
```

---

### Task 7: Gesamtverifikation

**Files:** keine neuen Änderungen — nur Prüfung.

- [ ] **Step 1: Backend-Tests**

```bash
npm test --prefix backend 2>&1 | tail -5
```

Erwartet: alle Tests grün, Exit-Code 0.

- [ ] **Step 2: E2E komplett**

```bash
npm run test:e2e 2>&1 | tail -10
```

Erwartet: `0 failed`, Notification-Specs auf beiden Projekten grün.

- [ ] **Step 3: Branch pushen und CI beobachten**

```bash
git push origin agent/comprehensive-audit-hardening
gh run watch --exit-status $(gh run list --branch agent/comprehensive-audit-hardening --limit 1 --json databaseId --jq '.[0].databaseId')
```

Erwartet: CI-Lauf grün (`test` + `docker`). Falls rot: superpowers:systematic-debugging, nicht raten.

- [ ] **Step 4: Abschlussbericht an den Maintainer**

Zusammenfassen: was gemerged werden muss, und die offenen Maintainer-Voraussetzungen aus der Spec (Komodo-Webhook + Secrets, GHCR public, `DEPLOY_WEBHOOK_OPTIONAL=true` für die Übergangsphase, Komodo-Stack auf Image-Pull umstellen). Erst nach dem ersten echten Release verifizierbar: GHCR-Push und Webhook-Aufruf.
