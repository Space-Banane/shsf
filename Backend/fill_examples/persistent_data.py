def main(args):
    """
    Example: Persistent Data Storage
    Demonstrates filesystem storage for data that persists between function invocations.
    """
    action = args.get("body", {}).get("action", "read")
    data_to_store = args.get("body", {}).get("data", "Hello, World!")
    
    # ALWAYS use /app/ directory for persistent storage
    file_path = "/app/mydata.txt"
    
    if action == "write":
        # Writing to a file
        try:
            with open(file_path, "w") as f:
                f.write(data_to_store)
            
            return {
                "_shsf": "v2",
                "_code": 200,
                "_res": {
                    "state": True,
                    "message": "Data written successfully",
                    "data": data_to_store
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
    
    elif action == "read":
        # Reading from a file
        try:
            with open(file_path, "r") as f:
                content = f.read()
            
            return {
                "_shsf": "v2",
                "_code": 200,
                "_res": {
                    "state": True,
                    "message": "Data read successfully",
                    "content": content
                }
            }
        except FileNotFoundError:
            return {
                "_shsf": "v2",
                "_code": 404,
                "_res": {
                    "state": False,
                    "error": "File not found. Use action='write' first."
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
    
    else:
        return {
            "_shsf": "v2",
            "_code": 400,
            "_res": {
                "state": False,
                "error": "Invalid action. Use 'read' or 'write'."
            }
        }
