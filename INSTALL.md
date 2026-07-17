# Tabletto installieren

## Empfohlen: Docker Compose

### Voraussetzungen

- Docker Engine 20.10 oder neuer
- Docker Compose v2
- freier TCP-Port 3000
- etwa 512 MiB RAM zuzüglich Build-Ressourcen

### 1. Repository und Konfiguration

```bash
git clone https://github.com/oliverbenduhn/tabletto.git
cd tabletto
cp .env.example .env
```

In `.env` mindestens ersetzen:

```dotenv
JWT_SECRET=<langes-zufälliges-secret>
```

Erzeugen:

```bash
openssl rand -base64 48
```

Für eine Domain zusätzlich:

```dotenv
FRONTEND_ORIGIN=https://tabletto.example.org
TZ=Europe/Berlin
```

### 2. Bauen und starten

```bash
docker compose pull tabletto
docker compose up -d
docker compose ps
docker compose logs --tail=100 tabletto
```

Tabletto ist unter <http://localhost:3000> erreichbar. Beim ersten Aufruf einen
Benutzer registrieren.

### 3. Installation prüfen

```bash
curl -i http://localhost:3000/health
```

Erwartet wird HTTP 200 mit JSON `{"status":"ok"}`. Zusätzlich im Browser
Registrierung, Login und das Anlegen eines Testmedikaments testen.

### Persistenz

`compose.yaml` mountet das benannte Volume `tabletto-data` nach `/app/data`.
Dort liegen Datenbank und Uploads. Das Volume bleibt bei `docker compose down`
erhalten.

```bash
docker compose down       # Daten bleiben erhalten
docker compose down -v    # löscht alle Anwendungsdaten
```

Vor `down -v` immer ein geprüftes Backup erstellen. Siehe
[Betriebshandbuch](docs/operations.md#backup-strategie).

## Lokale Installation ohne Docker

### Voraussetzungen

- Node.js 20.17 oder neuer; Node.js 22 empfohlen
- npm
- Buildwerkzeuge für `sqlite3`, falls kein passendes Binary verfügbar ist

```bash
npm run install:all
mkdir -p backend/data backend/uploads
cp .env.example .env
```

Lokale Werte in `.env`:

```dotenv
JWT_SECRET=only-for-local-development
PORT=3000
DB_PATH=./data/tabletto.db
UPLOADS_PATH=./uploads
FRONTEND_ORIGIN=http://localhost:5173
ENABLE_STOCK_SCHEDULER=false
TZ=Europe/Berlin
```

Zwei Terminals starten:

```bash
npm run dev:backend
```

```bash
VITE_API_URL=http://localhost:3000/api npm run dev:frontend
```

Frontend: <http://localhost:5173>, API: <http://localhost:3000/api>.

## Produktionsanforderungen

- HTTPS-Reverse-Proxy
- exaktes `FRONTEND_ORIGIN`
- extern verwaltetes `JWT_SECRET`
- persistentes Datenvolume
- verschlüsselte externe Backups mit Restore-Test
- genau eine scheduleraktive Backendinstanz
- beschränkter Zugriff auf Logs, Daten und Uploads

Details: [Betrieb](docs/operations.md) und [Sicherheit](docs/security.md).

## Update

```bash
git pull --ff-only
docker compose pull tabletto
docker compose up -d
docker compose logs --tail=100 tabletto
```

Vorher sichern. Schemaänderungen werden beim Start automatisch ausgeführt und
haben keinen automatischen Downgradepfad.

## Fehlerbehebung

### Port 3000 belegt

Hostport in `compose.yaml` ändern:

```yaml
ports:
  - "8080:3000"
```

### Container startet nicht

```bash
docker compose ps
docker compose logs --tail=200 tabletto
docker inspect tabletto-app --format '{{json .State.Health}}'
```

Häufige Ursachen: fehlende `.env`, belegter Port, ungültige Volume-Rechte,
fehlgeschlagener Build oder beschädigte Datenbank.

### Daten oder Fotos verschwinden

```bash
docker compose exec tabletto sh -c 'ls -la /app/data /app/data/uploads'
docker volume ls | grep tabletto
docker inspect tabletto-app --format '{{json .Mounts}}'
```

Sicherstellen, dass `DB_PATH` und `UPLOADS_PATH` innerhalb des persistierten
Mounts liegen.

### Login nach Konfigurationsänderung ungültig

Eine Änderung von `JWT_SECRET` macht alle vorhandenen JWTs ungültig. Neu
anmelden. Passwörter und Daten bleiben bestehen.

### Unerwartete Mehrfachabzüge

Scheduler deaktivieren, History und `stock_deductions` prüfen sowie Anzahl
laufender Container, Cron- und Einnahmezeiten kontrollieren. Der dauerhafte
Ausführungsmarker verhindert eine zweite Buchung desselben geplanten Slots.
