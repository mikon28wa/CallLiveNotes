# CallLiveNotes 📞📝

**Eine mobile App zum Erstellen und Verwalten von Notizen während Telefonanrufen – vollständig offline mit lokaler Speicherung.**

---
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Android/iOS](https://img.shields.io/badge/Platform-Android%2FiOS-blue)]
[![Status: Aktiv](https://img.shields.io/badge/Status-Aktiv-green)

---

## ✨ **Funktionen**

| Feature | Android | iOS |
|---------|---------|-----|
| **Automatische Anruferkennung** | ✅ | ❌ (manuell) |
| **Zeitgestempelte Notizen** | ✅ | ✅ |
| **Notizhistorie pro Telefonnummer** | ✅ | ✅ |
| **Suche nach Telefonnummern** | ✅ | ✅ |
| **Export (PDF/CSV/JSON)** | ✅ | ✅ |
| **Backup & Wiederherstellung** | ✅ | ✅ |
| **Dunkles Theme** | ✅ | ✅ |
| **Offline-Nutzung** | ✅ | ✅ |

---

## 🚀 **Schnellstart**

### **Voraussetzungen**
- **Android 6.0+** (für automatische Anruferkennung)
- **iOS** (manuelle Notizerstellung)
- **Node.js 18+** (für Frontend)
- **Python 3.10+** (für Backend)
- **MongoDB 5.0+** (für Backend-Datenbank)

---

### **Installation**

#### **1. Backend (FastAPI)**
```bash
cd backend
pip install -r requirements.txt
python server.py
```
→ Backend läuft auf `http://0.0.0.0:8001`

#### **2. Frontend (React Native + Expo)**
```bash
cd frontend
yarn install
yarn start
```
→ Frontend läuft auf Port `3000` (Expo Go)

---

## 📱 **Nutzung**

### **Hauptbildschirm**
- Liste aller Telefonnummern mit Notizen
- Suchfunktion zum Filtern
- Pull-to-Refresh

### **Detailansicht**
- Alle Notizen für eine Telefonnummer
- **Neue Notiz**: Textfeld unten
- **Bearbeiten**: Stift-Symbol
- **Löschen**: Papierkorb-Symbol
- **Export**: Teilen-Symbol (PDF/CSV)

### **Backup & Wiederherstellung**
1. **Backup erstellen**:
   - Hauptmenü → "Backup erstellen" → JSON-Datei speichern
2. **Backup wiederherstellen**:
   - Hauptmenü → "Backup wiederherstellen" → JSON-Datei auswählen
   - Modus wählen: **Zusammenführen** (hinzufügen) oder **Ersetzen** (alle Daten löschen)

---

## 🛠 **Projektstruktur**

```
/CallLiveNotes
├── backend/
│   ├── server.py           # FastAPI-Backend
│   └── requirements.txt    # Python-Abhängigkeiten
├── frontend/
│   ├── app/
│   │   ├── index.tsx       # Hauptbildschirm
│   │   └── note-detail/    # Detailansicht
│   ├── components/         # React-Komponenten
│   └── app.json            # Expo-Konfiguration
├── ANLEITUNG.md            # Detaillierte Anleitung
├── FAQ.md                  # Häufige Fragen
└── README.md               # Diese Datei
```

---

## 🔐 **Berechtigungen (Android)**
Die App benötigt:
- `READ_PHONE_STATE` – Anrufstatus erkennen
- `READ_CALL_LOG` – Telefonnummer auslesen
- **Kein Zugriff auf Kontakte oder Telefonbuch!**

> ⚠️ **iOS-Einschränkung**: Automatische Anruferkennung ist aufgrund von Apple-Richtlinien **nicht möglich**. Nutze die manuelle Notizerstellung.

---

## 📊 **API-Endpunkte (Backend)**

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| `GET` | `/api/notes` | Liste aller Telefonnummern mit Notizen |
| `GET` | `/api/notes/{phone_number}` | Alle Notizen für eine Telefonnummer |
| `POST` | `/api/notes/{phone_number}` | Neue Notiz erstellen |
| `PUT` | `/api/notes/{phone_number}/{note_id}` | Notiz aktualisieren |
| `DELETE` | `/api/notes/{phone_number}/{note_id}` | Notiz löschen |
| `GET` | `/api/backup` | Backup aller Daten (JSON) |
| `POST` | `/api/restore` | Backup wiederherstellen |

---
**Beispiel (Notiz erstellen):**
```bash
curl -X POST http://localhost:8001/api/notes/+49123456789 \
  -H "Content-Type: application/json" \
  -d '{"text": "Termin vereinbart für 15.06.2026"}'
```

---

## 🗄 **Datenbank-Schema (MongoDB)**
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

---

## 🔧 **Anpassungen & Entwicklung**
- **Backend erweitern**: Neue Endpunkte in `backend/server.py`
- **Frontend anpassen**: Komponenten in `frontend/app/` oder `frontend/components/`
- **Berechtigungen**: In `frontend/app.json` unter `android.permissions` eintragen

---

## 📄 **Dokumentation**
- [Detaillierte Anleitung](ANLEITUNG.md)
- [Häufige Fragen (FAQ)](FAQ.md)
- [API-Dokumentation](#api-endpunkte-backend)

---

## 🤝 **Mitwirken**
1. **Fork** das Repository
2. **Branch** erstellen (`git checkout -b feature/neue-funktion`)
3. **Commit** (`git commit -m "Füge neue Funktion hinzu"`)
4. **Push** (`git push origin feature/neue-funktion`)
5. **Pull Request** öffnen

---

## 📜 **Lizenz**
Dieses Projekt ist **kostenlos für den persönlichen Gebrauch**. 
Für kommerzielle Nutzung bitte [Kontakt aufnehmen](https://blubac.org).

---
**💡 Tipp:** Nutze die **Backup-Funktion regelmäßig**, um deine Notizen zu sichern!

---
**🐛 Probleme melden oder Feedback geben?**
[Issues öffnen](https://github.com/mikon28wa/CallLiveNotes/issues) oder direkt per E-Mail an **mikon28wa@blubac.org**.

---
**Viel Spaß mit CallLiveNotes!** 🎉