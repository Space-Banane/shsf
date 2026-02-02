import os

def main(args):
    """
    Example: Environment Variables
    Demonstrates how to securely use API keys and secrets via environment variables.
    """
    # Retrieve environment variables
    api_key = os.getenv("API_KEY")
    database_url = os.getenv("DATABASE_URL")
    debug_mode = os.getenv("DEBUG_MODE", "false").lower() == "true"
    
    # Check if required environment variables are set
    if not api_key:
        return {
            "_shsf": "v2",
            "_code": 500,
            "_res": {
                "state": False,
                "error": "API_KEY environment variable not set"
            }
        }
    
    # Use the environment variables in your logic
    if debug_mode:
        print(f"Debug mode enabled")
        print(f"API Key present: {bool(api_key)}")
        print(f"Database URL: {database_url if database_url else 'Not set'}")
    
    # Example: Use the API key in a request (pseudo-code)
    # response = requests.get(f"https://api.example.com/data", headers={"Authorization": f"Bearer {api_key}"})
    
    return {
        "_shsf": "v2",
        "_code": 200,
        "_res": {
            "state": True,
            "message": "Environment variables loaded successfully",
            "api_key_set": bool(api_key),
            "database_url_set": bool(database_url)
        }
    }
