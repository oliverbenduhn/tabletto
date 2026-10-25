<!-- Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4 -->
# Master-Audit Tabletto – 25.10.2026

## Prüfrahmen und Ergebnis

Geprüfter Stand: Commit `1412fef`, Version 1.8.0. Der Workspace war zu Beginn sauber. Dieses Audit verändert ausschließlich diesen Bericht; es enthält keine Fehlerkorrekturen. Alle Reproduktionen verwenden synthetische Daten und isolierte Testdatenbanken.

**26 Befunde: 0 kritisch, 8 hoch, 14 mittel, 3 niedrig, 1 Vorschlag.** „Hoch“ bedeutet hier insbesondere falsche Bestände, fehlgeschlagene Wiederherstellung oder verlorene Warnungen. Ein belegter vollständiger Mandantendurchbruch wurde nicht gefunden. Das ist keine Garantie, dass keine weiteren Fehler existieren.

Die tragfähigen Grundlagen sind sichtbar: benutzergebundene CRUD-Abfragen, parametrisierte SQL-Werte, Fremdschlüssel mit Kaskaden, transaktionale manuelle Bestandsänderungen, persistenter Scheduler-Duplikatschutz, Upload-Signaturprüfung, Produktionspflicht für das JWT-Secret und kein Service-Worker-Cache für private API-Antworten. Die wesentlichen Defekte liegen an den Grenzen zwischen diesen Mechanismen.

### Vorgehen

1. Architektur, Abhängigkeiten, Datenmodell, Betriebs- und Sicherheitsdokumentation gesichtet.
2. Registrierung/Login, Medikament anlegen/bearbeiten/löschen, Bestandsänderung, Historie, Fotos, Kalender, Einstellungen, Benachrichtigungen und Import/Export durch die Schichten verfolgt.
3. Controller, Models, Validierung, Scheduler, zentrale React-Komponenten, API-Client, PWA-Konfiguration, Backup, Docker und CI statisch geprüft.
4. Backendtests, Produktionsbuild und vorhandene Playwright-Suite ausgeführt; gezielte Bestands-/Import-Reproduktionen ergänzt und Desktop-/Mobile-Screenshots gesichtet. Hallmark wurde ergänzend für den visuellen Audit genutzt; Geschmacksfragen sind keine funktionalen Defekte.

### Ausgeführte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| `npm test --prefix backend` | 6 bestanden, 0 fehlgeschlagen |
| `npm run test:e2e` einschließlich Frontendbuild | Build erfolgreich; 39 bestanden, 1 fehlgeschlagen, 2 übersprungen |
| Desktop-/Mobile-Workflow | Erfolgreich bei 1440 × 900 und 412 × 839 CSS-Pixeln |
| Vorhandene UX-Messpunkte | Kein Seiten-Overflow und keine gemeldeten Touch-Ziele unter 44 × 44; diese Checks ersetzen keine Tastatur-/Kontrastprüfung |
| Isolierte Export-/Import-/Scheduler-Reproduktion | Doppelabbuchung bestätigt: Bestand 9 → Import → Scheduler → Bestand 8 |
| Isolierte Statistikberechnung | Intervallmedikament mit Bestand 0 und nächstem Termin in zehn Tagen erhält zehn Resttage und Status `warning` |
| Import eines alten Intervalltermins | Ablehnung mit „Nächste Einnahme darf nicht in der Vergangenheit liegen“ bestätigt |
| Browserkonsole Kalender | CSP blockiert die eingebettete FullCalendar-Schrift; Navigationssymbole fehlen auch im Screenshot |

Die ergänzende Browserprobe bestätigte die CSP-Fehler; ihre nachfolgende Abfrage eines nur in der Listenansicht vorhandenen Leerzustand-Selektors lief in der Monatsansicht in einen Timeout. Die englische Meldung ist durch den bereits gesichteten E2E-Screenshot belegt.

Nicht durchgeführt: Docker-Imagebau/Containerprüfung, realer SMTP-Betrieb, Langzeit-/Lasttests, vollständiger Screenreader-Audit, vollständige Prüfung aller Abhängigkeits-Sicherheitsmeldungen und Produktionskonfiguration. Keine Aussage zu aktuellen CVEs. 320/375/414/768-Pixel-Breiten wurden nicht separat getestet. Die unten als statisch bezeichneten Fehler wurden aus dem aktuellen Code abgeleitet und nicht als erfolgreiche Laufzeitreproduktion ausgegeben.

## Architektur und Workflow-Karte

| Bereich | Aktueller Datenfluss | Wesentliche Schwachstelle |
|---|---|---|
| Auth | React → zentraler API-Client → Auth-Controller → User/SQLite → JWT/localStorage | Passwortänderung ohne erreichbaren UI-Prozess; fachliche 401 wird als Sessionfehler interpretiert |
| Medikamente | Seite/Formular → API → Controller → Model → SQLite → berechnete Statistiken | Unterschiedliche Wahrheiten für Tagesdosierung und Intervallmenge |
| Bestand | Bestandsdialog/Scheduler → Schreibqueue/Transaktion → Bestand + History | Scheduler-Cursor fehlt im Export; Nachholungen ignorieren neue Bestandsmessung |
| Fotos | Multer → Signaturprüfung → Dateisystem + DB-Pfad → signierte URL | Dateisystem und Datensatz werden bei Parallelzugriff nicht gemeinsam koordiniert |
| Warnungen | Scheduler → Statistik → Statusmarker → SMTP | Marker wird vor Zustellung gespeichert; Schreibqueue wird umgangen |
| Wiederherstellung | JSON → Validierung → Replace-Transaktion → ID-Zuordnung | Archivdaten werden mit Regeln für neue Termine validiert |
| Kalender | berechnete Leerstandszeit → FullCalendar | CSP-Konflikt, unvollständige Lokalisierung, fehlende automatische Aktualisierung |

# Hohe Priorität

