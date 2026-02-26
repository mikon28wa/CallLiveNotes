# 📱 Anrufnotizen App

Eine mobile App zum Erstellen und Verwalten von Notizen während Telefonanrufen.

## ✨ Features

- **Automatische Notizenöffnung**: Die App erkennt automatisch eingehende und ausgehende Anrufe und öffnet sofort die Notizfunktion für die entsprechende Telefonnummer
- **Text-Notizen mit Zeitstempel**: Alle Notizen werden mit Datum und Uhrzeit gespeichert
- **Notizhistorie**: Mehrere Notizen pro Telefonnummer mit vollständiger Historie
- **Suchfunktion**: Schnelles Finden von Telefonnummern
- **Zeitliche Sortierung**: Anrufe werden nach dem letzten Anruf sortiert (neueste zuerst)
- **Bearbeitung jederzeit möglich**: Alle Notizen können nachträglich bearbeitet oder gelöscht werden
- **Kein Zugriff aufs Telefonbuch nötig**: Die App speichert nur die Telefonnummern, zu denen Notizen existieren

## 🚀 Technologie

- **Frontend**: React Native mit Expo Router
- **Backend**: FastAPI (Python)
- **Datenbank**: MongoDB
- **Anruferkennung**: react-native-call-detection

## 📋 Voraussetzungen

### Android
- Android 6.0 (API Level 23) oder höher
- Berechtigungen:
  - `READ_PHONE_STATE` - Zum Erkennen von Anrufstatus
  - `READ_CALL_LOG` - Zum Auslesen der Telefonnummer des Anrufers

### iOS
**Hinweis**: iOS hat sehr eingeschränkte Call Detection APIs aus Datenschutzgründen. Die automatische Anruferkennung funktioniert auf iOS nur begrenzt. Notizen können aber manuell geöffnet und verwaltet werden.

## 🔧 Installation & Start

### Backend starten
```bash
cd /app/backend
python server.py
```

Das Backend läuft auf `http://0.0.0.0:8001`

### Frontend starten
```bash
cd /app/frontend
yarn start
```

Das Frontend läuft auf Port 3000 und ist über Expo Go erreichbar.

## 📱 App-Nutzung

### 1. Hauptbildschirm
- Zeigt alle Telefonnummern mit Notizen an
- Jeder Eintrag zeigt:
  - Telefonnummer
  - Letzte Notiz (Vorschau)
  - Zeitpunkt des letzten Anrufs
  - Anzahl der Notizen (Badge)
- Suchleiste zum Filtern nach Telefonnummer
- Pull-to-Refresh zum Aktualisieren der Liste

### 2. Detail-/Notizansicht
- Wird automatisch beim Anruf geöffnet (Android)
- Zeigt alle Notizen für eine Telefonnummer
- Jede Notiz zeigt:
  - Erstellungsdatum und -zeit
  - Notiztext
  - Bearbeitungszeitpunkt (falls bearbeitet)
- Funktionen:
  - Neue Notiz hinzufügen (Textfeld unten)
  - Notiz bearbeiten (Stift-Symbol)
  - Notiz löschen (Papierkorb-Symbol)
  - Zurück zur Hauptansicht (Pfeil oben links)

### 3. Automatische Anruferkennung (Android)
Beim ersten Start fragt die App nach folgenden Berechtigungen:
- Zugriff auf Anrufstatus
- Zugriff auf Anrufliste

Nach Erteilung der Berechtigungen:
1. Bei eingehendem oder ausgehendem Anruf öffnet sich automatisch die Notizansicht
2. Die Telefonnummer wird erkannt und angezeigt
3. Während des Anrufs können Notizen erstellt werden
4. Nach dem Anruf bleiben die Notizen gespeichert

## 🎨 Design

- **Dunkles Theme**: Modernes, augenfreundliches Design
- **Mobile-First**: Optimiert für Smartphone-Nutzung
- **Intuitive Navigation**: Einfache Bedienung mit klaren Icons
- **Responsive**: Funktioniert auf verschiedenen Bildschirmgrößen

## 🗄️ API-Endpunkte

### GET /api/notes
Gibt alle Telefonnummern mit Notizen zurück, sortiert nach letztem Anruf.

**Query Parameter:**
- `search` (optional): Filter nach Telefonnummer

**Response:**
```json
[
  {
    "phone_number": "+491234567890",
    "last_note": "Termin vereinbart",
    "last_call_time": "2025-02-26T12:20:00",
    "note_count": 3
  }
]
```

### GET /api/notes/{phone_number}
Gibt alle Notizen für eine bestimmte Telefonnummer zurück.

**Response:**
```json
{
  "phone_number": "+491234567890",
  "notes": [
    {
      "note_id": "uuid",
      "text": "Erste Notiz",
      "created_at": "2025-02-26T12:20:00",
      "updated_at": "2025-02-26T12:20:00"
    }
  ],
  "last_call_time": "2025-02-26T12:20:00"
}
```

### POST /api/notes/{phone_number}
Erstellt eine neue Notiz für eine Telefonnummer.

**Body:**
```json
{
  "text": "Meine Notiz"
}
```

### PUT /api/notes/{phone_number}/{note_id}
Aktualisiert eine bestehende Notiz.

**Body:**
```json
{
  "text": "Aktualisierter Text"
}
```

### DELETE /api/notes/{phone_number}/{note_id}
Löscht eine Notiz.

### POST /api/notes/{phone_number}/call-started
Markiert den Start eines Anrufs (aktualisiert `last_call_time`).

## 📊 Datenbank-Schema

### Collection: `call_notes`
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

## 🔐 Datenschutz

- Die App speichert **keine Kontakte** aus dem Telefonbuch
- Es werden **nur Telefonnummern gespeichert, zu denen Notizen existieren**
- Keine Aufzeichnung von Anrufdauer oder -inhalt
- Notizen werden lokal in der Datenbank gespeichert

## 🐛 Bekannte Einschränkungen

1. **iOS Limitation**: Automatische Anruferkennung ist auf iOS stark eingeschränkt aufgrund von Apple-Richtlinien
2. **Web-Version**: Call Detection funktioniert nur auf nativen Plattformen (Android/iOS), nicht im Web-Browser
3. **Hintergrund-Erkennung**: App muss installiert sein, um Anrufe zu erkennen (keine Systemintegration wie bei nativen Telefon-Apps)

## 🛠️ Entwicklung

### Projekt-Struktur
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
└── ANLEITUNG.md           # Diese Datei
```

### Neue Features hinzufügen

1. **Backend**: Endpunkte in `/app/backend/server.py` erweitern
2. **Frontend**: Komponenten in `/app/frontend/app` oder `/app/frontend/components` hinzufügen
3. **Berechtigungen**: In `/app/frontend/app.json` unter `android.permissions` oder `ios.infoPlist` eintragen

## 📞 Support

Bei Fragen oder Problemen:
1. Backend-Logs prüfen: `supervisorctl tail backend stderr`
2. Frontend-Logs prüfen: `supervisorctl tail expo stderr`
3. MongoDB-Status prüfen: `supervisorctl status`

## 📝 Lizenz

Dieses Projekt wurde als MVP erstellt und kann frei angepasst werden.
