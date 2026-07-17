# HTTP-API

## Grundlagen

- Standard-Basis-URL: `/api`
- JSON-Endpunkte: `Content-Type: application/json`
- Foto-Uploads: `multipart/form-data`
- Fehlerformat: `{ "error": "deutsche Fehlermeldung" }`
- geschützte Endpunkte: `Authorization: Bearer <JWT>`
- JWT-Inhalt: `{ "id": <number>, "email": <string> }`
- JWT-Laufzeit: sieben Tage

Die meisten erfolgreichen Responses verwenden eine benannte Hülle wie
`medication`, `medications`, `history`, `preferences` oder `data`.

## Authentifizierung

### `POST /api/auth/register`

Öffentlich, auf zehn fehlgeschlagene Anfragen pro Minute und Client begrenzt;
erfolgreiche Registrierungen zählen nicht gegen das Limit.

Request:

```json
{
  "email": "user@example.com",
  "password": "mindestens-8-zeichen"
}
```

Validierung: einfaches E-Mail-Format, Passwortlänge 8 bis 128 Zeichen,
E-Mail eindeutig.

Response `201`:

```json
{
  "message": "Registrierung erfolgreich",
  "user": { "id": 1, "email": "user@example.com" }
}
```

Fehler: `400` ungültige Eingabe, `409` E-Mail vorhanden, `429` Rate Limit.

### `POST /api/auth/login`

Öffentlich, auf fünf fehlgeschlagene Anfragen pro Minute begrenzt; erfolgreiche
Anmeldungen zählen nicht gegen das Limit.

Request:

```json
{
  "email": "user@example.com",
  "password": "mindestens-8-zeichen"
}
```

Response `200`:

```json
{
  "token": "<jwt>",
  "user": { "id": 1, "email": "user@example.com" }
}
```

Seiteneffekt: `users.last_login` wird aktualisiert. Fehler: `401` bei unbekannter
E-Mail oder falschem Passwort, `429` bei zu vielen Anfragen.

## Medikamente

Alle Endpunkte dieses Abschnitts sind geschützt und auf den Benutzer im JWT
begrenzt.

### Antwortobjekt

Ein angereichertes Medikament kann folgende Felder enthalten:

```json
{
  "id": 12,
  "user_id": 1,
  "name": "Beispiel",
  "dosage_morning": 1,
  "dosage_noon": 0,
  "dosage_evening": 1,
  "tablets_per_package": 30,
  "current_stock": 20,
  "warning_threshold_days": 7,
  "photo_path": "medications/123-abc.jpg",
  "interval_days": 1,
  "dosage_per_interval": 2,
  "next_due_at": "2026-07-16T00:00:00.000Z",
  "created_at": "2026-07-15 10:00:00",
  "updated_at": "2026-07-15 10:00:00",
  "last_stock_measured_at": "2026-07-15 10:00:00",
  "daily_consumption": 2,
  "days_remaining": 10,
  "depletion_date": "2026-07-25T10:00:00.000Z",
  "warning_status": "warning",
  "days_until_next_dose": 1,
  "intervals_remaining": 10,
  "photo_url": "/uploads/medications/123-abc.jpg"
}
```

Bei einer Dosis von null kann `days_remaining` in der JSON-Antwort `null` sein,
weil die interne Unendlichkeitsdarstellung nicht als JSON-Zahl existiert.

### `GET /api/medications`

Response `200`:

```json
{ "medications": [] }
```

Sortierung: Anlagezeit absteigend.

### `POST /api/medications`

Akzeptiert JSON oder `multipart/form-data` mit optionalem Feld `photo`.

```json
{
  "name": "Beispiel",
  "dosage_morning": 1,
  "dosage_noon": 0,
  "dosage_evening": 1,
  "tablets_per_package": 30,
  "current_stock": 30,
  "warning_threshold_days": 7,
  "interval_days": 1,
  "dosage_per_interval": 2,
  "next_due_at": null
}
```

Response `201`: `{ "medication": <angereichertes Medikament> }`.

Validierung:

- Name erforderlich, maximal 100 Zeichen
- jede Tagesdosis 0 bis 10
- Packungsgröße 0 bis 1000
- Bestand 0 bis 10000
- Warngrenze 1 bis 30 Tage
- `interval_days` ganzzahlig zwischen 1 und 365
- `dosage_per_interval` endlich und zwischen 0 und 30
- bei `interval_days > 1` ist ein gültiges `next_due_at` erforderlich
- Foto maximal 5 MiB, JPEG/PNG/GIF/WebP und passende Dateisignatur

### `GET /api/medications/:id`

Response `200`: `{ "medication": <angereichertes Medikament> }`.

Fehler: `404`, wenn das Medikament nicht existiert oder einem anderen Benutzer
gehört.

### `PUT /api/medications/:id`

Partielles JSON-Update. Editierbar sind:

- `name`
- `dosage_morning`, `dosage_noon`, `dosage_evening`
- `tablets_per_package`
- `warning_threshold_days`
- `interval_days`
- `dosage_per_interval`
- `next_due_at`

Response `200`: `{ "medication": <angereichertes Medikament> }`.

Der zusammengeführte Datensatz durchläuft dieselbe Fachvalidierung wie beim
Erstellen. Bestand ist nicht über diesen Endpunkt editierbar und wird nur über
den transaktionalen Stock-Endpunkt mit History geändert.

### `DELETE /api/medications/:id`

Response `200`:

```json
{ "message": "Medikament gelöscht" }
```

Seiteneffekte: zugehörige History wird kaskadierend gelöscht; ein Foto wird
bestmöglich aus dem Dateisystem entfernt.

## Bestand und History

### `POST /api/medications/:id/stock`

Packung addieren:

```json
{ "action": "add_package", "amount": 20 }
```

Wenn `amount` keine endliche Zahl ist, wird `tablets_per_package` verwendet.

Bestand absolut setzen:

```json
{ "action": "set_stock", "amount": 15.5 }
```

Response:

```json
{
  "medication": {},
  "history_entry": {
    "id": 8,
    "medication_id": 12,
    "user_id": 1,
    "action": "set_stock",
    "old_stock": 20,
    "new_stock": 15.5,
    "timestamp": "2026-07-15 10:10:00"
  }
}
```

Fehler: `400` unbekannte Aktion, negative/ungültige Menge oder nicht positive
Packungsgröße; `404` unbekanntes/fremdes Medikament.

### `GET /api/medications/:id/history?limit=50`

Response: `{ "history": [...] }`. Standardlimit 50, Wertebereich 1 bis 200,
Sortierung neueste zuerst. Ungültige Werte fallen auf 50 zurück.

## Fotos

### `POST /api/medications/:id/photo`

`multipart/form-data`, Dateifeld `photo`, maximal 5 MiB.

Response `200`: `{ "medication": <angereichertes Medikament> }`. Ein vorhandenes
Foto wird nach erfolgreichem Datenbankupdate gelöscht.

### `DELETE /api/medications/:id/photo`

Response `200`: `{ "medication": <angereichertes Medikament> }`.

Fehler: `400`, wenn kein Foto vorhanden ist; `404` bei unbekanntem/fremdem
Medikament.

`photo_url` ist eine fünf Minuten gültige HMAC-signierte URL auf
`GET /api/medications/:id/photo-content`. Das Uploadverzeichnis selbst ist nicht
öffentlich erreichbar.

## Benutzer

### `GET /api/user/profile`

Response:

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2026-07-15 10:00:00",
    "last_login": "2026-07-15 10:05:00",
    "dashboard_view": "grid",
    "calendar_view": "dayGridMonth"
  }
}
```

### `PUT /api/user/password`

```json
{
  "current_password": "bisheriges-passwort",
  "new_password": "neues-passwort"
}
```

Neues Passwort: mindestens acht Zeichen. Response:
`{ "message": "Passwort erfolgreich geändert" }`.

Fehler: `400` ungültiges neues Passwort, `401` falsches aktuelles Passwort,
`404` Benutzer fehlt.

### `GET /api/user/preferences`

```json
{
  "preferences": {
    "dashboardView": "grid",
    "calendarView": "dayGridMonth",
    "dose_times": {
      "morning": "08:00",
      "noon": "12:00",
      "evening": "20:00"
    },
    "notificationWeeklyEnabled": false,
    "notificationStatusEnabled": false
  }
}
```

### `PUT /api/user/preferences`

Partielle Aktualisierung:

```json
{
  "dashboardView": "list",
  "calendarView": "listMonth",
  "dose_times": {
    "morning": "07:30",
    "noon": "12:30",
    "evening": "20:30"
  },
  "notificationWeeklyEnabled": true,
  "notificationStatusEnabled": false
}
```

Zulässig:

- Dashboard: `grid`, `list`
- Kalender: `dayGridMonth`, `listMonth`
- Uhrzeiten: `HH:MM`, 24-Stunden-Format
- Benachrichtigungs-Toggles: Booleans (nur echte Booleans, Strings → `400`)

Empfänger aller Benachrichtigungen ist die registrierte E-Mail-Adresse des
Benutzers. SMTP-Zugangsdaten verlassen das Backend nie und tauchen in keiner
API-Antwort auf.

Response: `{ "preferences": <aktuelle Präferenzen> }`.

## Datenexport und -import

### `GET /api/data/export`

Beabsichtigte Response:

```json
{
  "success": true,
  "data": {
    "version": "2.0.0",
    "exportDate": "2026-07-15T10:00:00.000Z",
    "user": {},
    "medications": [],
    "history": []
  }
}
```

Fotos und interne `user_id`-/`photo_path`-Felder werden nicht exportiert.

### `POST /api/data/import`

```json
{ "data": { "medications": [], "history": [] } }
```

Auch ein leerer Export ist gültig. Der Import validiert die komplette Datei und
ersetzt anschließend alle Medikamente und History des Benutzers transaktional.

```json
{
  "success": true,
  "message": "Daten erfolgreich importiert",
  "imported": { "medications": 3, "history": 12 }
}
```

Intervallfelder und eindeutige History-Zuordnungen werden übernommen. Nicht
zuordenbare History bricht den gesamten Import mit Rollback ab.

## Health Check

### `GET /health`

Antwort:

```json
{ "status": "ok" }
```

Bei Datenbankfehler: Status `503` mit `{ "status": "error" }`. Die Route steht
vor dem SPA-Fallback.

## `curl`-Beispiele

```bash
curl -sS http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"sicheres-passwort"}'
```

```bash
curl -sS http://localhost:3000/api/medications \
  -H "Authorization: Bearer $TOKEN"
```

```bash
curl -sS http://localhost:3000/api/medications/12/photo \
  -H "Authorization: Bearer $TOKEN" \
  -F 'photo=@packung.jpg'
```
