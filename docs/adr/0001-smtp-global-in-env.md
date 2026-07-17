# SMTP-Konfiguration global in der Backend-Umgebung

Die SMTP-Zugangsdaten werden in der Backend-Umgebung (`.env`) hinterlegt,
nicht pro Benutzer in der Datenbank und nicht über eine eigene
Admin-Rolle verwaltet. Tabletto kennt kein Admin-Konzept; der
Mailversand ist eine bewusste Betriebsentscheidung, kein benutzerbezogener
Parameter. Geprüfte Alternativen waren pro-Benutzer-Felder in `users`
sowie eine neue globale Admin-Rolle. Beide wurden verworfen, weil sie für
ein v1-Feature YAGNI sind und eine Rolle samt Berechtigungen und UI nur
für SMTP eingeführt hätten.