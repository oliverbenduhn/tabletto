# Tabletto auf GitHub veröffentlichen

Diese Anleitung zeigt dir, wie du Tabletto auf GitHub veröffentlichst, damit andere es einfach installieren können.

## Schritt 1: GitHub Repository erstellen

### Option A: Via GitHub Website (einfacher)

1. Gehe zu <https://github.com/new>
2. Erstelle ein neues Repository:
   - **Repository name**: `tabletto`
   - **Description**: `Webbasierte Medikamentenverwaltung mit Bestandsverfolgung`
   - **Visibility**: ✅ Public (damit andere es nutzen können)
   - **❌ NICHT** "Initialize this repository with" - Optionen auswählen (wir haben bereits Code)
3. Klicke auf "Create repository"

### Option B: Via GitHub CLI (gh)

```bash
# GitHub CLI installiert? Prüfe mit:
gh --version

# Repository erstellen
gh repo create tabletto --public --description "Webbasierte Medikamentenverwaltung mit Bestandsverfolgung"
```

## Schritt 2: Lokales Repository mit GitHub verbinden

Nach dem Erstellen des GitHub-Repos zeigt GitHub dir Befehle. Verwende diese:

```bash
# Falls noch kein Git-Repository initialisiert
git init
git add .
git commit -m "Initial commit"
git branch -M main

# Remote hinzufügen (ersetze USERNAME mit deinem GitHub-Benutzernamen)
git remote add origin https://github.com/USERNAME/tabletto.git

# Oder mit SSH (empfohlen wenn SSH-Keys eingerichtet sind):
git remote add origin git@github.com:USERNAME/tabletto.git

# Code hochladen
git push -u origin main
```

## Schritt 3: Neue Dateien committen

Die neu erstellten Dateien müssen noch committed werden:

```bash
# Neue Dateien hinzufügen
git add INSTALL.md docker-compose.prod.yml README.md .gitignore

# Commit erstellen
git commit -m "Add installation guide and production docker-compose"

# Pushen
git push
```

## Schritt 4: Repository-Beschreibung anpassen (optional)

Auf GitHub im Repository:
1. Gehe zu "Settings"
2. Füge "Topics" hinzu: `medication`, `docker`, `nodejs`, `react`, `sqlite`
3. Setze die Website-URL (falls deployed)

## ✅ Fertig! Andere können jetzt installieren mit:

```bash
git clone https://github.com/USERNAME/tabletto.git
cd tabletto
cp .env.example .env
# .env bearbeiten und JWT_SECRET setzen
docker compose up -d
```

## Zusätzliche Empfehlungen

### 1. GitHub Actions für CI/CD (optional)

Erstelle `.github/workflows/docker-build.yml`:

```yaml
name: Docker Build

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Build Docker image
      run: docker build -t tabletto .

    - name: Test Docker image
      run: |
        docker run -d -p 3000:3000 -e JWT_SECRET=test-secret tabletto
        sleep 10
        curl -f http://localhost:3000/health || exit 1
```

### 2. Docker Hub Image veröffentlichen (optional)

Falls du ein vorgefertigtes Docker-Image bereitstellen möchtest:

```bash
# Bei Docker Hub anmelden
docker login

# Image bauen
docker build -t USERNAME/tabletto:latest .

# Image pushen
docker push USERNAME/tabletto:latest
```

Dann in der README.md angeben:

```bash
# Alternative: Vorgefertigtes Image von Docker Hub
docker run -d -p 3000:3000 \
  -v tabletto-data:/app/data \
  -e JWT_SECRET=your-secret \
  USERNAME/tabletto:latest
```

### 3. Release erstellen

Auf GitHub:
1. Gehe zu "Releases" → "Create a new release"
2. Tag: `v1.0.0`
3. Title: `Tabletto v1.0.0`
4. Beschreibung der Features
5. "Publish release"

### 4. LICENSE Datei (empfohlen)

Erstelle eine `LICENSE` Datei. Für Open Source z.B. MIT License:

```bash
# MIT License Beispiel
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2025 [Dein Name]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

## Wichtige Sicherheitshinweise

✅ **IMMER sicherstellen, dass NICHT committed wird:**
- `.env` Dateien mit echten Secrets
- `data/` Verzeichnis mit Datenbank
- `node_modules/`
- Persönliche Zugangsdaten

✅ **IMMER im Repository enthalten:**
- `.env.example` (mit Platzhaltern)
- `README.md` mit Installationsanleitung
- `INSTALL.md` mit Details
- `Dockerfile` und `compose.yaml`
- `.gitignore`

## Aktualisierungen veröffentlichen

Wenn du Änderungen machst:

```bash
# Änderungen committen
git add .
git commit -m "Beschreibung der Änderungen"
git push

# Neue Version taggen
git tag v1.0.1
git push --tags
```

## Support für Nutzer

Erstelle auf GitHub:
- **Issues**: Für Bug-Reports und Feature-Requests
- **Discussions**: Für Fragen und Hilfe
- **Wiki**: Für erweiterte Dokumentation (optional)

## Beispiel README-Ergänzung

Füge am Ende der README.md hinzu:

```markdown
## Installation

Siehe [INSTALL.md](INSTALL.md) für die vollständige Installationsanleitung.

## Support

Bei Fragen oder Problemen:
- Öffne ein [Issue](https://github.com/USERNAME/tabletto/issues)
- Siehe [Discussions](https://github.com/USERNAME/tabletto/discussions)

## Lizenz

[MIT](LICENSE)
```
