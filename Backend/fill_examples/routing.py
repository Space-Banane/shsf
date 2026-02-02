def main(args):
    """
    Example: Routing
    Demonstrates handling multiple routes in a single function.
    Routes are accessed via args.get("route") and only support one path segment.
    """
    # Get the route from args (default is "default")
    route = args.get("route", "default")
    
    # Handle different routes
    if route == "register":
        return handle_register(args)
    
    elif route == "login":
        return handle_login(args)
    
    elif route == "profile":
        return handle_profile(args)
    
    elif route == "default":
        return handle_default(args)
    
    else:
        # Handle unknown routes with 404
        return {
            "_shsf": "v2",
            "_code": 404,
            "_res": {
                "state": False,
                "error": f"Route '{route}' not found",
                "available_routes": ["register", "login", "profile", "default"]
            }
        }

def handle_register(args):
    """Handle user registration"""
    data = args.get("body", {})
    username = data.get("username")
    email = data.get("email")
    
    if not username or not email:
        return {
            "_shsf": "v2",
            "_code": 400,
            "_res": {
                "state": False,
                "error": "Username and email are required"
            }
        }
    
    # Registration logic here
    return {
        "_shsf": "v2",
        "_code": 200,
        "_res": {
            "state": True,
            "message": f"User {username} registered successfully",
            "route": "register"
        }
    }

def handle_login(args):
    """Handle user login"""
    data = args.get("body", {})
    username = data.get("username")
    password = data.get("password")
    
    # Login logic here
    return {
        "_shsf": "v2",
        "_code": 200,
        "_res": {
            "state": True,
            "message": f"User {username} logged in",
            "route": "login",
            "token": "example-auth-token"
        }
    }

def handle_profile(args):
    """Handle profile retrieval"""
    # Profile logic here
    return {
        "_shsf": "v2",
        "_code": 200,
        "_res": {
            "state": True,
            "route": "profile",
            "user": {
                "username": "example_user",
                "email": "user@example.com"
            }
        }
    }

def handle_default(args):
    """Handle default route (root endpoint)"""
    return {
        "_shsf": "v2",
        "_code": 200,
        "_res": {
            "state": True,
            "message": "Welcome to the API",
            "routes": {
                "/register": "POST - Register a new user",
                "/login": "POST - Login a user",
                "/profile": "GET - Get user profile",
                "/": "GET - This message"
            }
        }
    }

# Example URLs:
# https://your-function/exec/id/token/register  -> calls handle_register()
# https://your-function/exec/id/token/login     -> calls handle_login()
# https://your-function/exec/id/token/profile   -> calls handle_profile()
# https://your-function/exec/id/token           -> calls handle_default()
