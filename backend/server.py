from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class Note(BaseModel):
    note_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CallNotes(BaseModel):
    phone_number: str
    notes: List[Note] = []
    last_call_time: datetime = Field(default_factory=datetime.utcnow)

class NoteCreate(BaseModel):
    text: str

class NoteUpdate(BaseModel):
    text: str

class PhoneNumberSummary(BaseModel):
    phone_number: str
    last_note: Optional[str] = None
    last_call_time: datetime
    note_count: int


# Routes
@api_router.get("/")
async def root():
    return {"message": "Anrufnotizen API"}


@api_router.get("/notes", response_model=List[PhoneNumberSummary])
async def get_all_phone_numbers(search: Optional[str] = None):
    """
    Gibt alle Telefonnummern mit Notizen zurück, sortiert nach letztem Anruf.
    Optionaler Suchparameter für Telefonnummer.
    """
    query = {}
    if search:
        query["phone_number"] = {"$regex": search, "$options": "i"}
    
    # Optimiert: Nur benötigte Felder abrufen
    cursor = db.call_notes.find(
        query,
        {"phone_number": 1, "notes": 1, "last_call_time": 1}
    ).sort("last_call_time", -1).limit(1000)
    call_notes_list = await cursor.to_list(1000)
    
    summaries = []
    for call_note in call_notes_list:
        notes = call_note.get("notes", [])
        last_note_text = notes[-1]["text"] if notes else None
        
        summaries.append(PhoneNumberSummary(
            phone_number=call_note["phone_number"],
            last_note=last_note_text,
            last_call_time=call_note["last_call_time"],
            note_count=len(notes)
        ))
    
    return summaries


@api_router.get("/notes/{phone_number}", response_model=CallNotes)
async def get_notes_for_number(phone_number: str):
    """
    Gibt alle Notizen für eine bestimmte Telefonnummer zurück.
    """
    call_notes = await db.call_notes.find_one({"phone_number": phone_number})
    
    if not call_notes:
        # Wenn keine Notizen existieren, erstelle einen neuen Eintrag
        new_call_notes = CallNotes(phone_number=phone_number)
        await db.call_notes.insert_one(new_call_notes.dict())
        return new_call_notes
    
    return CallNotes(**call_notes)


@api_router.post("/notes/{phone_number}", response_model=Note)
async def create_note(phone_number: str, note_input: NoteCreate):
    """
    Erstellt eine neue Notiz für eine Telefonnummer.
    """
    new_note = Note(text=note_input.text)
    
    # Prüfen, ob bereits Notizen für diese Nummer existieren
    call_notes = await db.call_notes.find_one({"phone_number": phone_number})
    
    if call_notes:
        # Notiz hinzufügen und last_call_time aktualisieren
        await db.call_notes.update_one(
            {"phone_number": phone_number},
            {
                "$push": {"notes": new_note.dict()},
                "$set": {"last_call_time": datetime.utcnow()}
            }
        )
    else:
        # Neuen Eintrag erstellen
        new_call_notes = CallNotes(
            phone_number=phone_number,
            notes=[new_note]
        )
        await db.call_notes.insert_one(new_call_notes.dict())
    
    return new_note


@api_router.put("/notes/{phone_number}/{note_id}", response_model=Note)
async def update_note(phone_number: str, note_id: str, note_update: NoteUpdate):
    """
    Aktualisiert eine bestehende Notiz.
    """
    call_notes = await db.call_notes.find_one({"phone_number": phone_number})
    
    if not call_notes:
        raise HTTPException(status_code=404, detail="Telefonnummer nicht gefunden")
    
    # Notiz in der Liste finden und aktualisieren
    notes = call_notes.get("notes", [])
    updated = False
    
    for i, note in enumerate(notes):
        if note["note_id"] == note_id:
            notes[i]["text"] = note_update.text
            notes[i]["updated_at"] = datetime.utcnow()
            updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=404, detail="Notiz nicht gefunden")
    
    # Aktualisierte Notizen speichern
    await db.call_notes.update_one(
        {"phone_number": phone_number},
        {"$set": {"notes": notes}}
    )
    
    # Aktualisierte Notiz zurückgeben
    for note in notes:
        if note["note_id"] == note_id:
            return Note(**note)


