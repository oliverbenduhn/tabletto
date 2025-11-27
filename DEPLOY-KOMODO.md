# Tabletto mit Komodo/Portainer/Yacht deployen

Diese Anleitung zeigt, wie du Tabletto mit einem Klick in Komodo, Portainer oder ähnlichen Docker-Management-Tools deployen kannst.

## 🚀 One-Click-Deployment

### Komodo

1. **Stack erstellen**
   - Öffne Komodo
   - Navigiere zu "Stacks"
   - Klicke auf "New Stack" oder "Add Stack"

2. **Repository konfigurieren**
   - **Name**: `tabletto`
   - **Repository URL**: `https://github.com/oliverbenduhn/tabletto.git`
   - **Branch**: `main`
   - **Compose File Path**: `compose.yaml`

3. **Umgebungsvariablen (optional aber empfohlen)**
   - `JWT_SECRET`: Dein sicheres Secret (generiere mit `openssl rand -base64 32`)

4. **Deploy klicken**
   - Klicke auf "Deploy" oder "Start"
   - Warte bis der Build abgeschlossen ist (kann 2-5 Minuten dauern)

5. **Fertig!**
   - Öffne `http://dein-server:3000`

### Portainer

1. **Stack hinzufügen**
   - Navigiere zu "Stacks"
   - Klicke auf "+ Add stack"

2. **Repository-Option wählen**
   - Name: `tabletto`
   - **Repository**:
     - Repository URL: `https://github.com/oliverbenduhn/tabletto`
     - Repository reference: `refs/heads/main`
     - Compose path: `compose.yaml`

3. **Environment Variables (optional)**
   - Füge hinzu:
     ```
     JWT_SECRET=dein-sicheres-secret-hier
     ```

4. **Deploy the stack**
   - Klicke unten auf "Deploy the stack"
   - Warte auf den Build-Prozess

5. **Zugriff**
   - Tabletto läuft auf Port `3000`

### Yacht

1. **Deploy**
   - Klicke auf "Deploy"
   - Wähle "Deploy from Git Repository"

2. **Konfiguration**
   - **Name**: `tabletto`
   - **Git Repository**: `https://github.com/oliverbenduhn/tabletto.git`
   - **Branch**: `main`
   - **Compose File**: `compose.yaml`

3. **Umgebungsvariablen**
   - `JWT_SECRET`: Dein Secret

4. **Deploy**
   - Klicke "Deploy"

### Dockge

1. **New Compose**
   - Klicke auf "+ Compose"

2. **From Git**
   - Wähle "Import from Git"
   - URL: `https://github.com/oliverbenduhn/tabletto.git`
   - Branch: `main`
   - Compose File: `compose.yaml`

3. **Deploy**

## 📝 Wichtige Hinweise

### JWT_SECRET ändern (WICHTIG für Produktion!)

Das Standard-Secret ist **NICHT SICHER**. Ändere es unbedingt!

**Möglichkeit 1: In Komodo/Portainer**
- Füge Umgebungsvariable hinzu: `JWT_SECRET=dein-secret`

**Möglichkeit 2: Nach dem Deployment**
```bash
# Container bearbeiten und JWT_SECRET neu setzen
docker exec tabletto printenv JWT_SECRET  # Zeigt aktuelles Secret

# Container neu starten mit neuem Secret
docker stop tabletto
docker rm tabletto
# In deinem Management-Tool: Füge JWT_SECRET hinzu und redeploy
```

**Secret generieren:**
```bash
openssl rand -base64 32
```

### Ports anpassen

Falls Port 3000 belegt ist, ändere in der `compose.yaml`:
```yaml
ports:
  - "8080:3000"  # Nutzt Port 8080 statt 3000
```

### Daten-Backup

Die Datenbank wird in einem Docker Volume gespeichert: `tabletto-data`

