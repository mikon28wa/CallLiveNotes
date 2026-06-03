# CallLiveNotes

Eine mobile Anwendung zum Erstellen und Verwalten von Notizen während Telefonanrufen. Optimiert für Android mit eingeschränkter Funktionalität auf iOS.

---

## Inhaltsverzeichnis
1. [Funktionen](#funktionen)
2. [Neue Erweiterungen](#neue-erweiterungen)
3. [Technologie-Stack](#technologie-stack)
4. [Voraussetzungen](#voraussetzungen)
5. [Installation](#installation)
6. [Verwendung](#verwendung)
7. [API-Dokumentation](#api-dokumentation)
8. [Datenbank-Schema](#datenbank-schema)
9. [Backup & Export](#backup--export)
10. [Fehlerbehebung](#fehlerbehebung)
11. [Projektstruktur](#projektstruktur)
12. [Einschränkungen](#einschränkungen)
13. [Datenschutz](#datenschutz)
14. [FAQ](#faq)
15. [Dokumentation & Ressourcen](#dokumentation--ressourcen)

---

## Funktionen

### Kernfunktionen
- Automatische Notizerstellung: Erkennung eingehender/ausgehender Anrufe mit sofortiger Notizfunktion (Android)
- Zeitgestempelte Notizen: Jede Notiz wird mit Datum und Uhrzeit gespeichert
- Notizhistorie: Vollständige Historie aller Notizen pro Telefonnummer
- Echtzeit-Bearbeitung: Notizen können jederzeit bearbeitet oder gelöscht werden

### Such- und Sortierfunktionen
- Schnelle Suche nach Telefonnummern
- Automatische Sortierung nach letztem Anruf (neueste zuerst)

### Export-Optionen
- PDF-Export: Formatierte PDFs pro Telefonnummer
- CSV-Export: Einzelne oder alle Notizen als CSV
- Backup: Vollständige Datensicherung als JSON

### Plattformspezifische Hinweise
- Android: Volle Funktionalität inkl. Anruferkennung
- iOS: Manuelle Notizerstellung (automatische Erkennung nicht möglich)

---

## Neue Erweiterungen

### Notizen teilen
- Exportieren Sie Notizen als PDF oder CSV
- Teilen Sie Dateien per E-Mail, Messenger oder Cloud-Dienst (Google Drive, Dropbox)
- Direkter Upload in Cloud-Apps über das System-Share-Menü
- Zeitstempel werden beim Export mit berücksichtigt

### Technische Details
- Selbstgehostete Datenbank: MongoDB 5.0+ auf eigenem Server möglich
- Backend: FastAPI mit Python 3.8+
- Frontend: React Native mit Expo
- Skalierbarkeit: Load Balancing für Backend, geclusterte MongoDB für hohe Lasten
- API-Dokumentation für Entwickler verfügbar

### Fehlerbehebung
- Detaillierte Anleitungen für häufige Probleme
- Log-Analyse für Backend und Frontend
- Berechtigungsmanagement für Android
- App-Reset auf Werkseinstellungen

---

## Technologie-Stack

| Bereich       | Technologie          |
|---------------|----------------------|
| Frontend      | React Native + Expo Router |
| Backend       | FastAPI (Python)     |
| Datenbank     | MongoDB              |
| Anruferkennung| react-native-call-detection |

---

## Voraussetzungen

### Android
- Mindestsystem: Android 6.0 (API Level 23)
- Benötigte Berechtigungen:
  - READ_PHONE_STATE (Anrufstatus)
  - READ_CALL_LOG (Telefonnummernauslesung)

### iOS
- Einschränkung: Automatische Anruferkennung nicht verfügbar (Apple-Richtlinien)
- Funktionsumfang: Manuelle Notizverwaltung möglich

---

## Installation

### Backend starten
```bash
cd /app/backend
pip install -r requirements.txt
python server.py
```
Das Backend läuft auf http://0.0.0.0:8001

### Frontend starten
```bash
cd /app/frontend
yarn install
yarn start
```
Das Frontend läuft auf Port 3000 und ist über Expo Go erreichbar.

---

## Verwendung

### 1. Hauptbildschirm
- Zeigt alle Telefonnummern mit Notizen an
- Jeder Eintrag zeigt: Telefonnummer, Letzte Notiz (Vorschau), Zeitpunkt des letzten Anrufs, Anzahl der Notizen
- Suchleiste zum Filtern nach Telefonnummer
- Pull-to-Refresh zum Aktualisieren der Liste

### 2. Detail-/Notizansicht
- Wird automatisch beim Anruf geöffnet (Android)
- Zeigt alle Notizen für eine Telefonnummer
- Jede Notiz zeigt: Erstellungsdatum, Notiztext, Bearbeitungszeitpunkt
- Funktionen: Neue Notiz hinzufügen, Notiz bearbeiten, Notiz löschen

### 3. Notizen teilen
- Tippen Sie auf das Teilen-Symbol in der Detailansicht
- Wählen Sie PDF oder CSV aus
- Teilen Sie die Datei per E-Mail oder Cloud-Dienst

### 4. Export-Funktionen
- Einzelne Telefonnummer: Teilen-Symbol → PDF/CSV
- Alle Daten: Hauptmenü (⋮) → Alle als CSV exportieren

### 5. Backup & Sync
- Backup erstellen: Hauptmenü → Backup erstellen (JSON-Datei)
- Backup wiederherstellen: Hauptmenü → Backup wiederherstellen
- Modi: Zusammenführen (keine Duplikate) oder Ersetzen (alle Daten löschen)

---

## API-Dokumentation

### Basis-URL
http://0.0.0.0:8001/api

### Endpunkte

| Methode | Endpunkt                          | Beschreibung                          |
|---------|-----------------------------------|---------------------------------------|
| GET     | /notes                           | Liste aller Telefonnummern           |
| GET     | /notes/{phone_number}           | Notizen einer Nummer                  |
| POST    | /notes/{phone_number}           | Neue Notiz erstellen                 |
| PUT     | /notes/{phone_number}/{note_id}| Notiz aktualisieren                   |
| DELETE  | /notes/{phone_number}/{note_id}| Notiz löschen                         |
| POST    | /notes/{phone_number}/call-started | Anrufstart markieren              |
| GET     | /backup                          | Backup erstellen                      |
| POST    | /restore                         | Backup wiederherstellen               |

---

## Datenbank-Schema

### Collection: call_notes

```json
{
  "_id": "ObjectId",
  "phone_number": "string",
  "notes": [
    {
      "note_id": "uuid",
      "text": "string",
      "created_at": "datetime",
      "updated_at": "datetime"
    }
  ],
  "last_call_time": "datetime"
}
```

---

## Backup & Export

### Export-Formate
| Format | Inhalt                          | Verwendung                     |
|--------|---------------------------------|-------------------------------|
| PDF    | Formatierte Notizen einer Nummer | Drucken/Teilen                |
| CSV    | Tabellarische Notizen           | Excel/Tabellenkalkulation     |
| JSON   | Vollständiges Backup            | Datensicherung/Wiederherstellung |

### Backup-Empfehlungen
- Häufigkeit: Wöchentlich/Monatlich
- Speicherort: Cloud (Google Drive, Dropbox)
- Best Practice: Mehrere Backup-Versionen behalten

---

## Fehlerbehebung

### Häufige Probleme

**Backup wird nicht wiederhergestellt:**
1. Prüfen Sie die JSON-Datei auf Unversehrtheit
2. Wählen Sie den richtigen Modus (Zusammenführen/Ersetzen)
3. Starten Sie die App neu

**Notizen werden nicht angezeigt:**
- Prüfen Sie Internetverbindung
- Starten Sie das Backend (python server.py)
- Pull-to-Refresh in der App
- Starten Sie MongoDB neu

**App stürzt ab:**
- Prüfen Sie Logs: supervisorctl tail expo stderr / backend stderr
- Aktualisieren Sie Abhängigkeiten: pip install -r requirements.txt / yarn install
- Starten Sie das Gerät neu

**Anruferkennung funktioniert nicht:**
- Prüfen Sie Berechtigungen: READ_PHONE_STATE, READ_CALL_LOG
- App neu starten
- Gerätekompatibilität: Android 6.0+

---

## Projektstruktur

```
/app
├── backend/
│   ├── server.py           # FastAPI Server mit allen Endpunkten
│   └── requirements.txt    # Python Dependencies
├── frontend/
│   ├── app/
│   │   ├── index.tsx                      # Hauptbildschirm (Liste)
│   │   └── note-detail/[phoneNumber].tsx  # Detail-/Notizansicht
│   ├── components/
│   │   └── CallDetectionService.tsx       # Anruferkennung
│   ├── app.json            # Expo Konfiguration
│   └── package.json        # JavaScript Dependencies
└── README.md               # Projekt-Dokumentation
└── FAQ.md                  # Häufig gestellte Fragen
```

---

## Einschränkungen

1. iOS: Automatische Anruferkennung nicht verfügbar
2. Web-Version: Call Detection funktioniert nur auf nativen Plattformen
3. Hintergrund-Erkennung: App muss geöffnet sein

---

## Datenschutz

- Kein Zugriff auf Telefonbuch
- Nur Speicherung von Telefonnummern mit Notizen
- Keine Aufzeichnung von Anrufdauer oder -inhalt
- Lokale Speicherung in MongoDB

---

## FAQ

Eine ausführliche FAQ mit 43 Fragen finden Sie in der [FAQ.md](FAQ.md)-Datei. Diese enthält:
- Allgemeine Fragen
- Installation & Einrichtung
- Nutzung & Funktionen (inkl. Notizen teilen)
- Technische Details (Datenbank, API, Anpassungen)
- Datenschutz & Sicherheit
- Fehlerbehebung

---

## Dokumentation & Ressourcen

- [Google Sites Projektseite](https://sites.google.com/blubac.org/calllivenotes/start) – Detaillierte Anleitungen und zusätzliche Informationen
- [FAQ.md](FAQ.md) – Häufig gestellte Fragen
- [API-Dokumentation](#api-dokumentation) – Endpunkte und Beispiele

---

## Lizenz

Dieses Projekt wurde als MVP erstellt und kann frei angepasst werden.