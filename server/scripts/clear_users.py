#!/usr/bin/env python3
"""
Script to remove all users from the database.
This is useful when implementing new user profiles with cost structure.
"""
import os
import sys
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from mongodb_store import MongoDBStore

def clear_users():
    """Remove all users from the database"""
    store = MongoDBStore()
    
    if store.db is None:
        print("ERROR: Database not connected. Please check MONGODB_URI.")
        return False
    
    try:
        # Get count before deletion
        count = store.db.users.count_documents({})
        print(f"Found {count} users in database.")
        
        if count == 0:
            print("No users to delete.")
            return True
        
        # Confirm deletion
        response = input(f"Are you sure you want to delete all {count} users? (yes/no): ")
        if response.lower() != 'yes':
            print("Deletion cancelled.")
            return False
        
        # Delete all users
        result = store.db.users.delete_many({})
        print(f"Successfully deleted {result.deleted_count} users.")
        return True
        
    except Exception as e:
        print(f"ERROR: Failed to delete users: {str(e)}")
        return False

if __name__ == "__main__":
    clear_users()