## 🚨 Hoch – H01: Export und Import zerstören den Scheduler-Duplikatschutz

- **Kategorie:** Datenintegrität / Prozess-Lücke
- **Betroffene Datei(en) / Komponente(n):** `backend/src/controllers/dataController.js:74`, `:114`; `backend/src/services/stockScheduler.js:78`; Tabelle `stock_deductions`.
- **Problembeschreibung:** Der Export enthält Medikamente und History, aber keine Abzugsmarker. Beim Replace-Import werden Medikamente gelöscht und damit die Marker kaskadiert entfernt. Historische Medikament-Erstellungsdaten bleiben erhalten. Der tägliche Scheduler betrachtet denselben heutigen Slot anschließend wieder als unverarbeitet.
- **Auswirkung:** Ein vollständiger Export-/Import-Rundlauf verändert beim nächsten Tick den Bestand, obwohl die Tagesdosis schon abgebucht war. Laufzeitreproduktion: initial 10, erster Morgenabzug 9, Export/Import, derselbe Tick ergibt 8.
- **Lösungsvorschlag:** Scheduler-Zustand ausdrücklich in den versionierten Exportvertrag aufnehmen und mit neuen Medikament-IDs wiederherstellen. Für ältere Exportversionen eine dokumentierte, konservative Cursor-Migration implementieren. Rundlauf vor/nach jedem Slot inklusive History und Duplikatschutz testen.

## 🚨 Hoch – H02: Ältere Intervall-Backups sind nicht zuverlässig wiederherstellbar

- **Kategorie:** Wiederherstellung / Validierung
- **Betroffene Datei(en) / Komponente(n):** `backend/src/controllers/dataController.js:57`; `backend/src/utils/validation.js:87`.
- **Problembeschreibung:** Der Import verwendet dieselbe Datumsvalidierung wie eine Neuanlage. Ein im Export gespeichertes `next_due_at` darf beim späteren Restore nicht vor dem heutigen Tag liegen. Gerade nach Ausfall oder längerer Lagerung eines Backups ist das normal.
- **Auswirkung:** Ein zuvor gültiger Export verliert allein durch Zeitablauf seine Importierbarkeit. Die gezielte Prüfung eines Intervalltermins vom 01.10.2026 wird am Auditdatum abgelehnt.
- **Lösungsvorschlag:** Strukturvalidierung von interaktiver Terminvalidierung trennen. Archivierte Termine zulassen und Nachhol-/Restore-Semantik zusammen mit den Abzugsmarkern definieren. Restore einer mehrere Wochen alten Sicherung deterministisch testen.

## 🚨 Hoch – H03: Leerer Intervallbestand bekommt positive Reichweite

- **Kategorie:** Berechnungsfehler / UI-Backend-Inkonsistenz
- **Betroffene Datei(en) / Komponente(n):** `backend/src/utils/calculations.js:30–43`; Dashboard, Kalender und Mailrenderer.
- **Problembeschreibung:** Bei Intervallmedikamenten wird die Wartezeit bis zur nächsten Einnahme auch bei Bestand 0 auf die Reichweite aufgeschlagen. Der Ausdruck `Math.max(0, intervalsRemaining - 1)` verhindert, dass fehlender Bestand diese Wartezeit reduziert.
- **Auswirkung:** Bestand 0, Dosis 1, nächster Termin in zehn Tagen und Warngrenze 7 ergibt zehn Resttage und nur `warning`; bei weiter entferntem Termin sogar `good`. Die Detailseite meldet gleichzeitig „Aufgebraucht“. Warnungen und Kalender vermitteln widersprüchliche Verfügbarkeit.
- **Lösungsvorschlag:** Nullbestand bei vorgesehenem Verbrauch vor der Intervallrechnung behandeln. Für unzureichende erste Dosis eine klare Produktdefinition festlegen. Ganze, unvollständige und null verfügbare Dosen testen.

## 🚨 Hoch – H04: Nachholung zieht historische Dosen vom frisch gemessenen Bestand ab

- **Kategorie:** Scheduler / zeitliche Datenintegrität
- **Betroffene Datei(en) / Komponente(n):** `backend/src/services/stockScheduler.js:78–120`; `backend/src/controllers/medicationController.js:185`.
- **Problembeschreibung:** Nachholungen starten nach dem letzten gespeicherten Abzug. `last_stock_measured_at`, das beim manuellen Setzen aktualisiert wird, fließt nicht ein. Statisch nachvollziehbarer Ablauf: letzter Tick Montag, Ausfall bis Donnerstag, Donnerstag wird der tatsächlich gezählte Bestand gesetzt, danach bucht der Scheduler Dienstag/Mittwoch/Donnerstag gegen diese neue Messung. Er verwendet dabei die aktuelle Dosierung auch für historische Tage.
- **Auswirkung:** Ein bewusst korrigierter Ist-Bestand wird sofort erneut nach unten korrigiert. Änderungen des Einnahmeplans können rückwirkend mit der falschen Menge nachgeholt werden.
- **Lösungsvorschlag:** Bestandsmessungen als zeitlichen Anker modellieren; offene Slots vor diesem Anker passend abschließen. Gültigkeitsbeginn von Dosierungsänderungen berücksichtigen. Tests für Ausfall → Messung → Nachholung und Ausfall → Planänderung ergänzen.

## 🚨 Hoch – H05: Tagesverbrauch und Bestandsprojektion können auseinanderlaufen

