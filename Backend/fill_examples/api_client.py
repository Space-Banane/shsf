import requests
import os

def main(args):
    """
    Example: External API Client
    Demonstrates making authenticated requests to external APIs.
    Use environment variables for API keys!
    """
    # Get API key from environment variable (more secure)
    api_key = os.getenv("EXTERNAL_API_KEY")
    
    if not api_key:
        return {
            "_shsf": "v2",
            "_code": 500,
            "_res": {
                "state": False,
                "error": "EXTERNAL_API_KEY environment variable not set"
            }
        }
    
    # Get action and parameters from request body
    action = args.get("body", {}).get("action", "get_data")
    endpoint = args.get("body", {}).get("endpoint", "https://api.example.com/data")
    
    try:
        if action == "get_data":
            # Make GET request to external API
            response = requests.get(
                endpoint,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                return {
                    "_shsf": "v2",
                    "_code": 200,
                    "_res": {
                        "state": True,
                        "data": response.json()
                    }
                }
            else:
                return {
                    "_shsf": "v2",
                    "_code": response.status_code,
                    "_res": {
                        "state": False,
                        "error": f"API returned status {response.status_code}",
                        "message": response.text
                    }
                }
        
        elif action == "post_data":
            # Make POST request to external API
            payload = args.get("body", {}).get("payload", {})
            
            response = requests.post(
                endpoint,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json=payload
            )
            
            if response.status_code in [200, 201]:
                return {
                    "_shsf": "v2",
                    "_code": 200,
                    "_res": {
                        "state": True,
                        "message": "Data posted successfully",
                        "response": response.json()
                    }
                }
            else:
                return {
                    "_shsf": "v2",
                    "_code": response.status_code,
                    "_res": {
                        "state": False,
                        "error": f"API returned status {response.status_code}"
                    }
                }
        
        else:
            return {
                "_shsf": "v2",
                "_code": 400,
                "_res": {
                    "state": False,
                    "error": f"Unknown action: {action}",
                    "available_actions": ["get_data", "post_data"]
                }
            }
    
    except requests.exceptions.RequestException as e:
        return {
            "_shsf": "v2",
            "_code": 500,
            "_res": {
                "state": False,
                "error": "Request failed",
                "details": str(e)
            }
        }

# Remember to set EXTERNAL_API_KEY in your function's environment variables!
