# Tabletto: verbindliche Arbeitsanweisungen für KI-Agenten

Diese Datei ist die kanonische, werkzeugunabhängige Anleitung für automatisierte
Agenten in diesem Repository. `CLAUDE.md` und `.cursorrules` ergänzen sie nur um
werkzeugspezifische Hinweise. Bei Widersprüchen gelten in dieser Reihenfolge:

1. aktuelle Nutzeranweisung,
2. diese Datei,
3. die versionierte Dokumentation unter `docs/`,
4. bestehende Implementierung und Tests,
5. historische Texte in Changelog oder Release-Anleitungen.

## Auftrag und Systemgrenze

Tabletto ist eine deutschsprachige Webanwendung zur persönlichen Verwaltung von
Medikamentenbeständen. Sie verwaltet keine Rezepte, stellt keine Diagnosen und
gibt keine medizinischen Therapie- oder Dosierungsempfehlungen. Änderungen
dürfen diese Grenze nicht stillschweigend erweitern.

Das System besteht aus:

- React-/Vite-PWA in `frontend/`,
- Express-API in `backend/src/`,
- SQLite-Datenbank und Upload-Verzeichnis,
- zeitgesteuertem Bestandsabzug durch `node-cron`,
- einem gemeinsamen Produktionscontainer auf Port 3000.

## Vor jeder Änderung

1. `git status --short` prüfen und fremde Änderungen erhalten.
2. Die direkt betroffenen Implementierungen, Tests und Dokumente lesen.
3. Nicht von Dokumentation auf Verhalten schließen; den aktuellen Code prüfen.
4. Den kleinsten fachlich vollständigen Änderungssatz bestimmen.
5. Bei Daten-, Auth-, Scheduler- oder Backup-Änderungen die Risiken ausdrücklich
   benennen und passende Tests einplanen.

Keine destruktiven Git-Befehle verwenden. Keine lokalen Datenbanken, `.env`,
Uploads, Testartefakte oder Secrets committen.

## Architekturkarte

### Backend

| Schicht | Ort | Verantwortung |
|---|---|---|
| Einstieg | `backend/src/server.js` | Middleware, Routen, statische PWA, Start/Shutdown |
| Routen | `backend/src/routes/` | HTTP-Methode, Pfad, Middleware-Reihenfolge |
| Controller | `backend/src/controllers/` | HTTP-Validierung, Orchestrierung, Responses |
| Models | `backend/src/models/` | Benutzergebundene Datenzugriffe |
| Services | `backend/src/services/` | Prozessweite Abläufe wie der Scheduler |
| Utilities | `backend/src/utils/` | Berechnung, Validierung und Upload-Pfade |
| Konfiguration | `backend/src/config/` | SQLite-Initialisierung und JWT-Konfiguration |
| Betriebsskripte | `backend/scripts/` | Backup und explizite Datenkorrektur |

Backend-Code bleibt CommonJS. Keine ES-Module in `backend/` einführen, solange
nicht das gesamte Backend bewusst migriert wird.

### Frontend

| Schicht | Ort | Verantwortung |
|---|---|---|
| Routing | `frontend/src/App.jsx` | öffentliche und geschützte Seiten |
| Seiten | `frontend/src/pages/` | Datenladen und seitenweite Orchestrierung |
| Komponenten | `frontend/src/components/` | Darstellung und lokale Interaktion |
| API-Client | `frontend/src/services/api.js` | sämtliche HTTP-Aufrufe und Auth-Header |
| Auth-Helfer | `frontend/src/services/auth.js` | gespeicherte Sitzung lesen/schreiben |
| Utilities | `frontend/src/utils/` | reine Frontend-Hilfsfunktionen |

Frontend-Code bleibt ES Modules und verwendet funktionale React-Komponenten mit
Hooks. Neue API-Aufrufe gehören in `frontend/src/services/api.js`, nicht direkt
in Komponenten.

## Fachliche Invarianten

- Jede benutzerbezogene Datenoperation muss durch `user_id` eingeschränkt sein.
- Ein Medikament eines anderen Benutzers darf weder lesbar noch veränderbar
  noch über History oder Uploads erschließbar sein.