- **Kategorie:** Fachliche Invariante / API-Vertrag
- **Betroffene Datei(en) / Komponente(n):** `backend/src/controllers/medicationController.js:78–94`; `backend/src/controllers/dataController.js:20–33`; `backend/src/utils/calculations.js:15–31`.
- **Problembeschreibung:** Die tägliche Neuanlage und der Import akzeptieren eine explizite `dosage_per_interval`, die nicht der Summe der drei Tagesdosen entspricht. Die Statistik rechnet mit diesem Feld; der tägliche Scheduler zieht die Tagesfelder ab. Erst der Update-Controller normalisiert tägliche Datensätze.
- **Auswirkung:** Beispielsweise Tagesdosis 1 bei `dosage_per_interval = 0`: API zeigt unbegrenzte Reichweite und `good`, der Scheduler verbraucht trotzdem täglich Bestand. Die UI-Neuanlage normalisiert das Feld, API-Aufrufe und Importe jedoch nicht.
- **Lösungsvorschlag:** Bei `interval_days = 1` serverseitig in jedem Schreibpfad die Summe erzwingen oder widersprüchliche Payloads ablehnen. Dieselbe Normalisierung für Import, Erstellung und Änderung verwenden.

## 🚨 Hoch – H06: SMTP-Fehler verlieren Statuswarnungen dauerhaft

- **Kategorie:** Benachrichtigungen / Fehlerbehandlung
- **Betroffene Datei(en) / Komponente(n):** `backend/src/services/notificationScheduler.js:47–68`; `backend/src/services/notifications.js:44–64`.
- **Problembeschreibung:** `last_notified_status` wird vor `sendMail` aktualisiert. Der Mailservice liefert bei SMTP-Fehlern ein Fehlerobjekt zurück; der Marker bleibt trotzdem auf dem neuen Status. Beim nächsten Tick gibt es keinen Übergang mehr.
- **Auswirkung:** Eine vorübergehende Mailstörung unterdrückt eine Warnung bis zu einem weiteren relevanten Statuswechsel. Es gibt weder Wiederholung noch für den Benutzer sichtbaren Zustellfehler.
- **Lösungsvorschlag:** Zustellabsicht dauerhaft in einer Outbox speichern, Versand wiederholen und Zustellstatus separat führen. Minimal den Marker erst nach erfolgreichem Versand fortschreiben; dabei Parallelität und das verbleibende Duplikatfenster berücksichtigen. SMTP-Fehler mit anschließender Erholung testen.

## 🚨 Hoch – H07: Benachrichtigungswrites umgehen die Transaktionsqueue

- **Kategorie:** Architektur / Race Condition
- **Betroffene Datei(en) / Komponente(n):** `backend/src/services/notificationScheduler.js:58`; `backend/src/config/database.js:295` ff.; `backend/src/controllers/dataController.js:69–96`.
- **Problembeschreibung:** Die DB-Abstraktion verspricht serialisierte Schreibzugriffe, der Statusdetektor führt jedoch direkt `db.run` auf derselben globalen Verbindung aus. Parallel zu einer Import-/Bestandstransaktion kann dieser Write in deren Transaktion geraten und mit ihr zurückgerollt werden. Auch normale Reads und die mehreren Export-SELECTs laufen außerhalb einer Zugriffsschranke; dieselbe Verbindung kann uncommittete Zwischenstände sehen.
- **Auswirkung:** Marker können nach bereits versandter Mail verschwinden; UI oder Export können vorläufige oder untereinander inkonsistente Zustände erhalten. Statisch belegte Parallelitätslücke, im Audit nicht unter realer Last erzwungen.
- **Lösungsvorschlag:** Sämtliche Writes durch die Queue führen. Konsistente Mehrfachreads über eine koordinierte Snapshot-Operation oder separate Read-Verbindung mit geeigneter SQLite-Konfiguration ausführen. Barrieregesteuerte Interleaving-/Rollbacktests ergänzen.

## 🚨 Hoch – H08: Backup verwendet ohne Konfiguration eine andere Datenbank als der Server

- **Kategorie:** Betrieb / Backup
- **Betroffene Datei(en) / Komponente(n):** `backend/scripts/backup.js:7`; `backend/src/config/database.js:15`.
- **Problembeschreibung:** Der Server löst seinen Default relativ zu `backend/src/config` nach `backend/data/tabletto.db` auf. Das Backupskript löst `../../data/tabletto.db` relativ zu `backend/scripts` nach `data/tabletto.db` im Projektroot auf. Zusätzlich lädt das separate Skript die Projekt-`.env` nicht selbst.
- **Auswirkung:** Lokales `npm run backup --prefix backend` ohne exportierten `DB_PATH` schlägt fehl oder sichert eine andere, zufällig vorhandene DB. Eine nur in `.env` eingetragene Konfiguration wird vom Skript nicht wie beim Server übernommen. Compose setzt `DB_PATH` ausdrücklich und ist vom Defaultpfadfehler nicht betroffen.
- **Lösungsvorschlag:** Pfad-/Umgebungskonfiguration gemeinsam kapseln und von Server und Betriebsskripten identisch laden. Backup mit Defaultpfad, `.env` und expliziten Umgebungsvariablen gegen synthetische Daten testen.

# Mittlere Priorität

## 🚨 Mittel – M01: Fehlgeschlagenes Bearbeiten schließt den Dialog als Erfolg

- **Kategorie:** Workflow / Fehlerbehandlung
- **Betroffene Datei(en) / Komponente(n):** `frontend/src/pages/MedicationDetailPage.jsx:137–151`, `:211–217`; `frontend/src/components/Medications/MedicationForm.jsx:107–118`.
- **Problembeschreibung:** `handleUpdate` fängt den API-Fehler und löst sein Promise anschließend normal auf. Das Formular behandelt jedes erfüllte Promise als Erfolg und ruft `onSuccess` auf; dieses schließt den Bearbeitungsdialog. Fehlertext steht außerhalb des Dialogs.
- **Auswirkung:** Bei 400/500 oder Netzfehler verschwindet die Eingabemaske, obwohl nichts gespeichert wurde. Erneutes Öffnen lädt die alten Daten; der Benutzer muss Eingaben wiederholen.
- **Lösungsvorschlag:** Einen eindeutigen Ergebnisvertrag verwenden: Fehler weiterwerfen und im Formular behandeln oder explizit `{ success: false }` zurückgeben. Dialog und Eingaben bei Fehlern erhalten; Meldung im Dialog anzeigen.

