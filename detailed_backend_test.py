#!/usr/bin/env python3

import requests
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
import sys

class DetailedAnrufnotizenTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
    def print_test_result(self, test_name: str, success: bool, details: str = ""):
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    {details}")
        print()
    
    def validate_phone_number_summary_structure(self, summary: Dict[str, Any]):
        """Validate PhoneNumberSummary model structure"""
        required_fields = ["phone_number", "last_call_time", "note_count"]
        optional_fields = ["last_note"]
        
        for field in required_fields:
            if field not in summary:
                return False, f"Missing required field: {field}"
        
        # Validate types
        if not isinstance(summary["phone_number"], str):
            return False, "phone_number should be string"
        if not isinstance(summary["note_count"], int):
            return False, "note_count should be integer"
        
        # Validate datetime format
        try:
            datetime.fromisoformat(summary["last_call_time"].replace('Z', '+00:00'))
        except:
            return False, "last_call_time should be valid ISO datetime"
        
        return True, "Structure valid"
    
    def validate_call_notes_structure(self, call_notes: Dict[str, Any]):
        """Validate CallNotes model structure"""
        required_fields = ["phone_number", "notes", "last_call_time"]
        
        for field in required_fields:
            if field not in call_notes:
                return False, f"Missing required field: {field}"
        
        if not isinstance(call_notes["notes"], list):
            return False, "notes should be a list"
        
        # Validate each note
        for i, note in enumerate(call_notes["notes"]):
            if not self.validate_note_structure(note)[0]:
                return False, f"Invalid note structure at index {i}"
        
        return True, "Structure valid"
    
    def validate_note_structure(self, note: Dict[str, Any]):
        """Validate Note model structure"""
        required_fields = ["note_id", "text", "created_at", "updated_at"]
        
        for field in required_fields:
            if field not in note:
                return False, f"Missing required field: {field}"
        
        # Validate UUID format for note_id
        try:
            import uuid
            uuid.UUID(note["note_id"])
        except:
            return False, "note_id should be valid UUID"
        
        return True, "Structure valid"
    
    def test_detailed_workflow(self):
        """Run detailed workflow test with data structure validation"""
        print("🧪 Running Detailed API Workflow Test")
        print("=" * 60)
        
        failed_validations = []
        
        # Step 1: Clear any existing data and verify empty state
        print("1️⃣ Verifying empty state")
        response = self.session.get(f"{self.base_url}/api/notes")
        if response.status_code == 200:
            data = response.json()
            if data == []:
                self.print_test_result("Empty state verification", True)
            else:
                self.print_test_result("Empty state verification", False, f"Expected empty array, got: {data}")
                failed_validations.append("Empty state")
        else:
            self.print_test_result("Empty state verification", False, f"Status: {response.status_code}")
            failed_validations.append("Empty state API call")
        
        # Step 2: Register call and create notes
        phone1 = "+491234567890"
        phone2 = "+490987654321"
        
        print("2️⃣ Registering call for first phone number")
        response = self.session.post(f"{self.base_url}/api/notes/{phone1}/call-started")
        if response.status_code == 200:
            self.print_test_result("Call registration", True)
        else:
            self.print_test_result("Call registration", False, f"Status: {response.status_code}")
            failed_validations.append("Call registration")
        
        print("3️⃣ Creating first note")
        note1_text = "Erste Notiz während des Anrufs"
        response = self.session.post(f"{self.base_url}/api/notes/{phone1}", 
                                   json={"text": note1_text})
        if response.status_code == 200:
            note1 = response.json()
            valid, msg = self.validate_note_structure(note1)
            self.print_test_result("First note creation & structure", valid, msg)
            if not valid:
                failed_validations.append("Note 1 structure")
        else:
            self.print_test_result("First note creation", False, f"Status: {response.status_code}")
            failed_validations.append("First note creation")
        
        print("4️⃣ Creating second note")
        note2_text = "Zweite Notiz - Termin vereinbart"
        response = self.session.post(f"{self.base_url}/api/notes/{phone1}", 
                                   json={"text": note2_text})
        if response.status_code == 200:
            note2 = response.json()
            valid, msg = self.validate_note_structure(note2)
            self.print_test_result("Second note creation & structure", valid, msg)
            if not valid:
                failed_validations.append("Note 2 structure")
        else:
            self.print_test_result("Second note creation", False, f"Status: {response.status_code}")
            failed_validations.append("Second note creation")
        
        # Step 5: Verify phone number summary
        print("5️⃣ Verifying phone number summary")
        response = self.session.get(f"{self.base_url}/api/notes")
        if response.status_code == 200:
            summaries = response.json()
            if len(summaries) >= 1:
                summary = summaries[0]
                valid, msg = self.validate_phone_number_summary_structure(summary)
                self.print_test_result("Phone summary structure", valid, msg)
                
                # Verify specific data
                if summary.get("phone_number") == phone1:
                    self.print_test_result("Phone number match", True)
                else:
                    self.print_test_result("Phone number match", False, 
                                         f"Expected {phone1}, got {summary.get('phone_number')}")
                    failed_validations.append("Phone number mismatch")
                
                if summary.get("note_count") == 2:
                    self.print_test_result("Note count accuracy", True)
                else:
                    self.print_test_result("Note count accuracy", False, 
                                         f"Expected 2, got {summary.get('note_count')}")
                    failed_validations.append("Note count")
                
                # Check if last_note is the most recent
                if summary.get("last_note") == note2_text:
                    self.print_test_result("Last note accuracy", True)
                else:
                    self.print_test_result("Last note accuracy", False, 
                                         f"Expected '{note2_text}', got '{summary.get('last_note')}'")
                    failed_validations.append("Last note text")
            else:
                self.print_test_result("Phone summary availability", False, "No summaries returned")
                failed_validations.append("Summary availability")
        
        # Step 6: Test individual phone number endpoint
        print("6️⃣ Testing individual phone number endpoint")
        response = self.session.get(f"{self.base_url}/api/notes/{phone1}")
        if response.status_code == 200:
            call_notes = response.json()
            valid, msg = self.validate_call_notes_structure(call_notes)
            self.print_test_result("CallNotes structure", valid, msg)
            if not valid:
                failed_validations.append("CallNotes structure")
            
            # Verify note order (should be chronological)
            notes = call_notes.get("notes", [])
            if len(notes) == 2:
                note1_time = datetime.fromisoformat(notes[0]["created_at"].replace('Z', '+00:00'))
                note2_time = datetime.fromisoformat(notes[1]["created_at"].replace('Z', '+00:00'))
                if note1_time <= note2_time:
                    self.print_test_result("Note chronological order", True)
                else:
                    self.print_test_result("Note chronological order", False, 
                                         "Notes not in chronological order")
                    failed_validations.append("Note order")
        
        # Step 7: Test second phone number
        print("7️⃣ Creating note for second phone number")
        note3_text = "Notiz für andere Nummer"
        response = self.session.post(f"{self.base_url}/api/notes/{phone2}", 
                                   json={"text": note3_text})
        if response.status_code == 200:
            self.print_test_result("Second phone note creation", True)
        else:
            self.print_test_result("Second phone note creation", False, f"Status: {response.status_code}")
            failed_validations.append("Second phone note")
        
        # Step 8: Test search functionality
        print("8️⃣ Testing search functionality")
        response = self.session.get(f"{self.base_url}/api/notes?search=0123")
        if response.status_code == 200:
            search_results = response.json()
            # Should find phone numbers containing "0123"
            found_phone1 = any(s["phone_number"] == phone1 for s in search_results)
            found_phone2 = any(s["phone_number"] == phone2 for s in search_results)
            
            if found_phone1 and found_phone2:
                self.print_test_result("Search functionality", True, "Found both phone numbers")
            else:
                self.print_test_result("Search functionality", False, 
                                     f"Phone1 found: {found_phone1}, Phone2 found: {found_phone2}")
                failed_validations.append("Search results")
        
        # Step 9: Test sorting (last_call_time descending)
        print("9️⃣ Testing sorting by last_call_time")
        response = self.session.get(f"{self.base_url}/api/notes")
        if response.status_code == 200:
            summaries = response.json()
            if len(summaries) >= 2:
                time1 = datetime.fromisoformat(summaries[0]["last_call_time"].replace('Z', '+00:00'))
                time2 = datetime.fromisoformat(summaries[1]["last_call_time"].replace('Z', '+00:00'))
                if time1 >= time2:
                    self.print_test_result("Sorting by last_call_time", True, "Descending order verified")
                else:
                    self.print_test_result("Sorting by last_call_time", False, "Not in descending order")
                    failed_validations.append("Sorting order")
        
        # Summary
        print("=" * 60)
        print("📊 DETAILED TEST SUMMARY")
        if failed_validations:
            print(f"❌ Failed validations: {len(failed_validations)}")
            for validation in failed_validations:
                print(f"  - {validation}")
            return False
        else:
            print("🎉 All detailed validations passed!")
            return True

def main():
    base_url = "https://call-sync-notes.preview.emergentagent.com"
    
    print("🔍 Anrufnotizen API Detailed Structure & Workflow Validation")
    print(f"Base URL: {base_url}")
    print()
    
    tester = DetailedAnrufnotizenTester(base_url)
    success = tester.test_detailed_workflow()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())