- Bestände werden nie absichtlich unter null reduziert.
- Jede fachliche Bestandsänderung erzeugt einen nachvollziehbaren History-Eintrag.
- Tägliche Medikamente haben `interval_days = 1`; Intervallmedikamente haben
  `interval_days > 1` und verwenden `dosage_per_interval` sowie `next_due_at`.
- `dosage_morning`, `dosage_noon` und `dosage_evening` bilden bei täglichen
  Medikamenten den Tagesverbrauch.
- Zeitgesteuerte Bestandsänderungen müssen idempotent sein. Eine Änderung am
  Scheduler darf keine Mehrfachabbuchung innerhalb eines Zeitfensters zulassen.
- Datums- und Zeitlogik muss die konfigurierte Zeitzone berücksichtigen. Keine
  stillschweigende Mischung lokaler Tagesgrenzen mit UTC-Datumsstrings.
- Löschen eines Medikaments entfernt über den Fremdschlüssel dessen History;
  das zugehörige Foto muss zusätzlich aus dem Dateisystem entfernt werden.
- Import ersetzt aktuell alle Medikamente und History des angemeldeten Benutzers
  innerhalb einer Transaktion. Dieses Verhalten ist eine öffentliche
  Produkteigenschaft und darf nicht beiläufig zu einem Merge geändert werden.

## Backend-Regeln

- 2 Leerzeichen Einrückung und Semikolons entsprechend dem bestehenden Stil.
- Früh zurückkehren bei Validierungs-, Auth- und Not-found-Fehlern.
- Controller liefern JSON im vorhandenen Format: Erfolg als benanntes Objekt,
  Fehler als `{ "error": "..." }`.
- Asynchrone Fehler dürfen den Prozess nicht als unbehandelte Promise-Rejection
  verlassen. Neue Handler an die bestehende Express-Fehlerstrategie anbinden.
- SQL-Platzhalter für alle Werte verwenden. Keine Nutzereingaben in SQL-Strings
  interpolieren.
- Datenzugriffe grundsätzlich in Models bündeln. Direkte SQL-Zugriffe sind nur
  für Schema/Migrationen, klar abgegrenzte Transaktionen, Scheduler und
  Betriebsskripte zulässig.
- Dynamische Spaltenlisten nur aus einer festen Allowlist zusammensetzen.
- Neue Routen werden im passenden Router definiert und bei Bedarf durch
  `authenticateToken` geschützt. Auth ist standardmäßig erforderlich, außer der
  öffentliche Zugriff ist ausdrücklich Teil des Vertrags.
- Eingaben an der HTTP-Grenze validieren und numerische Strings bewusst in
  Zahlen umwandeln. `NaN`, `Infinity`, negative Werte und Obergrenzen prüfen.
- Keine neue Laufzeitabhängigkeit, wenn Plattform- oder vorhandene
  Projektfunktionen ausreichen.
- Benutzerseitige Meldungen auf Deutsch; interne Bezeichner und API-Felder
  bleiben im vorhandenen englischen Stil.

## Datenbank- und Migrationsregeln

- SQLite bleibt die einzige Persistenzschicht, bis eine bewusste
  Architekturentscheidung etwas anderes festlegt.
- Fremdschlüssel bleiben aktiviert; Löschkaskaden nicht umgehen.
- Schemaänderungen müssen sowohl Neuinstallationen im `CREATE TABLE` als auch
  bestehende Installationen über eine idempotente Migration unterstützen.
- Migrationen prüfen den Ist-Zustand mit `PRAGMA table_info` oder einem
  gleichwertigen Mechanismus.
- Bestehende Daten mit deterministischen, dokumentierten Standardwerten
  migrieren.
- Eine fehlgeschlagene Migration nicht kommentarlos verschlucken. Wenn der Start
  trotz Fehler fortgesetzt werden soll, Auswirkung und Recovery dokumentieren.
- Mehrschrittige schreibende Operationen transaktional ausführen und Rollback
  absichern.
- Nach Schemaänderungen `docs/data-model.md`, Import/Export und Tests anpassen.

## Authentifizierung und Sicherheit

