# E2E: Per-Projekt-Webserver mit eigener SQLite-Datenbank

Das globale `webServer`-Array in `playwright.config.js` startet für die beiden
Playwright-Projekte je einen Server mit eigener `DB_PATH`
(`/tmp/tabletto-e2e-{desktop,mobile}.db`). Damit hat jedes Projekt einen eigenen
Backend-Prozess mit frischer SQLite-Datenbank. Die projektspezifische `baseURL`
wählt den passenden Server, und persistenter
Server-State (Notification-Dedup-Tabellen, History-Einträge,
Settings-Defaults) wird nicht mehr zwischen Projekten geteilt. Die
Ursache der ursprünglich 11 fehlgeschlagenen Notification-Tests auf
`mobile-pixel-7` — Desktop-Durchlauf verbrauchte die
Status-Übergänge, Mobile-Durchlauf fand keine mehr — verschwindet
auf der Wurzel. Alle Specs laufen auf beiden Projekten; ein
`testIgnore` für Notifications auf Mobile (die ursprüngliche
Erwägung) wurde verworfen, weil es die Ursache maskiert und die
mobile Coverage-Lücke verfestigt hätte.
