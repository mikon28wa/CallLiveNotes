# CallLiveNotes

Eine mobile Anwendung zum Erstellen und Verwalten von Notizen während Telefonanrufen. **Vollständig offline mit lokaler Speicherung auf dem Gerät.** Optimiert für Android mit eingeschränkter Funktionalität auf iOS.

---

## Funktionen

### Kernfunktionen
- **Vollständig offline**: Alle Daten werden lokal auf dem Gerät gespeichert (SQLite)
- **Automatische Notizerstellung**: Erkennung eingehender/ausgehender Anrufe (Android)
- **Zeitgestempelte Notizen**: Jede Notiz mit Datum und Uhrzeit
- **Notizhistorie**: Vollständige Historie pro Telefonnummer
- **Export-Optionen**: CSV, Text, JSON Backup
- **Plattformunterstützung**: Android (voll), iOS (manuell)

### Neue Funktionen

#### Rückmeldungsverwaltung
- **Schnellnotiz-Funktion**: Einfache Notizerstellung während des Anrufs mit Vorlagen
- **Rückmeldungen mit Fälligkeitsdatum**: Termine und vereinbarte Rückmeldungen verwalten
- **Priorisierung**: Hoch, Mittel, Niedrig für bessere Organisation
- **Arbeitsmodus-Anzeige**: Nicht telefonierte Rückmeldungen werden prominent angezeigt
- **Termin-Kollisionsprüfung**: Verhindert doppelte Terminvergabe
- **Sortierung & Filter**: Nach Datum, Priorität, Status, Betreff
- **Vermerke zu unbekannten Nummern**: Nutzer kann Notizen zu unbekannten Nummern hinterlegen

#### CRM-Integration
- **Unterstützte Systeme**: HubSpot, Salesforce, Zoho, Custom CRM
- **Synchronisationsoptionen**: Manuell, Automatisch (konfigurierbares Intervall)
- **Offline-Funktionalität**: Notizen werden gesammelt und später synchronisiert
- **Daten-Export/Import**: CRM-kompatible Formate

#### Spracherkennung
- **Speech-to-Text**: Spracheingabe für schnelle Notizerstellung
- **Text-to-Speech**: Vorlesen von Notizen (optional)
- **Plattform-Unterstützung**: Web (Web Speech API), Mobile (react-native-voice)

#### Compliance & Audit
- **Audit-Logging**: Automatische Protokollierung aller Änderungen
- **Datenintegritätsprüfung**: Regelmäßige Überprüfung der Datenkonsistenz
- **Compliance-Berichte**: Generierung von Berichten für regulatorische Anforderungen
- **Verschlüsselter Export**: Sichere Datenexport-Optionen
- **Unveränderliche Historie**: Vollständige Nachverfolgbarkeit aller Aktionen

### Datenschutz
✅ **WICHTIG**: 
- Es werden **ausschließlich** Nutzerdaten (Notizen, Rückmeldungen) gespeichert
- **Alle Telefonnummern stammen aus dem Telefonbuch des Nutzers**
- **KEINE Anrufpartner-Daten** werden erfasst oder an CRM-Systeme übertragen
- **Lokale Speicherung**: Alle Daten bleiben auf dem Gerät des Nutzers

---

## Technologie-Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | React Native + Expo Router |
| Datenbank | SQLite (expo-sqlite) |
| Anruferkennung | react-native-call-detection (Android) |
| Dateisystem | expo-file-system |
| Teilen | expo-sharing |

---

## Installation

```bash
git clone https://github.com/mikon28wa/CallLiveNotes.git
cd CallLiveNotes/frontend
yarn install
yarn start
```

---

## Verwendung

1. **Hauptbildschirm**: Zeigt alle Telefonnummern mit Notizen an
2. **Detailansicht**: Alle Notizen für eine Telefonnummer
3. **Manuelle Notiz**: Tippen Sie auf den + Button
4. **Export**: CSV, Text oder JSON Backup
5. **Backup**: Vollständige Datensicherung

---

## Projektstruktur