## 🚨 Mittel – M02: Fehler bei der Neuanlage erzeugen unbehandelte Promise-Rejections

- **Kategorie:** Frontend / Asynchronität
- **Betroffene Datei(en) / Komponente(n):** `frontend/src/components/Medications/MedicationForm.jsx:107–128`; `frontend/src/pages/DashboardPage.jsx:152–156`.
- **Problembeschreibung:** Das Dashboard wirft Fehler korrekt weiter; das Formular hängt jedoch nur `.then(...)` ohne `.catch(...)` an. Das dadurch abgelehnte Promise wird weder zurückgegeben noch behandelt. Der lokale Formularfehlerzustand enthält keine API-Fehler.
- **Auswirkung:** Browser meldet `unhandledrejection`; Fehlerfeedback ist teilweise außerhalb der geöffneten Maske und die Komponente besitzt keinen vollständigen Fehlerabschluss.
- **Lösungsvorschlag:** Submitfunktion `async` ausführen, `await onSubmit(...)` mit lokalem `try/catch` verwenden und Erfolg ausschließlich im Erfolgszweig auslösen. Netzabbruch und Backendvalidierungsfehler im geöffneten Dialog testen.

## 🚨 Mittel – M03: Typfehler bei HTTP-Eingaben führen zu 500 statt 400/401

- **Kategorie:** API / Validierung
- **Betroffene Datei(en) / Komponente(n):** `backend/src/utils/validation.js:13–19`; `backend/src/controllers/authController.js:47–58`; `backend/src/controllers/medicationController.js:76`, `:167`; `backend/src/controllers/userController.js:21`.
- **Problembeschreibung:** Medikamentnamen werden ohne Typprüfung mit `.trim()` verarbeitet. Ein numerischer oder objektförmiger Name wirft eine Exception. Mehrere Controller setzen ein vorhandenes `req.body` voraus; Login reicht ein fehlendes/objektförmiges Passwort direkt an bcrypt weiter.
- **Auswirkung:** Fehlgeformte Requests erscheinen als interne Serverfehler und erzeugen unnötige Stacklogs. Clients können Benutzerfehler nicht zuverlässig von Betriebsfehlern unterscheiden. Express fängt die Fehler ab; ein Prozessabsturz wurde nicht beobachtet.
- **Lösungsvorschlag:** Body-Objekt und Feldtypen vor Konvertierung prüfen; ungültige Auth-Eingaben konsistent ablehnen. Tests für fehlenden Body, `name: 42`, Objekte, Arrays und fehlendes Passwort ergänzen.

## 🚨 Mittel – M04: Import akzeptiert beschädigte Metadaten und mehrdeutige Quell-IDs

- **Kategorie:** Import / Datenqualität
- **Betroffene Datei(en) / Komponente(n):** `backend/src/controllers/dataController.js:34–36`, `:61–65`, `:145–160`; `backend/src/services/stockScheduler.js:85`.
- **Problembeschreibung:** `created_at`, `updated_at`, Messzeit und History-Zeitstempel werden ungeprüft übernommen. Quell-IDs müssen weder eindeutig noch typkonsistent sein; doppelte IDs überschreiben Einträge in `idMap`. History-Bestände werden nur auf Endlichkeit geprüft, negative Werte bleiben möglich.
- **Auswirkung:** Ungültiges `created_at` kann die Scheduler-Datumsverarbeitung abbrechen; doppelte IDs ordnen History still dem letzten Medikament zu. Die Daten sind innerhalb desselben Benutzers falsch zugeordnet, kein nachgewiesener Mandantendurchbruch.
- **Lösungsvorschlag:** Metadaten vor der Transaktion mit explizitem Format validieren; IDs normalisieren und Duplikate ablehnen. History-Mengen und referenzielle Zuordnung vollständig prüfen. Beschädigte Archive müssen ohne Datenersetzung mit 400 enden.

## 🚨 Mittel – M05: Parallele Fotooperationen können Dateien verwaisen lassen

- **Kategorie:** Upload / Race Condition
- **Betroffene Datei(en) / Komponente(n):** `backend/src/controllers/medicationController.js:226–263`, `:289` ff.; `backend/src/models/Medication.js:103` ff.
- **Problembeschreibung:** Der alte Fotopfad wird vor dem Upload ausgelesen. Zwei Uploads können denselben alten Pfad lesen, nacheinander unterschiedliche neue Pfade speichern und beide nur den alten Pfad löschen. Das zuerst hochgeladene Foto bleibt ohne DB-Referenz zurück. Gleichzeitig mit Löschen/Import kann ein Update keinen Datensatz mehr finden, nachdem eine Datei schon geschrieben wurde.
- **Auswirkung:** Speicher wächst durch verwaiste Fotos; gültige konkurrierende Aktionen können mit 500 enden. Die Schreibqueue allein schützt den gesamten Datei-/Datensatzablauf nicht.
- **Lösungsvorschlag:** Austausch des Pfads samt Ermittlung des tatsächlich ersetzten Pfads atomar koordinieren; bei nicht mehr vorhandenem Datensatz die neue Datei entfernen. Zwei Uploads sowie Upload gegen Delete/Import gezielt verschachteln und Dateibestand prüfen.

## 🚨 Mittel – M06: SQLite-Zeitstempel werden im Browser als lokale Zeit gelesen

