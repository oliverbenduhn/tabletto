# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt hält sich an [Semantic Versioning](https://semver.org/lang/de/).

## [1.3.0] - 2025-12-24

### Hinzugefügt
- 🧠 Benutzerpräferenzen serverseitig gespeichert (Dashboard- und Kalender-Ansicht)
- 📁 Upload-Pfad konfigurierbar über `UPLOADS_PATH` (Persistenz über Volume)
- 🗓️ Mobile Monatsansicht im Kalender
- 🏷️ Hinweis in der Listenansicht für den Tag, an dem ein Medikament leer geht

### Geändert
- 📉 Bestandsabzug läuft immer um 02:00 (unabhängig von manuellen Änderungen)
- 📆 Kalender-Monatsansicht ohne erzwungene 6-Wochen-Ansicht und ohne Fremdmonatstage
- 📋 Listenansicht zeigt Resttage relativ zum Listentag
- 🔧 Wochenansicht entfernt
- 📦 Version auf 1.3.0 erhöht

## [1.0.5] - 2025-11-27

### Hinzugefügt
- ✨ Versionsnummer wird nun im Header angezeigt (rechts neben "Tabletto")
- 🎨 Android-Style Menü mit drei Punkten im Header
- 📦 Import/Export-Funktionalität für alle Benutzerdaten
  - Export als JSON-Datei mit Datum im Dateinamen
  - Import mit Warnung vor Überschreiben bestehender Daten
  - Kompletter Backup aller Medikamente und Historie
- 🔧 Neue API-Endpunkte:
  - `GET /api/data/export` - Exportiert alle Daten
  - `POST /api/data/import` - Importiert Backup-Daten
- 📝 Root package.json für besseres Versionsmanagement
- 🤖 GitHub Actions Workflow für automatische Releases
- 📋 Script zum Synchronisieren der Versionsnummern

### Geändert
- 🎨 Menü-Button ersetzt alten Logout-Button im Header
- 📦 Version auf 1.0.5 erhöht

## [1.0.2] - 2025-11-23

### Hinzugefügt
- 🏥 Health-Check-Endpunkt bei `/health`
- 🔐 Sicherer Docker-Entrypoint mit non-root User
- 📝 Umfassende Dokumentation (CLAUDE.md, DEPLOY-KOMODO.md)
- 🐳 Docker Compose Konfigurationen für verschiedene Szenarien
- 🔧 Named Docker Volumes für stabile Persistenz

### Geändert
- 🔒 Verbesserte CORS-Konfiguration
- 📦 Vite Build-Output zu `build` statt `dist`

## [1.0.0] - 2025-11-20

### Hinzugefügt
- 🎉 Erste stabile Release-Version
- 👤 Benutzer-Authentifizierung (JWT)
- 💊 Medikamentenverwaltung (CRUD)
- 📊 Automatische Bestandsberechnung
- ⚠️ Warnsystem bei niedrigem Bestand
- 📜 Historie aller Bestandsänderungen
- 🐳 Docker Support mit Multi-Stage Build
- 📱 Responsive UI mit Tailwind CSS
- 🔐 Sichere Passwort-Verwaltung (bcrypt)
- 📈 Automatische Berechnungen:
  - Täglicher Verbrauch
  - Verbleibende Tage
  - Depletion-Datum
  - Warning-Status

---

## Versionierung

- **MAJOR** (X.0.0): Breaking Changes, Inkompatible API-Änderungen
- **MINOR** (0.X.0): Neue Features, abwärtskompatibel
- **PATCH** (0.0.X): Bugfixes, abwärtskompatibel

## Links

- [GitHub Repository](https://github.com/oliverbenduhn/tabletto)
- [Dokumentation](README.md)
- [Deployment Guide](DEPLOY-KOMODO.md)
