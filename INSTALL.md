# Tabletto - Installationsanleitung

## Schnellstart mit Docker Compose

### Voraussetzungen
- Docker (Version 20.10 oder höher)
- Docker Compose (Version 2.0 oder höher)

### Installation in 3 Schritten

#### 1. Repository klonen oder herunterladen
```bash
git clone <repository-url> tabletto
cd tabletto
```

#### 2. Umgebungsvariablen konfigurieren
```bash
cp .env.example .env
```

Öffne die `.env` Datei und ändere mindestens das `JWT_SECRET`:
```bash
JWT_SECRET=dein-sehr-sicheres-geheimes-passwort-hier
```

**Wichtig:** Verwende ein sicheres, zufälliges Secret! Generiere eins mit:
```bash
openssl rand -base64 32
```

#### 3. Container starten
```bash
docker compose up -d
```

Das war's! Die Anwendung ist jetzt verfügbar unter: **http://localhost:3000**

### Erste Schritte
1. Öffne http://localhost:3000 in deinem Browser
2. Registriere einen neuen Benutzer
3. Beginne mit dem Hinzufügen deiner Medikamente

## Verwaltung

### Container-Status prüfen
```bash
docker compose ps
```

### Logs anzeigen
```bash
docker compose logs -f
```

### Container neu starten
```bash
docker compose restart
```

### Container stoppen
```bash
docker compose down
```

### Container stoppen und Daten löschen
```bash
docker compose down -v
```
**Achtung:** Dies löscht alle deine Daten!

## Daten-Backup

### Backup erstellen
```bash
docker compose exec tabletto sqlite3 /app/data/tabletto.db ".backup /app/data/backup.db"
docker compose cp tabletto:/app/data/backup.db ./backup-$(date +%Y%m%d-%H%M%S).db
```

### Backup wiederherstellen
```bash
docker compose down
docker compose cp ./backup-YYYYMMDD-HHMMSS.db tabletto:/app/data/tabletto.db
docker compose up -d
```

## Produktions-Deployment

Für Produktionsumgebungen:

1. Verwende die `compose.yaml` Datei (bereits optimiert für Produktion)
2. Setze ein starkes `JWT_SECRET`
3. Verwende einen Reverse Proxy (nginx, Traefik) mit HTTPS
4. Richte regelmäßige Backups ein
5. Überwache die Logs und den Health-Endpoint

### Beispiel nginx-Konfiguration
```nginx
server {
    listen 80;
    server_name tabletto.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tabletto.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Problembehandlung

### Container startet nicht
```bash
# Prüfe Logs
docker compose logs

# Prüfe ob Port 3000 bereits belegt ist
sudo netstat -tlnp | grep 3000
```

### Datenbank-Fehler
```bash
# Prüfe Berechtigungen des data-Verzeichnisses
docker compose exec tabletto ls -la /app/data

# Setze Berechtigungen zurück
docker compose down
docker volume rm tabletto_tabletto-data
docker compose up -d
```

### Performance-Probleme
- Prüfe verfügbaren Speicherplatz
- Prüfe Docker-Ressourcen (CPU/RAM)
- Erstelle regelmäßig Backups und lösche alte History-Einträge

## Erweiterte Konfiguration

### Umgebungsvariablen

Alle verfügbaren Umgebungsvariablen in der `.env` Datei:

| Variable | Beschreibung | Standard | Erforderlich |
|----------|--------------|----------|--------------|
| `JWT_SECRET` | Secret für JWT-Token-Signierung | - | **Ja** |
| `PORT` | Server Port | 3000 | Nein |
| `DB_PATH` | Pfad zur SQLite-Datenbank | /app/data/tabletto.db | Nein |
| `NODE_ENV` | Node.js Umgebung | production | Nein |

### Port ändern

Um einen anderen Port zu verwenden, ändere in `compose.yaml`:
```yaml
ports:
  - "8080:3000"  # Verwendet Port 8080 statt 3000
```

### Externes Datenverzeichnis verwenden

Bearbeite `compose.yaml` und kommentiere die Bind-Mount-Zeile ein:
```yaml
volumes:
  # - tabletto-data:/app/data  # Kommentiere diese Zeile aus
  - ./data:/app/data  # Aktiviere diese Zeile für lokales Verzeichnis
```

## Support

Bei Problemen oder Fragen:
- Prüfe die Logs: `docker compose logs -f`
- Öffne ein Issue im Repository
- Prüfe die [README.md](README.md) für weitere Details