- **Kategorie:** Datumslogik / UI
- **Betroffene Datei(en) / Komponente(n):** `frontend/src/utils/dateFormatter.js:3`; `frontend/src/components/Medications/MedicationDetail.jsx:14–21`; SQLite-Defaults in `backend/src/config/database.js`.
- **Problembeschreibung:** SQLite liefert `CURRENT_TIMESTAMP` ohne Zeitzonenangabe als `YYYY-MM-DD HH:mm:ss`. Der Browser erhält diesen String unverändert über `new Date(...)`. Eine Normalisierung zu UTC wie im Scheduler fehlt im Frontend.
- **Auswirkung:** Ereignisse und Messungen nahe Mitternacht erscheinen in Europe/Berlin am falschen Kalendertag; Formatunterstützung ist zusätzlich vom Browser abhängig. Geräte in anderen Zeitzonen erhalten weitere Abweichungen.
- **Lösungsvorschlag:** API-Zeitstempel einheitlich als ISO mit explizitem Offset/`Z` ausliefern und nach konfigurierter Anzeigezeitzone formatieren. Sommer-/Winterzeit und UTC-Tageswechsel testen.

## 🚨 Mittel – M07: Bruchbestände lassen sich über die UI nicht korrekt setzen

- **Kategorie:** UI/API-Inkonsistenz
- **Betroffene Datei(en) / Komponente(n):** `frontend/src/pages/MedicationDetailPage.jsx:232–236`; `frontend/src/components/Medications/MedicationForm.jsx:300–309`; `backend/src/controllers/medicationController.js:170–194`.
- **Problembeschreibung:** Bestände sind `REAL`, Dosierungen erlauben halbe Tabletten und das Backend akzeptiert endliche Bruchwerte. Der Bestandsdialog erzwingt jedoch `step="1"`, die Bestandsneuanlage verwendet den Standard-Schritt 1.
- **Auswirkung:** Ein tatsächlicher Bestand von 7,5 kann nicht über den regulären Workflow erfasst werden. Ein vorhandener Bruchbestand kann beim Öffnen des Setzen-Dialogs bereits browserseitig ungültig sein.
- **Lösungsvorschlag:** Fachlich erlaubte Schrittweite für Dosierungen und Bestand vereinheitlichen, beispielsweise 0,5 oder `any`. Erfassung, Korrektur und anschließenden Abzug mit halben Tabletten prüfen.

## 🚨 Mittel – M08: Passwortänderung ist im Produkt nicht erreichbar

- **Kategorie:** Fehlende Funktion / Auth-Workflow
- **Betroffene Datei(en) / Komponente(n):** `frontend/src/pages/SettingsPage.jsx`; `frontend/src/services/api.js:154` ff.; `backend/src/routes/user.js:12`.
- **Problembeschreibung:** Backend und API-Client implementieren Passwortänderung, aber weder Einstellungen noch andere Seiten bieten dafür ein Formular. Zudem behandelt der API-Client jede authentifizierte 401 als Sitzungsverlust, während ein falsches aktuelles Passwort vom Passwortendpunkt ebenfalls 401 erhält.
- **Auswirkung:** Benutzer können ihr Passwort regulär nicht ändern. Ein später ergänztes Formular würde bei einem Tippfehler im aktuellen Passwort ungewollt ausloggen.
- **Lösungsvorschlag:** Erreichbaren Passwortdialog mit aktuellem Passwort, Bestätigung und Erfolgs-/Fehlerzustand ergänzen. Authfehler von fachlichen Authentifizierungsprüfungen über Fehlercode oder endpunktspezifische Behandlung unterscheiden.

## 🚨 Mittel – M09: Foto-Upload auf der Detailseite ist per Tastatur unerreichbar

- **Kategorie:** Barrierefreiheit / Workflow
- **Betroffene Datei(en) / Komponente(n):** `frontend/src/components/Medications/MedicationDetail.jsx:96–106`; `frontend/src/components/Medications/MedicationForm.jsx:252–284`.
- **Problembeschreibung:** Die Fotoauswahl auf der Detailseite ist ein nicht fokussierbares Label mit `display:none`-Dateiinput. Kein fokussierbarer Button löst den Dateidialog aus. Im Medikamentformular besitzen außerdem das Intervall-Select und Datumsfeld sichtbare Labels ohne `htmlFor`/zugehörige IDs.
- **Auswirkung:** Mausnutzer können ein Foto wählen, Tastaturnutzer nicht. Screenreader bekommen für Teile der Intervallbearbeitung keinen zuverlässig zugeordneten Namen.
- **Lösungsvorschlag:** Zugänglichen nativen Dateiinput mit sichtbarem Fokus oder echten Button mit Input-Referenz verwenden. Labels per `htmlFor`/`id` verbinden. Den vollständigen Ablauf ausschließlich mit Tastatur prüfen.

## 🚨 Mittel – M10: Content Security Policy macht Kalender-Navigation unsichtbar

- **Kategorie:** UI / Sicherheitskonfiguration
- **Betroffene Datei(en) / Komponente(n):** `backend/src/server.js:27`; `frontend/src/pages/CalendarPage.jsx:175–183`; FullCalendar-Iconfont.
- **Problembeschreibung:** FullCalendar verwendet eine eingebettete `data:application/x-font-ttf`-Schrift für Pfeile. Die CSP enthält kein passendes `font-src`; `default-src 'self'` blockiert diese Schrift. Browserkonsole und Desktop-/Mobile-Screenshot bestätigen den Konflikt.
- **Auswirkung:** Vor-/Zurück-Buttons erscheinen als leere dunkle Flächen. Die Bedienbarkeit und erkennbare Navigation leiden trotz erfolgreicher Touch-Zieltests.
- **Lösungsvorschlag:** Bevorzugt lokale Symbole/Assets oder sichtbare deutsche Buttontexte verwenden. Alternativ `font-src` gezielt und eng für die tatsächlich benötigte Schriftquelle definieren. CSP-Verletzungen und sichtbare Icons im E2E prüfen.

## 🚨 Mittel – M11: Fehlgeschlagenes Laden von Einstellungen kann gespeicherte Werte überschreiben

