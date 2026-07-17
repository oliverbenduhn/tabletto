# release-please released ohne manuellen Merge-Schritt (Auto-Merge)

Release-Versionierung läuft über `release-please` im Standard-PR-Modus,
aber ohne manuellen Eingriff: Der Workflow lässt die Action bei jedem
Push auf `main` den Release-PR erstellen bzw. aktualisieren
(Versionsbumps in `package.json` von Root, `backend/`, `frontend/` via
`extra-files`, plus `CHANGELOG.md`), merged diesen PR im selben Lauf
sofort per Squash und ruft die Action ein zweites Mal auf, die dann Tag
`vX.Y.Z` und GitHub-Release erzeugt. Aus Maintainer-Sicht verhält sich
das wie ein Direkt-Commit.

Ein echter Direkt-Commit-Modus existiert in release-please nicht: die
ursprünglich angenommene Option `pull-request: false` gibt es nicht,
und `skip-github-pull-request: true` überspringt den Versions-Commit
komplett (nur Tagging). Geprüfte Alternativen waren ein Release-PR mit
manuellem Merge (zeremoniell bei einem 1-Personen-Projekt, in dem der
einzige Approver der Maintainer selbst ist), ein separates Bump-Skript
(deterministisch von Conventional Commits, kein Mehrwert gegenüber
release-please) und ein Werkzeugwechsel auf semantic-release (nativer
Direkt-Commit, aber ~5 Plugins neues Tooling und Verlust des
release-please-Changelog-Formats). Der Verlust der Approval-Gate wird
akzeptiert, weil die Bump-Mechanik deterministisch aus bereits
gemergten Conventional Commits folgt.
