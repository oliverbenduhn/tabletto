# Webhook-Deploy aus dem Release-Workflow mit striktem Default

Nach erfolgreichem Image-Push im Release-Workflow ruft derselbe
Workflow den Komodo-Deploy-Webhook auf, authentifiziert über die
GitHub-Secrets `KOMODO_WEBHOOK_URL` und `KOMODO_WEBHOOK_SECRET`. Der
Default ist „Webhook zwingend": Fehlen die Secrets oder schlägt der
Aufruf fehl, wird der Workflow rot, das Image liegt aber bereits in
GHCR und ein manueller Redeploy in Komodo bleibt möglich. Eine
Repo-Variable `DEPLOY_WEBHOOK_OPTIONAL=true` schaltet den Webhook-Step
explizit als „skip mit Hinweis" ab und ist ausschließlich für die
kurze Übergangsphase vorgesehen, in der die Komodo-Webhook-Konfig
noch nicht aktiviert ist. Geprüfte Alternativen waren „Workflow
bleibt grün bei fehlenden Secrets" (gefährlich: Production-Drift
bleibt unsichtbar) und „Komodo pollt GHCR selbst" (würde eine zweite
Deploy-Quelle ins System zurückbringen, die genau abgeschafft werden
soll).