```
frontend/
├── app/
│   ├── index.tsx                      # Hauptbildschirm (Liste aller Telefonnummern)
│   ├── note-detail/
│   │   └── [phoneNumber].tsx          # Detailansicht für eine Telefonnummer
│   ├── settings.tsx                   # Einstellungen (CRM-Integration)
│   └── feedbacks.tsx                  # Rückmeldungsverwaltung
├── components/
│   ├── CallDetectionService.tsx       # Anruferkennung (nur Android)
│   ├── FloatingCallButton.tsx          # Floating Button für manuelle Notizen
│   ├── QuickNoteModal.tsx              # Schnellnotiz-Modal für Anrufe
│   └── WorkModeDisplay.tsx            # Arbeitsmodus-Anzeige für Rückmeldungen
├── utils/
│   ├── database.ts                    # SQLite-Datenbank-Implementierung
│   ├── crmService.ts                  # CRM-Integrationsservice
│   ├── feedbackService.ts             # Rückmeldungsverwaltung
│   ├── contactNotesService.ts         # Vermerke zu Telefonnummern
│   ├── speechService.ts               # Spracherkennung (Speech-to-Text)
│   └── complianceService.ts           # Compliance & Audit-Logging
├── assets/                            # App-Icons und Bilder
├── app.json                           # Expo Konfiguration
└── package.json                       # JavaScript Abhängigkeiten
```

---

## Berechtigungen

### Android
Die App benötigt folgende Berechtigungen:
- `READ_PHONE_STATE` - Zum Erkennen von Anrufen
- `READ_CALL_LOG` - Zum Lesen des Anrufverlaufs
- `PROCESS_OUTGOING_CALLS` - Zum Erkennen ausgehender Anrufe

### iOS
Auf iOS ist die automatische Anruferkennung aufgrund von Apple-Einschränkungen nicht möglich. Nutzen Sie bitte die manuelle Notizerstellung über den + Button.

---

## Datenbank-Schema

### Tabellen

#### call_notes
- `id` (INTEGER PRIMARY KEY) - Eindeutige ID
- `phone_number` (TEXT UNIQUE) - Telefonnummer (aus Nutzer-Telefonbuch)
- `last_call_time` (TEXT) - Zeitstempel des letzten Anrufs
- `created_at` (TEXT) - Erstellungsdatum

#### notes
- `id` (INTEGER PRIMARY KEY) - Eindeutige ID
- `call_note_id` (INTEGER) - Fremdschlüssel zu call_notes
- `note_id` (TEXT UNIQUE) - Eindeutige Notiz-ID
- `text` (TEXT) - Notiztext
- `created_at` (TEXT) - Erstellungsdatum
- `updated_at` (TEXT) - Letztes Update
- `synced_with_crm` (INTEGER DEFAULT 0) - Synchronisationsstatus mit CRM
- `synced_at` (TEXT) - Zeitstempel der letzten Synchronisation

#### feedbacks
- `id` (INTEGER PRIMARY KEY) - Eindeutige ID
- `feedback_id` (TEXT UNIQUE) - Eindeutige Feedback-ID
- `phone_number` (TEXT NOT NULL) - Telefonnummer (aus Nutzer-Telefonbuch)
- `title` (TEXT NOT NULL) - Betreff
- `description` (TEXT NOT NULL) - Beschreibung
- `reason` (TEXT NOT NULL) - Grund
- `due_date` (TEXT) - Fälligkeitsdatum (ISO)
- `due_time` (TEXT) - Fälligkeitszeit (HH:mm)
- `status` (TEXT) - Status: pending, completed, cancelled, overdue
- `priority` (TEXT) - Priorität: low, medium, high
- `created_at` (TEXT) - Erstellungsdatum
- `updated_at` (TEXT) - Letztes Update
- `completed_at` (TEXT) - Zeitstempel der Erledigung
- `call_note_id` (INTEGER) - Fremdschlüssel zu call_notes
- `synced_with_crm` (INTEGER DEFAULT 0) - Synchronisationsstatus
- `synced_at` (TEXT) - Zeitstempel der letzten Synchronisation

#### contact_notes
- `id` (INTEGER PRIMARY KEY) - Eindeutige ID
- `phone_number` (TEXT NOT NULL) - Telefonnummer
- `note` (TEXT NOT NULL) - Vermerk zur Nummer
- `is_known` (INTEGER DEFAULT 0) - Ob die Nummer im Telefonbuch ist
- `contact_name` (TEXT) - Name aus Telefonbuch (falls bekannt)
- `created_at` (TEXT) - Erstellungsdatum
- `updated_at` (TEXT) - Letztes Update