- **Kategorie:** Zustandsverwaltung / Fehlerbehandlung
- **Betroffene Datei(en) / Komponente(n):** `frontend/src/pages/DashboardPage.jsx:109–137`; `frontend/src/pages/CalendarPage.jsx:38–66`; `frontend/src/pages/SettingsPage.jsx:29–52`.
- **Problembeschreibung:** Dashboard und Kalender verschlucken Ladefehler, setzen `preferencesLoaded` trotzdem und schreiben danach den lokalen Default zurück. Die Einstellungsseite bleibt nach Ladefehler mit Defaultwerten und aktivem Speichern bedienbar.
- **Auswirkung:** Ein vorübergehender GET-Fehler kann gespeicherte Ansichten überschreiben; beim Speichern in Einstellungen können sogar Einnahmezeiten und Benachrichtigungsoptionen durch Defaults ersetzt werden.
- **Lösungsvorschlag:** Erfolgreich geladene Einstellungen, lokale Änderungen und Fehler separat modellieren. Erst nach bewusstem Benutzerwechsel persistieren; nach Ladefehler Retry anbieten und Speichern bis zur Auflösung sperren.

## 🚨 Mittel – M12: API-Vertragstest ist durch festes Datum dauerhaft rot

- **Kategorie:** QA / CI
- **Betroffene Datei(en) / Komponente(n):** `tests/e2e/api-contracts.spec.js:35–38`; `.github/workflows/ci.yml`.
- **Problembeschreibung:** Das Testmedikament enthält `next_due_at: '2026-07-20T12:00:00'`. Am 25.10.2026 weist die API dieses Datum korrekt zurück. Tatsächlicher Lauf: erwartet 201, erhalten 400. Der Test bricht vor Mandantentrennung, parallelen Bestandsänderungen und Import-/Exportprüfungen ab.
- **Auswirkung:** CI und nachgelagerter Releasepfad werden blockiert; gleichzeitig bleiben wichtige Vertragsprüfungen in diesem Test unerreicht. Die zwei Mobile-API-Fälle sind absichtlich übersprungen, nicht zusätzlich fehlgeschlagen.
- **Lösungsvorschlag:** Datum relativ zu kontrollierter Testzeit erzeugen oder Zeit injizieren. Vertragsfälle auf kleinere Tests aufteilen, sodass ein Setupfehler nicht alle Sicherheits-/Datenprüfungen verdeckt.

## 🚨 Mittel – M13: DB-Snapshot und Foto-Backup bilden keinen gemeinsamen Zeitpunkt ab

- **Kategorie:** Backup / Konsistenz
- **Betroffene Datei(en) / Komponente(n):** `backend/scripts/backup.js:20–41`; `docs/operations.md:106–118`.
- **Problembeschreibung:** `VACUUM INTO` liefert korrekt einen konsistenten SQLite-Snapshot. Danach werden bei weiterlaufender Anwendung die Uploads kopiert. Wird zwischen Snapshot und Kopieren ein Foto ersetzt oder gelöscht, verweist die gesicherte DB auf eine Datei, die nicht mehr kopiert werden kann. Der Erfolgstext „Konsistentes Backup“ unterscheidet diese Garantien nicht.
- **Auswirkung:** Ein erfolgreiches Backup kann beim Restore Fotos vermissen lassen. Das dokumentierte Offline-Archiv ist eine brauchbare Alternative, die Online-Sicherung garantiert aber keine gemeinsame DB-/Dateikonsistenz.
- **Lösungsvorschlag:** Fotoänderungen während Snapshot und Dateikopie koordinieren oder immutable Fotoobjekte bis nach abgeschlossener Sicherung zurückhalten. Fehlende referenzierte Dateien prüfen und Konsistenzgrenze ausdrücklich dokumentieren.

## 🚨 Mittel – M14: Offene Seiten zeigen nach Scheduler-Abzügen veraltete Bestände

- **Kategorie:** Workflow / Datenfrische
- **Betroffene Datei(en) / Komponente(n):** `frontend/src/pages/DashboardPage.jsx:92–108`; `frontend/src/pages/CalendarPage.jsx:27–29`; `frontend/src/pages/MedicationDetailPage.jsx:39–56`.
- **Problembeschreibung:** Medikamente werden beim Mounten und nach eigenen Aktionen geladen. Es gibt weder zeitgesteuertes Refetch noch Aktualisierung bei Rückkehr zum Tab. Scheduler-Abzüge und Änderungen in anderen Tabs bleiben unsichtbar; auf der Detailseite ist nur ein manuelles Aktualisieren vorhanden.
- **Auswirkung:** Eine über Nacht geöffnete App zeigt alte Bestände, Reichweiten und Warnfarben. Der Kalender verschiebt seine Prognose nicht automatisch.
- **Lösungsvorschlag:** Daten nach Sichtbarwerden/Fokus und mit angemessenem Intervall neu laden. Zeit der letzten Aktualisierung sowie Offline-/Fehlerzustand sichtbar machen; Eingaben bei Hintergrundaktualisierung erhalten.

# Niedrige Priorität

## 🚨 Niedrig – L01: Kalender ist nur teilweise deutsch lokalisiert

- **Kategorie:** UI-Inkonsistenz / Lokalisierung
- **Betroffene Datei(en) / Komponente(n):** `frontend/src/pages/CalendarPage.jsx:3–7`, `:183–189`.
- **Problembeschreibung:** `locale="de"` wird gesetzt, aber das deutsche FullCalendar-Locale-Modul nicht importiert/registriert. `buttonText` übersetzt nur einen Teil der Oberfläche. Der gesichtete Mobile-Screenshot zeigt „No events to display“.
- **Auswirkung:** Deutschsprachige Anwendung enthält englische Systemtexte; Leerzustände wirken unvollständig.
- **Lösungsvorschlag:** Offizielles deutsches Locale lokal importieren und registrieren; Leerzustand und Navigationsbeschriftungen im deutschen UI-Test prüfen.

## 🚨 Niedrig – L02: Historie endet unsichtbar bei 50 Einträgen

