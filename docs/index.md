# Tabletto-Wiki

Dieses Verzeichnis ist die versionierte technische Referenz für Tabletto. Die
Dokumentation beschreibt den aktuellen Codezustand; bekannte Abweichungen sind
explizit markiert.

## Dokumentationskarte

| Ziel | Dokument |
|---|---|
| Projekt starten und einordnen | [README](../README.md) |
| Komponenten und Datenflüsse verstehen | [Architektur](architecture.md) |
| Tabellen, Felder und Migrationen prüfen | [Datenmodell](data-model.md) |
| HTTP-Verträge integrieren | [API](api.md) |
| lokal entwickeln | [Entwicklung](development.md) |
| deployen, sichern und diagnostizieren | [Betrieb](operations.md) |
| Qualität prüfen | [Tests](testing.md) |
| Schutzgrenzen beurteilen | [Sicherheit](security.md) |
| als KI-Agent Änderungen durchführen | [AGENTS.md](../AGENTS.md) |

## Systemüberblick

Tabletto ist eine Einzelcontainer-Anwendung. Express stellt die API, Uploads und
den gebauten React-Client bereit. SQLite speichert Benutzer, Medikamente und
Bestandshistorie. Ein Scheduler im Backendprozess prüft individuelle
Einnahmezeiten und zieht fällige Mengen ab.

## Kernbegriffe

| Begriff | Einheitliche Bedeutung |
|---|---|
| Medikament | benutzergebundener Bestand mit Einnahme- und Warnparametern |
| tägliches Medikament | Medikament mit `interval_days = 1` |
| Intervallmedikament | Medikament mit `interval_days > 1` |
| Tagesverbrauch | Summe aus Morgen-, Mittag- und Abenddosierung |
| Dosis pro Intervall | `dosage_per_interval` bei mehrtägigem Intervall |
| Reichweite | aus Bestand, Dosis und Intervall berechnete Resttage |
| Leerstandsdatum | aus der aktuellen Reichweite abgeleitetes Datum |
| Warngrenze | benutzerspezifische Resttage bis zum Status `critical` |
| Bestandsereignis | History-Eintrag mit Aktion, altem und neuem Bestand |
| Einnahmezeit | benutzerspezifische Uhrzeit für Morgen, Mittag oder Abend |

UI-Texte sind Deutsch. Interne Bezeichner, Datenbankspalten und API-Felder sind
Englisch und verwenden überwiegend `snake_case`; Präferenz-Payloads verwenden
teilweise `camelCase`.

## Quellenhierarchie

- Ausführbarer Code und Tests belegen das aktuelle Verhalten.
- Dieses Wiki erklärt Verträge, Zusammenhänge und bekannte Einschränkungen.
- Die README bleibt ein Einstieg und dupliziert keine vollständige Referenz.
- `CHANGELOG.md` beschreibt historische Releases, nicht den aktuellen Vertrag.
- `AGENTS.md` enthält normative Regeln für automatisierte Änderungen.

## Bewusste Einschränkungen

Foto-Binärdaten sind nicht Teil des JSON-Exports. JWTs werden clientseitig in
`localStorage` gehalten, authentifizierte API-Antworten deshalb bewusst nicht von
der PWA gecacht. SQLite ist für einen einzelnen Anwendungscontainer vorgesehen.

## Dokumentationspflege

Änderungen an Verträgen werden im selben Commit dokumentiert:

- API oder Payload: `api.md`
- Schema oder Migration: `data-model.md`
- Komponentengrenze oder Datenfluss: `architecture.md`
- Umgebungsvariable, Deployment oder Backup: `operations.md`
- Teststrategie oder CI: `testing.md`
- Auth-, Upload-, Cache- oder Datenschutzgrenze: `security.md`
- nutzerrelevante Änderung: `CHANGELOG.md`
