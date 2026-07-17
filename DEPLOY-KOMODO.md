# Tabletto mit Komodo deployen

Diese Anleitung ergänzt das [Betriebshandbuch](docs/operations.md). Komodo baut
Tabletto nicht selbst, sondern zieht das von GitHub Actions veröffentlichte
Release-Image aus GHCR.

## Voraussetzungen

- Komodo mit Zugriff auf einen Docker-Host
- Zugriff auf das öffentliche Package `ghcr.io/oliverbenduhn/tabletto`
- persistenter Docker-Speicher
- optional Domain und bestehender HTTPS-Reverse-Proxy

## Stack anlegen

| Feld | Wert |
|---|---|
| Name | `tabletto` |
| Repository | `https://github.com/oliverbenduhn/tabletto.git` |
| Branch | `main` |
| Compose-Pfad | `compose.yaml` |

Die Repository-Referenz liefert die Compose-Konfiguration; der Container selbst
kommt aus `ghcr.io/oliverbenduhn/tabletto:latest`. Für ein fest gepinntes
Deployment in Komodo beziehungsweise `compose.yaml` den Image-Tag auf eine
Version wie `1.6.0` setzen. Image-Tags tragen kein führendes `v`.

## Variablen und Secrets

Mindestens:

```dotenv
JWT_SECRET=<langes-zufälliges-secret>
TZ=Europe/Berlin
ENABLE_STOCK_SCHEDULER=true
STOCK_SCHEDULER_CRON=*/5 * * * *
```

Bei Domainbetrieb:

```dotenv
FRONTEND_ORIGIN=https://tabletto.example.org
```

`JWT_SECRET` geschützt in Komodo hinterlegen. Ein Wechsel macht bestehende JWTs
ungültig. SMTP-Zugangsdaten werden ebenfalls nur als Umgebungsvariablen oder
Komodo-Secrets gesetzt.

## Webhook-Deploy

1. Am Tabletto-Stack in Komodo den GitHub-kompatiblen Deploy-Webhook aktivieren
   und die `/deploy`-URL kopieren.
2. Das globale beziehungsweise ressourcenspezifische Komodo-Webhook-Secret als
   GitHub-Secret `KOMODO_WEBHOOK_SECRET` hinterlegen.
3. Die URL als GitHub-Secret `KOMODO_WEBHOOK_URL` hinterlegen.
4. Nach erfolgreicher Einrichtung die Übergangsvariable
   `DEPLOY_WEBHOOK_OPTIONAL` entfernen.

Der Release-Workflow sendet einen Push-Body für `main` und signiert ihn als
HMAC-SHA256 im Header `X-Hub-Signature-256`. Fehlende Secrets oder ein
fehlgeschlagener Aufruf machen den Workflow standardmäßig rot; das bereits
gepushte Image kann dann in Komodo manuell deployed werden.

## Deployment und Verifikation

1. Stackkonfiguration speichern und deployen. `pull_policy: always` zieht das
   aktuelle Release-Image.
2. Containerstatus und Logs prüfen.
3. Registrierung/Login sowie Persistenz testen.
4. Sicherstellen, dass ein Redeploy das Volume `tabletto-data` wiederverwendet.

```bash
curl -fsS https://tabletto.example.org/health
```

Erwartet wird `{"status":"ok"}`. Zusätzlich Medikament anlegen, Foto laden und
einen Containerneustart prüfen. Nur eine scheduleraktive Instanz betreiben.

## Reverse Proxy

Der Proxy leitet auf Port 3000. Für Traefik können installationsspezifische
Labels ergänzt werden. Port 3000 nach erfolgreicher Proxyanbindung nicht
zusätzlich öffentlich exponieren und `FRONTEND_ORIGIN` auf die exakte
HTTPS-Origin setzen.

## Backup, Update und Rollback

Vor jedem Update Datenbank und Uploads gemeinsam sichern; das Offline-Verfahren
und der Restore-Ablauf stehen im [Betriebshandbuch](docs/operations.md).
Backups nicht ausschließlich im Anwendungsvolume aufbewahren.

Ein normales Update entsteht durch einen automatischen Release. Der Webhook
deployed anschließend `:latest`; alternativ in Komodo manuell „Redeploy“
auslösen.

Für einen Rollback den Image-Tag auf die vorherige Version, zum Beispiel
`1.5.0`, setzen und redeployen. Bei inkompatiblen Datenbankmigrationen reicht
ein Image-Rollback nicht; dann zusätzlich den passenden Datenstand restaurieren.

## Häufige Fehler

| Problem | Prüfung |
|---|---|
| Image-Pull schlägt fehl | GHCR-Package öffentlich, Netzwerk und Tag prüfen |
| Webhook wird abgewiesen | URL, Secret, HMAC-Header und Komodo-Logs prüfen |
| Container startet wiederholt | Logs, `.env`, Volume-Rechte, Portbelegung |
| Daten nach Redeploy weg | Volume-Zuordnung und `DB_PATH` prüfen |
| Fotos fehlen | `UPLOADS_PATH=/app/data/uploads` und Volume prüfen |
| Login plötzlich ungültig | wurde `JWT_SECRET` ersetzt? |
| mehrfacher Bestandsabzug | nur eine scheduleraktive Instanz betreiben |