- **Kategorie:** Prozess-Lücke / Nachvollziehbarkeit
- **Betroffene Datei(en) / Komponente(n):** `frontend/src/pages/MedicationDetailPage.jsx:44`, `:187–205`; `backend/src/controllers/medicationController.js:215` ff.
- **Problembeschreibung:** Die Seite lädt nur das Standardlimit von 50 Einträgen. Es gibt weder Hinweis auf Begrenzung noch Nachladen. Bei drei täglichen Abzügen sind schon nach ungefähr 17 Tagen ältere Ereignisse unsichtbar, während die Überschrift den gesamten Verlauf suggeriert.
- **Auswirkung:** Benutzer können frühere Korrekturen nicht im normalen Verlauf nachvollziehen. Der Export enthält mehr Daten als die UI erreichbar macht.
- **Lösungsvorschlag:** Begrenzung benennen und stabile Cursor-Paginierung mit „Ältere Einträge laden“ ergänzen; API-Vertrag und Tests gemeinsam erweitern.

## 🚨 Niedrig – L03: Feste Tagesintervalle werden als Kalendermonate beschriftet

- **Kategorie:** Terminologie / fachliche UX
- **Betroffene Datei(en) / Komponente(n):** `frontend/src/components/Medications/MedicationForm.jsx:245–246`; `frontend/src/components/Medications/MedicationDetail.jsx:28–31`.
- **Problembeschreibung:** 30 Tage heißen im Formular „Monatlich (30 Tage)“, in der Detailseite nur „Monatlich“; 90 Tage werden als „Alle 3 Monate“ bezeichnet. Der Scheduler addiert feste Tageszahlen. Das ist nicht gleichbedeutend mit einem gleichen Datum im nächsten Kalendermonat.
- **Auswirkung:** Benutzer können einen anderen Terminverlauf erwarten als tatsächlich abgebucht wird. Die Detailansicht verschweigt die präzisierende Tageszahl.
- **Lösungsvorschlag:** Einheitlich „Alle 30 Tage“ beziehungsweise „Alle 90 Tage“ schreiben. Eine echte Kalendermonats-Semantik wäre eine gesonderte Fachänderung und darf nicht nur per Textwechsel eingeführt werden.

# Verbesserungsvorschlag

## 🚨 Vorschlag – S01: Regressionen an Prozessgrenzen gezielt absichern

- **Kategorie:** Testarchitektur / Wartbarkeit
- **Betroffene Datei(en) / Komponente(n):** `backend/test/core.test.js`; `backend/test/migration.test.js`; `tests/e2e/`; `frontend/src/services/api.js`.
- **Problembeschreibung:** Die vorhandenen Tests prüfen erfolgreiche Einzelabläufe ordentlich, decken aber zentrale Kombinationen nicht ab: Restore nach bereits erfolgtem Abzug, alte Archive, SMTP-Ausfall, Korrektur nach Downtime, fehlerhafte Dialogspeicherung und Tastatur-Fotoauswahl. Sechs Backendtests sind für diese Zustandsmaschine ein schmaler Schutz. Der Client enthält zusätzlich doppelte Methodenpaare für dieselben Präferenzendpunkte.
- **Auswirkung:** Grüne Happy-Path-Tests erzeugen zu viel Vertrauen in systemübergreifende Garantien. Zeit, DB-Zustand und Netzwerkfehler sind schwer gezielt steuerbar.
- **Lösungsvorschlag:** Uhr und Mailtransport injizierbar machen; fachliche Normalisierung und Datumsdarstellung bündeln. Deterministische Invariantenprüfungen ergänzen: Rundlauf erhält Bestand und Abzugszustand, Rollback hinterlässt keinen Teilzustand, Fehler erhält Benutzereingaben. API-Wrapper bei einer passenden Änderung zusammenführen, ohne ein großes Begleitrefactoring zu starten.

## Empfohlene Reihenfolge und Abnahmekriterien

1. **Bestandswahrheit sichern:** H01–H05 gemeinsam fachlich entscheiden. Abnahme: Export/Import, Downtime, Ist-Messung und Planänderung erzeugen weder Doppelabzüge noch irreführende Reichweiten.
2. **Zustellung und Transaktionsgrenzen sichern:** H06/H07. Abnahme: SMTP-Fehler ist wiederholbar; konkurrierende Requests können keine fremde Transaktion betreten und keine Zwischenstände exportieren.
3. **Restore und Betrieb absichern:** H08, M04, M13. Abnahme: frische und alte Sicherung erfolgreich wiederherstellbar; referenzierte Fotos vorhanden; Fehlimport rollt vollständig zurück.
4. **Fehlerpfade und Bedienung schließen:** M01–M03, M05–M11, M14. Abnahme: Dialog bleibt bei Fehler offen, Bruchbestände erfassbar, Upload per Tastatur möglich, Kalendernavigation sichtbar, Einstellungen werden bei Ladefehler nicht überschrieben.
5. **CI reparieren und Prüfungen verbreitern:** M12 und S01; anschließend Details L01–L03. Keine rote Prüfung stillschweigend deaktivieren.

### Visuelle Einordnung

Die geprüften Seiten sind funktionale Verwaltungsoberflächen, kein Marketing-Template; eine strukturelle Hallmark-Kritik an gleich großen Dashboard-Karten wäre hier kein belastbarer Bug. Sichtbare Priorität haben Bedienbarkeit, Beschriftung und Statuswahrheit: leere Kalenderbuttons, englischer Leerzustand und widersprüchliche Bestandsanzeigen. Die bestehenden Rundungen, Schatten und Farbakzente rechtfertigen für sich keine Neugestaltung. Hallmark-Zählung der konkret visuellen M10/L01: **0 critical · 1 major · 1 minor**; diese Design-Skala ist unabhängig von den fachlichen Schweregraden oben.

### Hinweise zur Beweislage

