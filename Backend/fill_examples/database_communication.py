from _db_com import database
from datetime import datetime, timedelta

def main(args):
    """
    Example: Database Communication
    Demonstrates using SHSF's built-in database interface for fast persistent storage.
    Note: The 'requests' dependency is handled by SHSF's auto-generated `_db_com` module; you don't need to add it to requirements.txt for this example.
    """
    # Initialize database
    db = database()
    
    storage_name = "example_storage"
    action = args.get("body", {}).get("action", "get")
    key = args.get("body", {}).get("key", "test_key")
    value = args.get("body", {}).get("value", "test_value")
    
    try:
        if action == "create_storage":
            # Create a new storage
            db.create_storage(storage_name, purpose="Example storage for testing")
            return {
                "_shsf": "v2",
                "_code": 200,
                "_res": {
                    "state": True,
                    "message": f"Storage '{storage_name}' created"
                }
            }
        
        elif action == "set":
            # Set data without expiration
            db.set(storage_name, key, value)
            return {
                "_shsf": "v2",
                "_code": 200,
                "_res": {
                    "state": True,
                    "message": f"Key '{key}' set successfully",
                    "value": value
                }
            }
        
        elif action == "set_expiring":
            # Set data with expiration (1 hour)
            expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
            db.set(storage_name, key, value, expires_at=expires_at)
            return {
                "_shsf": "v2",
                "_code": 200,
                "_res": {
                    "state": True,
                    "message": f"Key '{key}' set with expiration",
                    "value": value,
                    "expires_at": expires_at
                }
            }
        
        elif action == "get":
            # Retrieve data
            result = db.get(storage_name, key)
            if result is None:
                return {
                    "_shsf": "v2",
                    "_code": 404,
                    "_res": {
                        "state": False,
                        "message": f"Key '{key}' not found"
                    }
                }
            return {
                "_shsf": "v2",
                "_code": 200,
                "_res": {
                    "state": True,
                    "key": key,
                    "value": result
                }
            }
        
        elif action == "list":
            # List all items in storage
            items = db.list_items(storage_name)
            return {
                "_shsf": "v2",
                "_code": 200,
                "_res": {
                    "state": True,
                    "items": items
                }
            }
        
        elif action == "delete":
            # Delete an item
            db.delete_item(storage_name, key)
            return {
                "_shsf": "v2",
                "_code": 200,
                "_res": {
                    "state": True,
                    "message": f"Key '{key}' deleted"
                }
            }
        
        elif action == "exists":
            # Check if item exists
            exists = db.exists(storage_name, key)
            return {
                "_shsf": "v2",
                "_code": 200,
                "_res": {
                    "state": True,
                    "key": key,
                    "exists": exists
                }
            }
        
        else:
            return {
                "_shsf": "v2",
                "_code": 400,
                "_res": {
                    "state": False,
                    "error": f"Unknown action: {action}",
                    "available_actions": ["create_storage", "set", "set_expiring", "get", "list", "delete", "exists"]
                }
            }
    
    except Exception as e:
        return {
            "_shsf": "v2",
            "_code": 500,
            "_res": {
                "state": False,
                "error": str(e)
            }
        }