**Backup erstellen:**
```bash
docker exec tabletto sqlite3 /app/data/tabletto.db ".backup /app/data/backup.db"
docker cp tabletto:/app/data/backup.db ./tabletto-backup-$(date +%Y%m%d).db
```

**Backup wiederherstellen:**
```bash
docker cp ./tabletto-backup-YYYYMMDD.db tabletto:/app/data/tabletto.db
docker restart tabletto
```

### HTTPS / Reverse Proxy

Für Produktions-Deployments solltest du einen Reverse Proxy verwenden:

**Nginx Proxy Manager** (empfohlen für Komodo-Nutzer):
1. Füge einen neuen Proxy Host hinzu
2. **Domain**: `tabletto.deine-domain.de`
3. **Forward Hostname/IP**: `tabletto` (Container-Name)
4. **Forward Port**: `3000`
5. **SSL**: Aktiviere "Force SSL" und "HTTP/2 Support"
6. Lasse ein Let's Encrypt Zertifikat generieren

**Traefik Labels** (falls du Traefik verwendest):
```yaml
services:
  tabletto:
    build: .
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.tabletto.rule=Host(`tabletto.deine-domain.de`)"
      - "traefik.http.routers.tabletto.entrypoints=websecure"
      - "traefik.http.routers.tabletto.tls.certresolver=letsencrypt"
      - "traefik.http.services.tabletto.loadbalancer.server.port=3000"
```

## 🔍 Monitoring & Logs

### Logs anzeigen

**In Komodo/Portainer:**
- Gehe zu deinem Stack
- Klicke auf den Container "tabletto"
- Wähle "Logs"

**Via CLI:**
```bash
docker logs -f tabletto
```

### Health Check

Tabletto hat einen Health-Endpoint:
```bash
curl http://localhost:3000/health
```

Erwartete Antwort:
```json
{"status":"ok"}
```

### Container Status

```bash
docker ps | grep tabletto
```

## 🐛 Problembehandlung

### Build schlägt fehl

**Problem**: Out of memory während des Builds
**Lösung**: Erhöhe Docker Memory Limit auf mindestens 2GB

**Problem**: Network timeout
**Lösung**: Prüfe Internet-Verbindung, probiere erneut

### Container startet nicht

```bash
# Logs prüfen
docker logs tabletto

# Häufige Ursachen:
# - Port 3000 bereits belegt → Ändere Port in compose.yaml
# - Volume-Berechtigungen → Prüfe Docker Volume Permissions
```

### Kann nicht auf Port 3000 zugreifen

```bash
# Prüfe ob Container läuft
docker ps | grep tabletto

# Prüfe Port-Mapping
docker port tabletto

# Prüfe Firewall
sudo ufw status
sudo ufw allow 3000/tcp  # Falls nötig
```

### JWT-Token-Fehler

Das passiert wenn `JWT_SECRET` geändert wurde während Nutzer eingeloggt sind.

**Lösung**: Nutzer müssen sich neu einloggen.

## 📊 Ressourcen-Anforderungen

**Minimum:**
- CPU: 0.5 Cores
- RAM: 256 MB
- Disk: 500 MB (+ Datenbank-Wachstum)

**Empfohlen:**
- CPU: 1 Core
- RAM: 512 MB
- Disk: 2 GB

## 🔄 Updates

Wenn eine neue Version verfügbar ist:

**In Komodo/Portainer:**
1. Gehe zu deinem Stack
2. Klicke "Pull & Redeploy" oder "Update"
3. Das Repository wird neu geklont und der Container neu gebaut

**Via CLI:**
```bash
cd /pfad/zum/stack
git pull
docker compose build --no-cache
docker compose up -d
```

## 📚 Weitere Informationen

- Vollständige Installationsanleitung: [INSTALL.md](INSTALL.md)
- Technische Dokumentation: [README.md](README.md)
- GitHub Publishing Guide: [PUBLISH.md](PUBLISH.md)
