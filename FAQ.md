# CallLiveNotes – Erweiterte FAQ (43 Fragen)

---

## Inhaltsverzeichnis

1. [Allgemein](#allgemein)
2. [Installation & Einrichtung](#installation--einrichtung)
3. [Nutzung & Funktionen](#nutzung--funktionen)
4. [Technische Details](#technische-details)
5. [Datenschutz & Sicherheit](#datenschutz--sicherheit)
6. [Fehlerbehebung](#fehlerbehebung)

---

## Allgemein

### 1. Was ist CallLiveNotes?
CallLiveNotes ist eine mobile App, die automatisch eingehende und ausgehende Anrufe erkennt und Ihnen ermöglicht, Notizen direkt während des Gesprächs zu erfassen. Die App speichert alle Notizen mit Zeitstempel und bietet Funktionen wie Suche, Export und Backup.

### 2. Was kostet CallLiveNotes?
Die App ist aktuell kostenlos verfügbar. Es sind keine Premium-Funktionen geplant, aber wir behalten uns vor, in Zukunft optional erweiterte Features anzubieten.

### 3. Auf welchen Plattformen ist CallLiveNotes verfügbar?
- Android 6.0 oder höher: Volle Funktionalität inkl. automatischer Anruferkennung
- iOS: Eingeschränkte Funktionalität (keine automatische Anruferkennung, manuelle Notizerstellung möglich)

### 4. Benötige ich ein Konto, um CallLiveNotes zu nutzen?
Nein. Die App funktioniert vollständig offline und erfordert keine Registrierung oder Anmeldung.

### 5. Für wen ist CallLiveNotes besonders geeignet?
Die App richtet sich an Berufstätige mit hohem Telefonaufkommen, Selbstständige und Freiberufler sowie Privatpersonen, die wichtige Telefonate festhalten möchten.

---

## Installation & Einrichtung

### 6. Wie installiere ich CallLiveNotes?
1. Frontend: Navigieren Sie zu /app/frontend und starten Sie die App mit yarn start.
2. Die App ist über Expo Go auf Ihrem Gerät verfügbar.

### 7. Welche Berechtigungen sind erforderlich und warum?
Auf Android benötigen wir READ_PHONE_STATE zum Erkennen von Anrufstatus und READ_CALL_LOG zum Auslesen der Telefonnummer. Diese Berechtigungen werden ausschließlich für die Anruferkennung verwendet.

### 8. Wie richte ich die App nach der Installation ein?
1. Starten Sie die App und erteilen Sie die angeforderten Berechtigungen.
2. Die App erkennt automatisch Anrufe und öffnet die Notizfunktion.
3. Für iOS: Notizen müssen manuell über die Suchfunktion oder durch Eingabe der Telefonnummer erstellt werden.



---

## Nutzung & Funktionen

### 13. Wie funktioniert die automatische Anruferkennung?
Auf Android erkennt die App eingehende und ausgehende Anrufe über die System-APIs und öffnet automatisch die Notizansicht.

### 14. Warum funktioniert die Anruferkennung nicht auf iOS?
Apple erlaubt aus Datenschutzgründen keinen Zugriff auf Anrufdaten durch Drittanbieter-Apps.

### 15. Kann ich Notizen auch manuell erstellen?
Ja, automatisch bei Anrufen (Android) oder manuell durch Suche oder direkte Eingabe.

### 16. Wie bearbeite oder lösche ich bestehende Notizen?
Bearbeiten: Stift-Symbol in der Detailansicht. Löschen: Papierkorb-Symbol.

### 17. Wie suche ich nach bestimmten Notizen oder Telefonnummern?
Nutzen Sie die Suchleiste auf dem Hauptbildschirm.

### 18. Wie werden die Notizen sortiert?
Automatisch nach dem Zeitpunkt des letzten Anrufs (neueste zuerst).

### 19. Kann ich Notizen mit Kollegen teilen?
Ja, über die Export-Funktion (PDF/CSV) per E-Mail oder Cloud-Dienst.

### 20. Wie teile ich Notizen per E-Mail?
Öffnen Sie die Detailansicht, tippen Sie auf das Teilen-Symbol und wählen Sie PDF oder CSV aus.

### 21. Kann ich Notizen direkt aus der App in eine Cloud hochladen?
Ja, über das System-Share-Menü nach dem Export.

### 22. Werden beim Teilen auch die Zeitstempel mit exportiert?
Ja, sowohl PDF- als auch CSV-Exporte enthalten alle Metadaten.

### 23. Kann ich bestimmte Notizen auswählen, die ich teilen möchte?
Aktuell werden alle Notizen einer Telefonnummer exportiert.

### 24. Gibt es eine Option, Notizen als schreibgeschützt zu teilen?
Nein, die exportierten Dateien sind statisch. Nutzen Sie Cloud-Dienste mit Nur-Ansicht-Berechtigungen.

### 25. Wie kann ich Notizen in ein CRM-System importieren?
Exportieren Sie als CSV und importieren Sie in Ihr CRM-System.

---

## Technische Details



### 28. Wie skalierbar ist die App?
Frontend: React Native ist für mobile Geräte optimiert.

### 29. Kann ich die App an meine Bedürfnisse anpassen?
Ja, der Quellcode ist offen. Frontend: /app/frontend/app/.

### 32. Welche Abhängigkeiten hat das Frontend?
react-native, expo, react-native-call-detection, @react-navigation/native (siehe package.json).

---

## Datenschutz & Sicherheit

### 33. Wo werden meine Notizen und Daten gespeichert?
Lokal auf Ihrem Gerät in einer SQLite-Datenbank.

### 34. Greift die App auf mein Telefonbuch oder meine Kontakte zu?
Nein, nur Telefonnummern mit Notizen werden gespeichert.

### 35. Werden Gesprächsinhalte, Anrufdauer oder andere sensible Daten aufgezeichnet?
Nein, nur Telefonnummer, Notiztext, Datum und Uhrzeit.

---

## Fehlerbehebung

### 36. Was tun, wenn das Backup nicht wiederhergestellt wird?
Überprüfen Sie die JSON-Datei und wählen Sie den richtigen Modus (Zusammenführen/Ersetzen).

### 37. Warum werden meine Notizen nicht angezeigt?
Prüfen Sie Cache (Pull-to-Refresh) oder die lokale Datenbank.

### 38. Die App stürzt beim Start ab – was kann ich tun?
Prüfen Sie Logs (supervisorctl tail expo stderr), aktualisieren Sie Abhängigkeiten oder starten Sie das Gerät neu.

### 39. Warum funktioniert die Suchfunktion nicht?
Die Suche ist case-sensitive. Geben Sie die Nummer exakt ein.

### 40. Wie behebe ich Probleme mit der Anruferkennung?
Prüfen Sie Berechtigungen (READ_PHONE_STATE, READ_CALL_LOG) und Gerätekompatibilität (Android 6.0+).

### 41. Was tun, wenn die App keine Berechtigungen anfordert?
Erteilen Sie Berechtigungen manuell in den Einstellungen oder löschen Sie App-Daten.

### 42. Warum wird die falsche Telefonnummer angezeigt?
Bei unterdrückten Nummern oder VoIP kann die Erkennung ungenau sein. Bearbeiten Sie die Nummer manuell.

### 43. Wie setze ich die App auf Werkseinstellungen zurück?
Löschen Sie App-Daten und deinstallieren Sie die App.

---
*Falls Ihre Frage nicht beantwortet wurde, wenden Sie sich bitte an unser Support-Team.*