# Anrufnotizen App

Eine mobile Anwendung zum Erstellen und Verwalten von Notizen während Telefonanrufen. Optimiert für Android mit eingeschränkter Funktionalität auf iOS.

---

## Inhaltsverzeichnis
1. [Funktionen](#funktionen)
2. [Technologie-Stack](#technologie-stack)
3. [Voraussetzungen](#voraussetzungen)
4. [Installation](#installation)
5. [Verwendung](#verwendung)
6. [API-Dokumentation](#api-dokumentation)
7. [Datenbank-Schema](#datenbank-schema)
8. [Backup & Export](#backup--export)
9. [Projektstruktur](#projektstruktur)
10. [Einschränkungen](#einschränkungen)
11. [Datenschutz](#datenschutz)
12. [Lizenz](#lizenz)

---

## Funktionen

### Kernfunktionen
- **Automatische Notizerstellung**: Erkennung eingehender/ausgehender Anrufe mit sofortiger Notizfunktion (Android)
- **Zeitgestempelte Notizen**: Jede Notiz wird mit Datum und Uhrzeit gespeichert
- **Notizhistorie**: Vollständige Historie aller Notizen pro Telefonnummer
- **Echtzeit-Bearbeitung**: Notizen können jederzeit bearbeitet oder gelöscht werden

### Such- und Sortierfunktionen
- Schnelle Suche nach Telefonnummern
- Automatische Sortierung nach letztem Anruf (neueste zuerst)

### Export-Optionen
- **PDF-Export**: Formatierte PDFs pro Telefonnummer
- **CSV-Export**: Einzelne oder alle Notizen als CSV
- **Backup**: Vollständige Datensicherung als JSON

### Plattformspezifische Hinweise
- **Android**: Volle Funktionalität inkl. Anruferkennung
- **iOS**: Manuelle Notizerstellung (automatische Erkennung nicht möglich)

---

## Technologie-Stack
   Bereich       | Technologie          |
 |---------------|----------------------|
 | **Frontend**  | React Native + Expo Router |
 | **Backend**   | FastAPI (Python)     |
 | **Datenbank** | MongoDB              |
 | **Anruferkennung** | react-native-call-detection |

---

## Voraussetzungen

### Android
- **Mindestsystem**: Android 6.0 (API Level 23)
- **Benötigte Berechtigungen**:
  - `READ_PHONE_STATE` (Anrufstatus)
  - `READ_CALL_LOG` (Telefonnummernauslesung)

### iOS
- **Einschränkung**: Automatische Anruferkennung nicht verfügbar (Apple-Richtlinien)
- **Funktionsumfang**: Manuelle Notizverwaltung möglich

---

## Installation

### Backend
```bash
cd /app/backend
pip install -r requirements.txt
python server.py