Screenshots und Traces des ausgeführten Laufs liegen lokal unter `test-results/artifacts/`, der HTML-Bericht unter `playwright-report/`; diese generierten Artefakte sind kein Teil der abzugebenden Änderung. Die Befunde nennen die am geprüften Commit gültigen Fundstellen; nach Korrekturen können sich Zeilen verschieben. Aus fehlender UI oder fehlendem Test wird kein medizinischer Funktionsbedarf abgeleitet: Tabletto bleibt Bestandsverwaltung ohne Therapie- oder Dosierungsempfehlungen.


## Behebungsstand nach dem Audit

Die obigen Befunde dokumentieren unverändert den damaligen Stand. Die anschließende
Behebung umfasst alle 26 Punkte; M12 war bereits Bestandteil von Version 1.8.1.

| Befund | Umsetzung / Nachweis |
|---|---|
| H01 | Export 2.1.0 einschließlich Abzugsmarker; Rundlauf beim selben Tick getestet |
| H02 | Archivvalidierung erlaubt vergangene Termine; Legacy-Restore dokumentiert |
| H03 | Fehlende vollständige Intervallmenge ergibt null Reichweite; deterministischer Test |
| H04 | Messanker, Abrechnung des alten Plans vor Plan-/Zeitänderung; Nachholtests |
| H05 | Tagesdosissumme in Anlage, Import, Änderung, Migration und Berechnung |
| H06 | Marker erst nach Versand; Fehler bleibt wiederholbar, parallele Erkennung gebündelt |
| H07 | Koordinierte Reads/Writes und zusammenhängender Export; Rollback-Barriere getestet |
| H08 | Gemeinsame Pfad-/Umgebungskonfiguration für Server und Backup |
| M01/M02 | Formular fängt Submitfehler; Dialog/Eingaben bleiben offen; Desktop-/Mobile-Regression |
| M03 | Typ-/Bodyvalidierung; ungültige API-Payloads getestet |
| M04 | Zeitstempel, Quell-IDs, History und Marker vor Replace validiert |
| M05 | Atomarer Fotoaustausch, Bereinigung unter DB-Sperre; Paralleltests |
| M06 | Gemeinsame UTC-Darstellung auch für Messzeit; Sommer-/Winterzeitprüfung |
| M07 | Bruchbestände in Anlage und Korrektur; Browserprüfung |
| M08 | Passwortformular und fachliche 401 ohne Logout; Browserprüfung |
| M09 | Tastaturbutton für Fotoauswahl; zugeordnete Formularlabels |
| M10 | Sichtbare Navigation und explizites font-src für eingebettete Schrift; CSP-Browserprüfung |
| M11 | Keine Defaultwrites nach Ladefehler, gesperrte Einstellungen mit Retry |
| M12 | Relativer Testtermin bereits in 1.8.1 korrigiert |
| M13 | Backup hält Schreibsperre bis nach Fotokopie; fehlende Fotos führen zu Fehler |
| M14 | Aktualisierung bei Fokus, Sichtbarkeit, Netzrückkehr und im Minutenintervall; Datenalter sichtbar |
| L01 | Deutsches FullCalendar-Locale registriert |
| L02 | Stabile Cursor-Paginierung und Nachladen älterer Bewegungen |
| L03 | Präzise Beschriftung „Alle 30 Tage“ / „Alle 90 Tage“ |
| S01 | Backend- und Browserregressionen an Prozessgrenzen, steuerbare Zeit/Versandfunktion, API-Duplikate entfernt |

Betriebsgrenzen: SMTP kann nach erfolgreicher Annahme und einem Prozessabbruch vor
dem Marker-Commit eine doppelte Warnung erzeugen; eine Exactly-once-Garantie über
SMTP besteht nicht. Legacy-Exporte enthalten keinen vollständigen Abzugszustand;
ihr Exportzeitpunkt (ersatzweise Restorezeit) wird konservativ als Bestandsanker
verwendet. Deshalb lassen sich vor diesem Zeitpunkt fehlende Abbuchungen nicht
rekonstruieren. Details und Recovery stehen in `docs/operations.md`.


Zusatzprüfung bei der Behebung: Der Containerbau meldete zuvor nicht untersuchte
Abhängigkeitsschwachstellen. Die Lockfiles und betroffenen direkten Pakete wurden
aktualisiert; `npm audit` meldet für Backend und Frontend am 25.10.2026 jeweils
0 bekannte Schwachstellen. Das CSS-Parser-Override und Nodemailer-Update sind in
`docs/security.md` dokumentiert und in die abschließenden Prüfungen eingeschlossen.


### Abschließende Verifikation der Behebung

| Prüfung | Ergebnis |
|---|---|
| Backend inkl. Migration, Importrollback, SMTP-/Zeit-/Backupregressionen | 22 bestanden |
| Vollständige Playwright-Suite mit aktualisierten Abhängigkeiten | 54 bestanden, 2 planmäßig übersprungen |
| Zusätzliche Breiten in beiden Browserprojekten | 320, 375, 414 und 768 CSS-Pixel erfolgreich |
| Frontend-Produktionsbuild | erfolgreich; CSS-Artefakt nach Parser-Update unverändert |
| Imagebau aus finalen Paket-/Quellständen | `tabletto:audit-fixes` erfolgreich |
| Isolierter Produktionscontainer | Health, PWA/CSP, Registrierung/Login, Tagesdosissumme, Bruchbestand und Export/Import erfolgreich |
| Backup im Produktionscontainer | erfolgreich; Testcontainer mit flüchtiger DB anschließend entfernt |
| Backend-Syntax, Dokumentationslinks, `git diff --check` | erfolgreich |
| `npm audit` Backend / Frontend | jeweils 0 bekannte Schwachstellen zum Prüfzeitpunkt |

Die Umsetzung ist als Release 1.8.2 vorgesehen. Die historische
Auditbeschreibung wurde nicht als damaliger Prüfnachweis umgeschrieben;
Behebungen und heutige Ergebnisse stehen ausschließlich in diesem Nachtrag.
