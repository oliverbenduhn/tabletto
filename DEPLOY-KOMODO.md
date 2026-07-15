# Tabletto mit Komodo deployen

Diese Anleitung ergänzt das allgemeine [Betriebshandbuch](docs/operations.md)
für ein Git-basiertes Komodo-Deployment.

## Voraussetzungen

- Komodo mit Zugriff auf einen Docker-Host
- vom Host erreichbares GitHub-Repository
- persistenter Docker-Speicher
- optional Domain und bestehender HTTPS-Reverse-Proxy

## Stack anlegen

In Komodo einen neuen Stack mit folgenden Werten erstellen:

| Feld | Wert |
|---|---|
| Name | `tabletto` |
| Repository | `https://github.com/oliverbenduhn/tabletto.git` |
| Branch | `main` oder ein bewusst fixierter Release-Tag |
| Compose-Pfad | `compose.yaml` |

Für reproduzierbare Produktion ist ein Release-Tag sicherer als der bewegliche
`main`-Branch.

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

`JWT_SECRET` als geschütztes Secret in Komodo hinterlegen, nicht in das
Repository oder die Compose-Datei schreiben. Ein Wechsel macht bestehende JWTs
ungültig.

## Deployment

1. Stackkonfiguration speichern.
2. Build und Deployment starten.
3. Buildlog auf Vite-, SQLite- und Dockerfehler prüfen.
4. Containerstatus und Logs öffnen.
5. Anwendung aufrufen und Registrierung/Login testen.

Die Daten werden im benannten Volume `tabletto-data` unter `/app/data`
persistiert. Prüfen, dass ein Redeploy dieses Volume wiederverwendet.

## Reverse Proxy

Der Proxy leitet auf Host beziehungsweise Containerport 3000. Für Traefik können
projektspezifisch Labels ergänzt werden, beispielsweise:

```yaml
services:
  tabletto:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.tabletto.rule=Host(`tabletto.example.org`)"
      - "traefik.http.routers.tabletto.entrypoints=websecure"
      - "traefik.http.routers.tabletto.tls=true"
      - "traefik.http.services.tabletto.loadbalancer.server.port=3000"
```

Netzwerkname, Zertifikatsresolver und EntryPoints müssen zur lokalen
Traefik-Installation passen. Port 3000 nach erfolgreicher Proxyanbindung nicht
zusätzlich öffentlich exponieren.

## Health und Verifikation

```bash
curl -i https://tabletto.example.org/health
```

Nicht nur Status 200 prüfen, sondern JSON-Body und `Content-Type`. Im aktuellen
Code kann die SPA-Wildcard den Health-Endpunkt abfangen.

Zusätzliche Smoke-Tests:

- Registrierung und Login
- Medikament anlegen und neu laden
- Foto hochladen und nach Redeploy anzeigen
- Container neu starten und Datenpersistenz prüfen
- Schedulerlog nur bei bewusst aktiviertem Scheduler kontrollieren

## Backup vor Updates

Komodo-Redeploys schützen nicht vor Schema- oder Bedienfehlern. Vor jedem Update
Datenbank und Uploads gemeinsam sichern. Das sichere Offline-Verfahren und der
Restore-Ablauf stehen in [docs/operations.md](docs/operations.md).

Backups nicht ausschließlich im Volume `tabletto-data` aufbewahren.

## Update und Rollback

1. Release Notes und Migrationen prüfen.
2. vollständiges Backup erstellen.
3. Repository-Referenz auf den Ziel-Tag ändern oder neuen Stand pullen.
4. Build und Redeploy ausführen.
5. Logs, Login, Daten und Fotos prüfen.

Für Rollback die vorherige Image-/Tag-Version deployen. Da Migrationen keinen
Down-Pfad haben, kann zusätzlich ein Daten-Restore erforderlich sein.

## Häufige Fehler

| Problem | Prüfung |
|---|---|
| Build läuft aus Speicher | Buildhost-RAM erhöhen, Buildlog prüfen |
| Container startet wiederholt | Logs, `.env`, Volume-Rechte, Portbelegung |
| Daten nach Redeploy weg | Volume-Zuordnung und `DB_PATH` prüfen |
| Fotos fehlen | `UPLOADS_PATH=/app/data/uploads` und Volume prüfen |
| Login plötzlich ungültig | wurde `JWT_SECRET` ersetzt? |
| mehrfacher Bestandsabzug | nur eine scheduleraktive Instanz betreiben |
| Health zeigt HTML | bekannte Route-Reihenfolge im Backend |

Portainer, Dockge und ähnliche Werkzeuge können dieselbe `compose.yaml`
verwenden. Feldnamen und Secretverwaltung unterscheiden sich; maßgeblich bleiben
die Variablen und Persistenzregeln aus dem Betriebshandbuch.