- JWTs enthalten derzeit `id` und `email` und laufen nach sieben Tagen ab.
- Geschützte Handler lesen die Benutzer-ID konsistent aus `req.user.id`.
- Passwörter niemals loggen, exportieren oder an das Frontend zurückgeben.
- `JWT_SECRET` ist in Produktion zwingend. Der unsichere Fallback ist keine
  akzeptable Produktionskonfiguration.
- Auth-Endpunkte bleiben rate-limitiert. Änderungen am Limit dokumentieren.
- CORS nicht pauschal erweitern. Produktionsursprung über `FRONTEND_ORIGIN`
  festlegen.
- Token werden aktuell in `localStorage` gespeichert. Diese Entscheidung nicht
  unbemerkt mit einem zweiten Sessionmechanismus vermischen.
- Gesundheits- und Auth-Daten nicht in Logs, Screenshots oder Fehlermeldungen
  offenlegen.

## Upload-Regeln

- Uploads sind auf fünf MiB begrenzt und müssen als Bildtyp akzeptiert werden.
- Serverseitig generierte Dateinamen verwenden; Originalnamen nicht als Pfad.
- Persistente Uploads liegen unter `UPLOADS_PATH`, im Container standardmäßig
  `/app/data/uploads`.
- Pfadauflösung muss Traversal außerhalb des Upload-Roots verhindern. Änderungen
  an Normalisierung oder Löschen benötigen gezielte Sicherheitstests.
- Ersetzte, verworfene oder gelöschte Fotos müssen bestmöglich aufgeräumt werden.
- Importierte externe Foto-URLs sind als eigene Vertrauensgrenze zu behandeln.

## Frontend-Regeln

- Seiten laden Daten; wiederverwendbare Komponenten erhalten Daten und Aktionen
  über Props, sofern kein klarer Grund für anderen Zustand besteht.
- Keine neue globale State-Library ohne nachweisbaren Bedarf.
- Authentifizierte Routen bleiben in `PrivateRoute` gekapselt.
- Bestehende API-Feldnamen nicht nur für UI-Komfort umbenennen.
- Lade-, Leer-, Erfolgs- und Fehlerzustände bei asynchronen Abläufen darstellen.
- Interaktive Elemente müssen per Tastatur erreichbar und sinnvoll beschriftet
  sein. Modale Dialoge benötigen Fokusführung und Escape-/Schließen-Verhalten.
- Sichtbare Touch-Ziele mindestens 44 × 44 CSS-Pixel groß halten.
- Mobile und Desktopdarstellung prüfen; horizontalen Viewport-Overflow vermeiden.
- Farben nie als einziges Statussignal verwenden.
- Keine externe DOM-Manipulationsbibliothek ergänzen. Imperative DOM-Zugriffe nur
  an Bibliotheksgrenzen wie FullCalendar und mit begründetem Kommentar.
- PWA-Caching authentifizierter Antworten nur nach Prüfung von Abmeldung,
  Benutzerwechsel, Veraltung und Datenschutz ändern.
- Benutzerseitige Texte auf Deutsch und Terminologie aus `docs/index.md` nutzen.

## API-Vertragsregeln

- Pfade, Methoden, Request-Felder, Response-Hüllen und Statuscodes sind Vertrag.
- Breaking Changes nicht ohne Versionierungs- und Migrationsplan einführen.
- Fehlerantworten bleiben maschinenlesbar und enthalten keine Stacktraces.
- Datei-Endpunkte verwenden `multipart/form-data`; übrige schreibende Endpunkte
  standardmäßig JSON.
- Listen sind benannt, z. B. `{ "medications": [...] }`, nicht nackte Arrays.
- Nach API-Änderungen `docs/api.md`, den Frontend-Client und E2E-Tests gemeinsam
  aktualisieren.

## Verbotene Patterns

