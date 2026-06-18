# CallLiveNotes 📞📝

**Eine mobile App zum Erstellen und Verwalten von Notizen während Telefonanrufen – vollständig offline mit lokaler Speicherung.**

---
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Android/iOS](https://img.shields.io/badge/Platform-Android%2FiOS-blue)]
[![Status: Aktiv](https://img.shields.io/badge/Status-Aktiv-green)]

---

## ✨ **Funktionen**

- Vollständig offlinefähige App: Alle Daten werden lokal in einer SQLite-Datenbank gespeichert.
- Persistente Offline‑Warteschlange für CRM‑Notizen (lokal, optionaler Remote‑Sync deaktiviert).
- Schnellnotizen während Anrufen, Notizhistorie pro Telefonnummer, Export/Import (JSON/CSV).
- Backup & Wiederherstellung, Dark Mode, einfache Navigation.

---

## 🚀 **Schnellstart**

### **Voraussetzungen**
- Android 6.0+ (für automatische Anruferkennung; zusätzliche Berechtigungen nötig)
- iOS 13+ (manuelle Notizerstellung/Limitierungen wegen Plattform)
- Node.js 18+ (für Frontend-Entwicklung)

---

### **Installation**

#### **Frontend (React Native + Expo)**
```bash
cd frontend
yarn install
yarn start
```
→ Frontend läuft mit Expo

---

## 📱 **Nutzung**

siehe original README — App ist offline-first; für CRM-Integration wird standardmäßig keine Remote‑API verwendet. Export/Import und persistente Queue erlauben manuelle Übertragung in andere Systeme.

---

## 🔧 **Projektstruktur**

```
/CallLiveNotes
├── frontend/
│   ├── app/
│   ├── components/
│   └── utils/
├── backend/ (veraltet - nicht benötigt für Offline-Mode)
└── README.md
```

---

## 🔐 **Berechtigungen (Android)**
Die App benötigt:
- `READ_PHONE_STATE` – Anrufstatus erkennen
- `READ_CALL_LOG` – Telefonnummer auslesen (falls benötigt)

> ⚠️ iOS-Einschränkung: Automatische Anruferkennung ist aufgrund von Apple-Richtlinien eingeschränkt. Nutze die manuelle Notizerstellung.

---

## 🤝 **Mitwirken**
1. Fork das Repository
2. Branch erstellen (`git checkout -b feature/neue-funktion`)
3. Commit (`git commit -m "Füge neue Funktion hinzu"`)
4. Push (`git push origin feature/neue-funktion`)
5. Pull Request öffnen

---

## 📜 **Lizenz**
Dieses Projekt ist unter der MIT-Lizenz.
