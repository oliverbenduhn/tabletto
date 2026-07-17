# Tabletto

Tabletto ist eine deutschsprachige Webanwendung zur persönlichen Verwaltung
von Medikamentenbeständen. Dieses Glossar dokumentiert die ubiquitäre Sprache
des Projekts — Begriffe, die in Domänenlogik, API-Verträgen und
Benutzertexten konsistent verwendet werden.

## Benachrichtigungen

**Benachrichtigung**:
Eine vom Backend ausgelöste E-Mail an einen Benutzer, die einen Bezug zum
eigenen Medikamentenbestand hat.
_Avoid_: Notification, Mail, Alert

**SMTP-Konfiguration**:
Global in der Backend-Umgebung hinterlegte Zugangsdaten für den Mailversand.
_Avoid_: Mail-Settings, Server-Einstellungen

**Empfänger**:
Die registrierte E-Mail-Adresse des Benutzers aus `users.email` als Ziel
einer Benachrichtigung.
_Avoid_: Empfänger-Adresse, Notification-Target

**Bestandsinfo-Mail**:
Wöchentliche E-Mail mit einer Zusammenfassung des Bestandszustands und
einer Liste der Medikamente mit kritischem oder gelbem Warnstatus samt
Leerstandsdaten.
_Avoid_: Wochenmail, Wochenrückblick

**Statuswarnung**:
E-Mail, die eine Status-Verschlechterung bei einem oder mehreren
Medikamenten meldet.
_Avoid_: Status-Alert, Statusänderungs-Mail

**Status-Verschlechterung**:
Übergang des `warning_status` zu einem schlechteren Wert — `good → warning`,
`good → critical` oder `warning → critical`.
_Avoid_: Statuswechsel, Status-Drop

**Erholungs-Übergang**:
Übergang des `warning_status` zu einem besseren Wert (`warning → good`,
`critical → warning`, `critical → good`).
_Avoid_: Recovery-Transition

**Opt-in-Benachrichtigung**:
Benachrichtigungsart, die ein Benutzer explizit aktivieren muss, damit das
Backend Mails verschickt.
_Avoid_: Aktiv-Modus