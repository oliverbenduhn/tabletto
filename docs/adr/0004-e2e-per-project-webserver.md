# E2E: Per-Projekt-Webserver mit eigener SQLite-Datenbank

Playwright-Projekte in `playwright.config.js` definieren jeweils ihren
eigenen `webServer`-Block mit einer eigenen `DB_PATH`
(`/tmp/tabletto-e2e-{desktop,mobile}.db`). Der vorherige globale
`webServer` entfällt. Damit hat jedes Projekt einen eigenen
Backend-Prozess mit frischer SQLite-Datenbank, und persistenter
Server-State (Notification-Dedup-Tabellen, History-Einträge,
Settings-Defaults) wird nicht mehr zwischen Projekten geteilt. Die
Ursache der ursprünglich 11 fehlgeschlagenen Notification-Tests auf
`mobile-pixel-7` — Desktop-Durchlauf verbrauchte die
Status-Übergänge, Mobile-Durchlauf fand keine mehr — verschwindet
auf der Wurzel. Alle Specs laufen auf beiden Projekten; ein
`testIgnore` für Notifications auf Mobile (die ursprüngliche
Erwägung) wurde verworfen, weil es die Ursache maskiert und die
mobile Coverage-Lücke verfestigt hätte.
