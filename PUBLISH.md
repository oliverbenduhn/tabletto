# Releases veröffentlichen

Tabletto verwendet Semantic Versioning, Conventional Commits und
`release-please`. Releases entstehen nach erfolgreicher CI automatisch; Tags,
GitHub-Releases und Produktionsimages werden nicht manuell erstellt.

## Voraussetzungen

- GitHub Actions darf Pull Requests und Releases schreiben sowie Pakete nach
  GHCR pushen.
- Das GHCR-Package `ghcr.io/oliverbenduhn/tabletto` ist öffentlich, damit der
  Produktionshost ohne Registry-Credentials pullen kann.
- `KOMODO_WEBHOOK_URL` und `KOMODO_WEBHOOK_SECRET` sind als GitHub-Secrets
  hinterlegt.
- Nur während der Einrichtung darf die Repository-Variable
  `DEPLOY_WEBHOOK_OPTIONAL=true` den fehlenden Deploy-Webhook tolerieren.

Der automatische Squash-Merge des Release-PRs setzt voraus, dass die
Branch-Protection dem `GITHUB_TOKEN` diesen Merge erlaubt. Der Workflow prüft
einen tatsächlichen synchronen Merge und wird andernfalls rot; er merkt keinen
späteren Auto-Merge vor.

## Ablauf

1. Ein Conventional Commit landet auf `main`.
2. `ci.yml` führt Backend- und E2E-Tests aus und baut das Docker-Image ohne Push.
3. Erst nach erfolgreicher CI erstellt oder aktualisiert `release-please.yml`
   den Release-PR und merged ihn sofort per Squash.
4. Ein zweiter Release-Please-Aufruf erzeugt Tag `vX.Y.Z` und GitHub-Release.
5. Der Workflow baut den Release-Stand und pusht
   `ghcr.io/oliverbenduhn/tabletto:X.Y.Z` sowie `:latest`.
6. Der signierte Komodo-Webhook löst den Redeploy aus.

Der Release-PR aktualisiert `CHANGELOG.md`, die Rootversion sowie
`backend/package.json` und `frontend/package.json`. Die UI liest beim Build die
Frontend-Paketversion. Die Image-Metadaten erhalten dieselbe Version über das
Build-Argument `APP_VERSION`.

Für die einmalige Einführung begrenzt `bootstrap-sha` die Historie auf den
vorhandenen 1.5.0-Bump-Commit. Das ist nötig, weil der Paketstand 1.5.0 nie als
GitHub-Tag veröffentlicht wurde; der letzte alte Release ist `v1.3.0`.

Der Bump-Commit selbst startet wegen des GitHub-Token-Rekursionsschutzes keine
weitere CI. Dieses Restrisiko ist akzeptiert, weil er ausschließlich
deterministische Versions- und Changelog-Änderungen enthält. Das Release-Image
wird aus diesem Stand neu gebaut; CI- und Release-Build verwenden denselben
Dockerfile, sind aber keine byte-identische Wiederverwendung desselben Builds.

## Conventional Commits

- `fix:` erzeugt einen Patch-Release.
- `feat:` erzeugt einen Minor-Release.
- `feat!:`/`fix!:` oder ein `BREAKING CHANGE:`-Footer erzeugt einen
  Major-Release.
- Commits ohne releasebaren Typ werden gesammelt, lösen aber allein keinen
  Release aus.

Eine Version kann explizit erzwungen werden:

```bash
git commit --allow-empty -m "chore: release 2.0.0" -m "Release-As: 2.0.0"
git push origin main
```

## Recovery und Verifikation

Bricht ein Lauf nach dem Release-PR-Merge ab, `Release` in GitHub Actions über
`workflow_dispatch` erneut starten. Der erste Release-Please-Aufruf erkennt den
gemergten PR; dessen Outputs werden mit denen des optionalen zweiten Aufrufs
konsolidiert.

Existiert der GitHub-Release bereits, aber Image-Push oder Webhook schlug danach
fehl, beim manuellen Start dessen `X.Y.Z` als `version` angeben. Ohne Eingabe
wird bewusst der neueste GitHub-Release erneut nach GHCR veröffentlicht und
deployed.

Nach einem echten Release prüfen:

- CI und Release-Workflow sind grün.
- Tag `vX.Y.Z`, GitHub-Release und beide GHCR-Tags existieren.
- das Image-Label `org.opencontainers.image.version` ist `X.Y.Z`.
- Komodo hat neu deployed und `/health` liefert `{"status":"ok"}`.
- Login, Persistenz und Fotos funktionieren; bei Migrationen zusätzlich den
  dokumentierten Restore-Test durchführen.

Einen fehlerhaften Tag nicht verschieben. Stattdessen Auswirkung dokumentieren,
bei Datenrisiko das Deployment stoppen und einen korrigierenden Patch-Release
erstellen.
