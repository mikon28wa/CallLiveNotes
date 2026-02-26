#!/usr/bin/env python3

import requests
import json
from typing import List, Optional, Dict, Any
import sys

class AnrufnotizenAPITester:
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
    
    def print_response_details(self, response: requests.Response):
        print(f"    Status: {response.status_code}")
        try:
            print(f"    Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        except:
            print(f"    Response: {response.text}")
        
    def test_get_all_notes_empty(self):
        """Test GET /notes - should return empty array initially"""
        print("🔍 Testing GET /notes (empty state)")
        try:
            response = self.session.get(f"{self.base_url}/api/notes")
            success = response.status_code == 200 and response.json() == []
            self.print_test_result("GET /notes (empty)", success)
            if not success:
                self.print_response_details(response)
            return success, response.json() if response.status_code == 200 else None
        except Exception as e:
            self.print_test_result("GET /notes (empty)", False, f"Exception: {e}")
            return False, None
    
    def test_register_call(self, phone_number: str):
        """Test POST /notes/{phone_number}/call-started"""
        print(f"📞 Testing call registration for {phone_number}")
        try:
            response = self.session.post(f"{self.base_url}/api/notes/{phone_number}/call-started")
            success = response.status_code == 200
            self.print_test_result(f"POST /notes/{phone_number}/call-started", success)
            if not success:
                self.print_response_details(response)
            return success, response.json() if success else None
        except Exception as e:
            self.print_test_result(f"POST /notes/{phone_number}/call-started", False, f"Exception: {e}")
            return False, None
    
    def test_create_note(self, phone_number: str, note_text: str):
        """Test POST /notes/{phone_number} with note creation"""
        print(f"📝 Creating note for {phone_number}: {note_text}")
        try:
            data = {"text": note_text}
            response = self.session.post(f"{self.base_url}/api/notes/{phone_number}", 
                                       json=data)
            success = response.status_code == 200
            self.print_test_result(f"POST /notes/{phone_number} (create note)", success)
            if not success:
                self.print_response_details(response)
            return success, response.json() if success else None
        except Exception as e:
            self.print_test_result(f"POST /notes/{phone_number} (create note)", False, f"Exception: {e}")
            return False, None
    
    def test_get_all_notes(self):
        """Test GET /notes after notes are created"""
        print("🔍 Testing GET /notes (with data)")
        try:
            response = self.session.get(f"{self.base_url}/api/notes")
            success = response.status_code == 200
            self.print_test_result("GET /notes (with data)", success)
            if not success:
                self.print_response_details(response)
            return success, response.json() if success else None
        except Exception as e:
            self.print_test_result("GET /notes (with data)", False, f"Exception: {e}")
            return False, None
    
    def test_get_notes_for_number(self, phone_number: str):
        """Test GET /notes/{phone_number}"""
        print(f"🔍 Testing GET /notes/{phone_number}")
        try:
            response = self.session.get(f"{self.base_url}/api/notes/{phone_number}")
            success = response.status_code == 200
            self.print_test_result(f"GET /notes/{phone_number}", success)
            if not success:
                self.print_response_details(response)
            return success, response.json() if success else None
        except Exception as e:
            self.print_test_result(f"GET /notes/{phone_number}", False, f"Exception: {e}")
            return False, None
    
    def test_search_notes(self, search_term: str):
        """Test GET /notes with search parameter"""
        print(f"🔍 Testing search with term: {search_term}")
        try:
            response = self.session.get(f"{self.base_url}/api/notes?search={search_term}")
            success = response.status_code == 200
            self.print_test_result(f"GET /notes?search={search_term}", success)
            if not success:
                self.print_response_details(response)
            return success, response.json() if success else None
        except Exception as e:
            self.print_test_result(f"GET /notes?search={search_term}", False, f"Exception: {e}")
            return False, None
    
    def test_update_note(self, phone_number: str, note_id: str, new_text: str):
        """Test PUT /notes/{phone_number}/{note_id}"""
        print(f"✏️ Testing note update for {phone_number}, note_id: {note_id}")
        try:
            data = {"text": new_text}
            response = self.session.put(f"{self.base_url}/api/notes/{phone_number}/{note_id}", 
                                      json=data)
            success = response.status_code == 200
            self.print_test_result(f"PUT /notes/{phone_number}/{note_id}", success)
            if not success:
                self.print_response_details(response)
            return success, response.json() if success else None
        except Exception as e:
            self.print_test_result(f"PUT /notes/{phone_number}/{note_id}", False, f"Exception: {e}")
            return False, None
    
    def test_delete_note(self, phone_number: str, note_id: str):
        """Test DELETE /notes/{phone_number}/{note_id}"""
        print(f"🗑️ Testing note deletion for {phone_number}, note_id: {note_id}")
        try:
            response = self.session.delete(f"{self.base_url}/api/notes/{phone_number}/{note_id}")
            success = response.status_code == 200
            self.print_test_result(f"DELETE /notes/{phone_number}/{note_id}", success)
            if not success:
                self.print_response_details(response)
            return success, response.json() if success else None
        except Exception as e:
            self.print_test_result(f"DELETE /notes/{phone_number}/{note_id}", False, f"Exception: {e}")
            return False, None
    
    def test_create_backup(self):
        """Test GET /backup - should return complete backup with all data"""
        print("💾 Testing GET /backup")
        try:
            response = self.session.get(f"{self.base_url}/api/backup")
            success = response.status_code == 200
            data = response.json() if success else {}
            
            # Validate backup structure
            if success:
                required_fields = ["backup_date", "version", "total_entries", "data"]
                has_all_fields = all(field in data for field in required_fields)
                is_list = isinstance(data.get("data"), list)
                success = success and has_all_fields and is_list
                
                if success:
                    # Check if _id is converted to string
                    for item in data.get("data", []):
                        if "_id" in item and not isinstance(item["_id"], str):
                            success = False
                            break
            
            self.print_test_result("GET /backup", success)
            if not success:
                self.print_response_details(response)
            return success, data
        except Exception as e:
            self.print_test_result("GET /backup", False, f"Exception: {e}")
            return False, None
    
    def test_restore_merge(self, backup_data: dict):
        """Test POST /restore with mode=merge"""
        print("🔄 Testing POST /restore (merge mode)")
        try:
            # Prepare restore payload with merge mode
            restore_payload = {
                "data": backup_data.get("data", []),
                "mode": "merge"
            }
            
            response = self.session.post(f"{self.base_url}/api/restore", json=restore_payload)
            success = response.status_code == 200
            self.print_test_result("POST /restore (merge)", success)
            if not success:
                self.print_response_details(response)
            return success, response.json() if success else None
        except Exception as e:
            self.print_test_result("POST /restore (merge)", False, f"Exception: {e}")
            return False, None
    
    def test_restore_replace(self, backup_data: dict):
        """Test POST /restore with mode=replace"""
        print("🔄 Testing POST /restore (replace mode)")
        try:
            # Prepare restore payload with replace mode
            restore_payload = {
                "data": backup_data.get("data", []),
                "mode": "replace"
            }
            
            response = self.session.post(f"{self.base_url}/api/restore", json=restore_payload)
            success = response.status_code == 200
            self.print_test_result("POST /restore (replace)", success)
            if not success:
                self.print_response_details(response)
            return success, response.json() if success else None
        except Exception as e:
            self.print_test_result("POST /restore (replace)", False, f"Exception: {e}")
            return False, None
    
    def test_restore_error_handling(self):
        """Test POST /restore error handling"""
        print("⚠️ Testing POST /restore error handling")
        
        # Test 1: Invalid JSON format
        try:
            response = self.session.post(f"{self.base_url}/api/restore", json={})
            success = response.status_code == 400
            self.print_test_result("POST /restore (missing data field)", success)
            if not success:
                self.print_response_details(response)
        except Exception as e:
            self.print_test_result("POST /restore (missing data field)", False, f"Exception: {e}")
            success = False
        
        # Test 2: Invalid data structure
        try:
            invalid_payload = {"data": "invalid_data_type", "mode": "merge"}
            response = self.session.post(f"{self.base_url}/api/restore", json=invalid_payload)
            success2 = response.status_code == 400
            self.print_test_result("POST /restore (invalid data format)", success2)
            if not success2:
                self.print_response_details(response)
        except Exception as e:
            self.print_test_result("POST /restore (invalid data format)", False, f"Exception: {e}")
            success2 = False
        
        return success and success2

def main():
    # Use the backend URL from the environment
    base_url = "https://call-sync-notes.preview.emergentagent.com"
    
    print("🚀 Starting Anrufnotizen API Tests")
    print(f"Base URL: {base_url}")
    print("=" * 60)
    
    tester = AnrufnotizenAPITester(base_url)
    
    failed_tests = []
    total_tests = 0
    
    # Test 1: GET /notes (empty state)
    total_tests += 1
    success, _ = tester.test_get_all_notes_empty()
    if not success:
        failed_tests.append("GET /notes (empty)")
    
    # Test 2: Register call for first phone number
    phone1 = "+491234567890"
    total_tests += 1
    success, _ = tester.test_register_call(phone1)
    if not success:
        failed_tests.append(f"POST /notes/{phone1}/call-started")
    
    # Test 3: Create first note
    total_tests += 1
    success, note1 = tester.test_create_note(phone1, "Erste Notiz während des Anrufs")
    if not success:
        failed_tests.append(f"POST /notes/{phone1} (first note)")
    
    # Test 4: Create second note
    total_tests += 1
    success, note2 = tester.test_create_note(phone1, "Zweite Notiz - Termin vereinbart")
    if not success:
        failed_tests.append(f"POST /notes/{phone1} (second note)")
    
    # Test 5: GET /notes (should show phone number with 2 notes)
    total_tests += 1
    success, all_notes = tester.test_get_all_notes()
    if not success:
        failed_tests.append("GET /notes (with data)")
    elif all_notes:
        # Verify the structure
        if len(all_notes) >= 1:
            phone_summary = all_notes[0]
            if phone_summary.get("phone_number") == phone1 and phone_summary.get("note_count") == 2:
                print("✅ Verified: Phone number summary shows 2 notes correctly")
            else:
                print(f"❌ Phone summary structure incorrect: {phone_summary}")
                failed_tests.append("Phone summary verification")
        else:
            print("❌ No phone numbers returned")
            failed_tests.append("Phone summary count")
    
    # Test 6: GET notes for specific phone number
    total_tests += 1
    success, phone_notes = tester.test_get_notes_for_number(phone1)
    if not success:
        failed_tests.append(f"GET /notes/{phone1}")
    
    # Test 7: Create note for second phone number
    phone2 = "+490987654321"
    total_tests += 1
    success, note3 = tester.test_create_note(phone2, "Notiz für andere Nummer")
    if not success:
        failed_tests.append(f"POST /notes/{phone2}")
    
    # Test 8: Search notes
    total_tests += 1
    success, search_results = tester.test_search_notes("0123")
    if not success:
        failed_tests.append("GET /notes?search=0123")
    
    # Test 9: Update note (need note_id from previous calls)
    if phone_notes and "notes" in phone_notes and len(phone_notes["notes"]) > 0:
        note_id = phone_notes["notes"][0]["note_id"]
        total_tests += 1
        success, updated_note = tester.test_update_note(phone1, note_id, "Aktualisierte Notiz")
        if not success:
            failed_tests.append(f"PUT /notes/{phone1}/{note_id}")
    else:
        print("⚠️ Skipping note update test - no notes found to update")
    
    # Test 10: Delete note
    if phone_notes and "notes" in phone_notes and len(phone_notes["notes"]) > 1:
        note_id = phone_notes["notes"][1]["note_id"]
        total_tests += 1
        success, delete_result = tester.test_delete_note(phone1, note_id)
        if not success:
            failed_tests.append(f"DELETE /notes/{phone1}/{note_id}")
    else:
        print("⚠️ Skipping note deletion test - insufficient notes found")
    
    # NEW BACKUP & RESTORE TESTS
    print("\n" + "=" * 60)
    print("🔄 STARTING BACKUP & RESTORE TESTS")
    print("=" * 60)
    
    # Test 11: Create backup
    total_tests += 1
    success, backup_data = tester.test_create_backup()
    if not success:
        failed_tests.append("GET /backup")
    
    # Test 12: Add new phone number for merge testing
    test_phone = "+1234567890"
    total_tests += 1
    success, _ = tester.test_create_note(test_phone, "Test note before restore")
    if not success:
        failed_tests.append(f"POST /notes/{test_phone} (pre-restore)")
    
    # Test 13: Restore with merge mode (should preserve existing data)
    if backup_data:
        total_tests += 1
        success, _ = tester.test_restore_merge(backup_data)
        if not success:
            failed_tests.append("POST /restore (merge)")
        
        # Verify merge behavior - check if new phone number still exists
        total_tests += 1
        success, after_merge = tester.test_get_notes_for_number(test_phone)
        if success and after_merge and after_merge.get("notes"):
            print("✅ Verified: Merge mode preserved new data")
        else:
            failed_tests.append("Merge mode verification")
            print("❌ Merge mode did not preserve new data")
    
    # Test 14: Add another test note for replace testing
    test_phone2 = "+9999999999"
    total_tests += 1
    success, _ = tester.test_create_note(test_phone2, "Note to be replaced")
    if not success:
        failed_tests.append(f"POST /notes/{test_phone2} (pre-replace)")
    
    # Test 15: Create another backup before replace test
    total_tests += 1
    success, backup_data2 = tester.test_create_backup()
    if not success:
        failed_tests.append("GET /backup (second)")
    
    # Test 16: Add more notes after backup
    total_tests += 1 
    success, _ = tester.test_create_note("+5555555555", "This should disappear after replace")
    if not success:
        failed_tests.append("POST /notes/+5555555555 (temp)")
    
    # Test 17: Restore with replace mode (should remove new data)
    if backup_data2:
        total_tests += 1
        success, _ = tester.test_restore_replace(backup_data2)
        if not success:
            failed_tests.append("POST /restore (replace)")
        
        # Verify replace behavior - check if temp note was removed
        total_tests += 1
        success, after_replace = tester.test_get_notes_for_number("+5555555555")
        if success and after_replace and not after_replace.get("notes"):
            print("✅ Verified: Replace mode removed new data correctly")
        else:
            # Could also be an empty notes array, which is valid for replace behavior
            if after_replace and len(after_replace.get("notes", [])) == 0:
                print("✅ Verified: Replace mode resulted in empty notes (acceptable)")
            else:
                failed_tests.append("Replace mode verification")
                print("❌ Replace mode did not remove new data correctly")
    
    # Test 18: Error handling tests
    total_tests += 1
    success = tester.test_restore_error_handling()
    if not success:
        failed_tests.append("POST /restore (error handling)")
    
    # Summary
    print("=" * 60)
    print("📊 TEST SUMMARY")
    print(f"Total tests: {total_tests}")
    print(f"Passed: {total_tests - len(failed_tests)}")
    print(f"Failed: {len(failed_tests)}")
    
    if failed_tests:
        print("\n❌ Failed tests:")
        for test in failed_tests:
            print(f"  - {test}")
        return 1
    else:
        print("\n🎉 All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())