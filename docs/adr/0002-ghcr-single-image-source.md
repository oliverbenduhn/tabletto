# GHCR als einzige Image-Quelle, Komodo zieht

Das einzige Docker-Image, das in Produktion läuft, kommt aus
`ghcr.io/oliverbenduhn/tabletto`. Der CI-Workflow baut das Image auf
PR und `main`-Push, pusht aber nirgendwo hin. Der Release-Workflow
pusht die Tags `:X.Y.Z` und `:latest` nach GHCR, sobald release-please
einen Release erzeugt hat. Komodo zieht `:latest` per Webhook-Trigger
aus GHCR und baut nicht selbst. Damit ist das getestete Artefakt
identisch mit dem deployten Artefakt; lokale `git pull`-basierte
Builds auf dem Prod-Host entfallen. Geprüfte Alternativen waren
„Komodo baut weiter aus Git" (entkoppelt CI- und Prod-Artefakt) und
„CI pusht zusätzlich auf `:main`" (Artefakt ohne Konsument, GHCR-Ballast).