#### audit_logs
- `id` (INTEGER PRIMARY KEY) - Eindeutige ID
- `action` (TEXT) - Aktion: CREATE, UPDATE, DELETE, COMPLETE, SYNC
- `entity_type` (TEXT) - Entitätstyp: note, feedback, contact_note, call_note
- `entity_id` (TEXT) - Entitäts-ID
- `phone_number` (TEXT) - Telefonnummer
- `details` (TEXT) - Details zur Aktion
- `user_id` (TEXT) - Nutzer-ID (für Multi-User)
- `timestamp` (TEXT) - Zeitstempel
- `ip_address` (TEXT) - IP-Adresse (für Web)
- `device_info` (TEXT) - Geräteinformationen

---

## Backup und Wiederherstellung

### Backup erstellen
1. Tippen Sie auf "Backup" im Hauptbildschirm
2. Wählen Sie einen Speicherort
3. Die Backup-Datei wird als JSON gespeichert

### Backup wiederherstellen
1. Tippen Sie auf "Backup wiederherstellen" im Hauptbildschirm
2. Wählen Sie die Backup-Datei aus
3. Wählen Sie zwischen "Zusammenführen" (fügt neue Notizen hinzu) oder "Ersetzen" (löscht alle aktuellen Daten)

---

## Validierung

### Telefonnummern
Telefonnummern werden mit folgendem Regex validiert:
- International: `^\+\d{8,15}$`
- National (Deutschland): `^\d{10,15}$`

---

## Hinweise für Entwickler

1. **Berechtigungen**: Auf Android sind `READ_PHONE_STATE` und `READ_CALL_LOG` erforderlich
2. **iOS-Einschränkungen**: Automatische Anruferkennung ist auf iOS nicht möglich
3. **Datenbank**: SQLite ist für mobile Geräte optimiert und erfordert keine Konfiguration
4. **Backup**: JSON-Format für einfache Migration und Wiederherstellung
5. **Validierung**: Telefonnummern werden mit Regex validiert

---

## Migration von der alten Version

Falls Sie die alte Version mit MongoDB-Backend verwendet haben:
1. Exportieren Sie Ihre Daten aus der alten Version
2. Installieren Sie die neue Offline-Version
3. Importieren Sie die Daten über die Backup-Funktion

---

## CRM-Integration

### Unterstützte CRM-Systeme
- **HubSpot** - Vollständige Integration mit API
- **Salesforce** - Vollständige Integration mit API
- **Zoho CRM** - Vollständige Integration mit API
- **Custom CRM** - Benutzerdefinierte API-Endpunkte

### Konfiguration
1. Navigieren Sie zu **Einstellungen** > **CRM-Integration**
2. Wählen Sie Ihr CRM-System aus
3. Geben Sie die API-Zugangsdaten ein
4. Aktivieren Sie die Synchronisation
5. Optional: Aktivieren Sie die automatische Synchronisation

### Synchronisationsoptionen
- **Manuell**: Synchronisation auf Knopfdruck
- **Automatisch**: Regelmäßige Synchronisation (konfigurierbares Intervall)
- **Offline**: Notizen werden lokal gespeichert und später synchronisiert

### Datenschutz
- **Keine Anrufpartner-Daten**: Es werden **ausschließlich** Ihre eigenen Notizen synchronisiert
- **Lokale Speicherung**: Alle Daten bleiben auf Ihrem Gerät
- **Sichere Übertragung**: Daten werden verschlüsselt übertragen (in echter Implementierung)

## Vergleich: Alte vs. Neue Version

| Komponente | Alte Version | Neue Version |
|------------|-------------|---------------|
| **Datenbank** | MongoDB (Server) | SQLite (lokal) |
| **Backend** | FastAPI (Python) | Nicht benötigt |
| **Frontend** | React Native + API-Aufrufe | React Native + direkte DB-Zugriffe |
| **Speicherort** | Server | Lokales Gerät |
| **Offline-Fähigkeit** | Nein | Ja |
| **Anruferkennung** | Serverabhängig | Direkt auf dem Gerät |
| **CRM-Integration** | Nicht verfügbar | Vollständig integriert |
| **Schnellnotizen** | Nicht verfügbar | Mit Vorlagen |
| **Installation** | Komplex (Server + Client) | Einfach (nur App) |

---

## Lizenz

Dieses Projekt ist für den persönlichen Gebrauch bestimmt.

---

**Viel Spaß mit CallLiveNotes!** 📞📝