- Benutzerbezogene Queries ohne `user_id`-Filter.
- Direkte `fetch`-Aufrufe außerhalb des zentralen API-Clients.
- SQL-Stringverkettung mit Request-Daten.
- Neue Secrets, Tokens oder echte Gesundheitsdaten im Repository.
- Medizinische Entscheidungen aus Bestandsdaten ableiten.
- Scheduler-Abzüge ohne dedizierten Duplikat-/Idempotenzschutz.
- Nicht transaktionale Ersetzung zusammengehöriger Datenbestände.
- Schemaänderungen nur im Neuanlage-SQL ohne Migration.
- Stilles Ignorieren fehlgeschlagener Tests in neuen CI-Schritten.
- Kopieren der Live-SQLite-Datei als einzig zugesicherte konsistente
  Backupmethode.
- Massive Refactorings zusammen mit einer kleinen Fachänderung.
- Kommentare, die nur den unmittelbar folgenden Code paraphrasieren.
- Duplizieren langer Architektur- oder API-Referenzen in README und Agentendateien.

## Kommentare und DocBlocks

Dokumentiere das Warum, nicht das offensichtliche Was. Kommentare sind angezeigt
bei:

- fachlichen Invarianten und nicht offensichtlichen Grenzwerten,
- Zeit-/Zeitzonenlogik,
- transaktionalen Garantien und ID-Neuzuordnung,
- Sicherheitsgrenzen bei Uploads und Auth,
- Workarounds für Bibliotheksverhalten,
- absichtlich tolerierten Fehlern.

Öffentliche oder komplexe Hilfsfunktionen erhalten kurze JSDoc-Blöcke mit
Eingabe, Ergebnis und relevanten Seiteneffekten. Keine flächendeckenden
DocBlocks für triviale CRUD-Wrapper oder reine Darstellungskomponenten.

## Prüfmatrix

| Änderung | Mindestprüfung |
|---|---|
| Dokumentation | Links, Befehle, Pfade, `git diff --check` |
| Backend-JavaScript | `node --check` für betroffene Dateien |
| Frontend | `npm run build --prefix frontend` |
| API/Auth/Datenmodell | relevante manuelle/API-Prüfung plus E2E |
| UI/Workflow | Playwright Desktop und Mobile |
| Scheduler | deterministische Zeit-/Idempotenztests, Scheduler in E2E aus |
| Docker/Compose | Image bauen, Containerstart und Health prüfen |
| Migration/Import | frische und bestehende DB, Commit und Rollback prüfen |

Repository-Befehle:

```bash
npm run install:all
npm run dev:backend
npm run dev:frontend
npm run build:frontend
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:report
docker compose up -d --build
docker compose logs -f tabletto
```

Backend-`npm test` führt deterministische Kern- und Migrationstests aus. Für
API-, Auth- und UI-Verträge bleibt zusätzlich Playwright erforderlich.

## Dokumentationspflichten

- README bleibt Einstieg und verweist auf Detaildokumente.
- Architekturänderungen nach `docs/architecture.md`.
- Schemaänderungen nach `docs/data-model.md`.
- API-Änderungen nach `docs/api.md`.
- Betriebsänderungen nach `docs/operations.md` und gegebenenfalls `INSTALL.md`.
- Teständerungen nach `docs/testing.md`.
- Sicherheitsrelevante Änderungen nach `docs/security.md`.
- Nutzerrelevante Änderungen nach `CHANGELOG.md`.
- Agentenregeln nur hier kanonisch ändern; Kompatibilitätsdateien kurz halten.

## Bewusste Ist-Zustände

- Foto-Binärdaten sind nicht Teil des JSON-Exports.
- JWTs liegen weiterhin in `localStorage`; private API-Antworten dürfen deshalb
  nicht in Service-Worker-Caches aufgenommen werden.
- Mehrere schreibende App-Replikate auf derselben SQLite-Datei sind kein
  unterstütztes Skalierungsmodell.

## Definition of Done

Eine Änderung ist erst fertig, wenn:

1. sie die fachlichen und Sicherheitsinvarianten erhält,
2. Fehler- und Grenzfälle behandelt sind,
3. passende Prüfungen erfolgreich liefen oder Einschränkungen genannt sind,
4. keine fremden Workspace-Änderungen überschrieben wurden,
5. betroffene Dokumentation und Changelog konsistent sind,
6. die Übergabe geänderte Dateien, Verhalten und Prüfergebnisse knapp nennt.
