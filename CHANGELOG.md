# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt hält sich an [Semantic Versioning](https://semver.org/lang/de/).

## [1.7.0](https://github.com/oliverbenduhn/tabletto/compare/v1.6.0...v1.7.0) (2026-07-17)


### Features

* **legal:** footer link to legal.benduhn.de ([62dd776](https://github.com/oliverbenduhn/tabletto/commit/62dd776a5e9806cc4064a56f4ac9e154e7fc4202))
* PWA-Unterstützung hinzufügen ([7973aa0](https://github.com/oliverbenduhn/tabletto/commit/7973aa00f7f52bd401671af2fcd9faa5e04dc46a))


### Bug Fixes

* **legal:** replace JSX string expression with HTML entity ([e97e478](https://github.com/oliverbenduhn/tabletto/commit/e97e478d20e635dfe41bc27309935a0102ebb146))
* **legal:** use CSS class instead of inline style object ([0225c33](https://github.com/oliverbenduhn/tabletto/commit/0225c33e15bda11b0cdc5777d16d6193fdb1b2ee))
* **release:** Tagformat und Recovery kompatibel machen ([#7](https://github.com/oliverbenduhn/tabletto/issues/7)) ([f8b1a2a](https://github.com/oliverbenduhn/tabletto/commit/f8b1a2ae852bcf0f4293b8836f87268a15d17745))

## [1.6.0](https://github.com/oliverbenduhn/tabletto/compare/tabletto-v1.5.0...tabletto-v1.6.0) (2026-07-17)


### Features

* **legal:** footer link to legal.benduhn.de ([62dd776](https://github.com/oliverbenduhn/tabletto/commit/62dd776a5e9806cc4064a56f4ac9e154e7fc4202))
* PWA-Unterstützung hinzufügen ([7973aa0](https://github.com/oliverbenduhn/tabletto/commit/7973aa00f7f52bd401671af2fcd9faa5e04dc46a))


### Bug Fixes

* **legal:** replace JSX string expression with HTML entity ([e97e478](https://github.com/oliverbenduhn/tabletto/commit/e97e478d20e635dfe41bc27309935a0102ebb146))
* **legal:** use CSS class instead of inline style object ([0225c33](https://github.com/oliverbenduhn/tabletto/commit/0225c33e15bda11b0cdc5777d16d6193fdb1b2ee))

## [Unreleased]

### Benachrichtigungen

- optionale E-Mail-Benachrichtigungen pro Benutzer (Opt-in): wöchentliche
  Bestandsinfo-Mail sonntags 18:00 sowie konsolidierte Statuswarnung bei
  Verschlechterung des Warnstatus; SMTP global über `.env`
- Glossar (`CONTEXT.md`) und ADR zur SMTP-Konfiguration in der
  Backend-Umgebung ergänzt

### Sicherheit und Zuverlässigkeit

- Produktionsstart ohne echtes `JWT_SECRET` unterbunden und Security-Header ergänzt
- private PWA-API-Caches entfernt und Alt-Caches beim Logout bereinigt
- Uploads auf geprüfte Bildsignaturen, Root-Containment und signierte Kurzzeit-URLs gehärtet
- Bestandsänderungen und History transaktional serialisiert
- Scheduler mit dauerhaften Idempotenzmarkern, Zeitzonenlogik und Catch-up abgesichert
- Import/Export 2.0 mit vollständiger Vorvalidierung, Intervallfeldern und Rollback repariert
- konsistentes SQLite-Online-Backup inklusive Uploads umgesetzt
- Containerstart durch reproduzierbaren nativen SQLite-Build, normalisierte
  Leserechte und entfallenes rekursives Laufzeit-`chown` repariert
- Releases an erfolgreiche CI gekoppelt, E2E-Projekte per Datenbank isoliert und
  GHCR als einzige Produktionsimage-Quelle mit signiertem Komodo-Deploy eingeführt

### UI und Qualität

- Intervallformular, irreversible Importbestätigung, Sessionablauf und Tastaturnavigation verbessert
- Kalender auf einzelne prognostizierte Leerstandsereignisse und einheitliche Statusbegriffe umgestellt
- deutsche History-Bezeichnungen, 404-Seite und lokale Systemschriften ergänzt
- Backend-, Migrations-, API-, Mandanten-, Upload- und Scheduler-Tests sowie verpflichtende CI ergänzt
- Laufzeitbasis und Abhängigkeiten auf Node.js 22, Express 5 und sichere Paketstände aktualisiert

### Dokumentation

- Dual-Target-Dokumentation für Entwickler und KI-Agenten neu strukturiert
- kompakten Projekteinstieg und versioniertes Wiki für Architektur, Datenmodell,
  API, Entwicklung, Betrieb, Tests und Sicherheit ergänzt
- kanonisches `AGENTS.md` sowie Adapter für Claude und Cursor hinzugefügt
- Installations-, Komodo- und Release-Anleitungen mit dem aktuellen Codezustand
  abgeglichen
- zuvor dokumentierte Einschränkungen bei Import/Export, Health, Scheduler,
  Backup, PWA-Cache und CI behoben und Dokumentation synchronisiert

## [1.5.0] - 2026-03-28

### Geändert
- 📦 Version auf 1.5.0 erhöht

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