@api_router.delete("/notes/{phone_number}/{note_id}")
async def delete_note(phone_number: str, note_id: str):
    """
    Löscht eine Notiz.
    """
    result = await db.call_notes.update_one(
        {"phone_number": phone_number},
        {"$pull": {"notes": {"note_id": note_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notiz nicht gefunden")
    
    return {"message": "Notiz gelöscht"}


@api_router.post("/notes/{phone_number}/call-started")
async def mark_call_started(phone_number: str):
    """
    Aktualisiert die last_call_time wenn ein Anruf beginnt.
    """
    call_notes = await db.call_notes.find_one({"phone_number": phone_number})
    
    if call_notes:
        await db.call_notes.update_one(
            {"phone_number": phone_number},
            {"$set": {"last_call_time": datetime.utcnow()}}
        )
    else:
        # Neuen Eintrag erstellen wenn noch keine Notizen existieren
        new_call_notes = CallNotes(phone_number=phone_number)
        await db.call_notes.insert_one(new_call_notes.dict())
    
    return {"message": "Anruf registriert"}


@api_router.get("/backup")
async def create_backup():
    """
    Erstellt ein vollständiges Backup aller Anrufnotizen.
    """
    cursor = db.call_notes.find({})
    all_notes = await cursor.to_list(10000)
    
    # Konvertiere ObjectId zu String für JSON-Serialisierung
    for note in all_notes:
        if "_id" in note:
            note["_id"] = str(note["_id"])
    
    backup_data = {
        "backup_date": datetime.utcnow().isoformat(),
        "version": "1.0",
        "total_entries": len(all_notes),
        "data": all_notes
    }
    
    return backup_data


@api_router.post("/restore")
async def restore_backup(backup_data: dict):
    """
    Stellt ein Backup wieder her.
    Optionen: merge (Standard) oder replace
    """
    try:
        data = backup_data.get("data", [])
        mode = backup_data.get("mode", "merge")  # merge oder replace
        
        if mode == "replace":
            # Alle existierenden Daten löschen
            await db.call_notes.delete_many({})
        
        restored_count = 0
        skipped_count = 0
        
        for item in data:
            phone_number = item.get("phone_number")
            if not phone_number:
                continue
            
            # Entferne _id aus dem Import-Datensatz
            if "_id" in item:
                del item["_id"]
            
            if mode == "merge":
                # Prüfen, ob Telefonnummer bereits existiert
                existing = await db.call_notes.find_one({"phone_number": phone_number})
                
                if existing:
                    # Merge: Nur neue Notizen hinzufügen
                    existing_note_ids = {note["note_id"] for note in existing.get("notes", [])}
                    new_notes = [note for note in item.get("notes", []) 
                                if note["note_id"] not in existing_note_ids]
                    
                    if new_notes:
                        await db.call_notes.update_one(
                            {"phone_number": phone_number},
                            {
                                "$push": {"notes": {"$each": new_notes}},
                                "$set": {"last_call_time": item.get("last_call_time", datetime.utcnow())}
                            }
                        )
                        restored_count += len(new_notes)
                    else:
                        skipped_count += 1
                else:
                    # Neue Telefonnummer hinzufügen
                    await db.call_notes.insert_one(item)
                    restored_count += len(item.get("notes", []))
            else:
                # Replace: Einfach alle Daten einfügen
                await db.call_notes.insert_one(item)
                restored_count += len(item.get("notes", []))
        
        return {
            "message": "Backup wiederhergestellt",
            "mode": mode,
            "restored_notes": restored_count,
            "skipped_entries": skipped_count
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fehler beim Wiederherstellen: {str(e)}")


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
