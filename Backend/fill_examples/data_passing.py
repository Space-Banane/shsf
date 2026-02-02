def main(args):
    """
    Example: Data Passing
    Demonstrates how to receive and process JSON data from triggers or HTTP requests.
    """
    # Access data passed from triggers or HTTP requests
    print("Received args:", args)
    
    # Example: Access specific fields from the body
    event = args.get("body", {}).get("event", "unknown")
    user = args.get("body", {}).get("user", {})
    
    # Process the data
    user_name = user.get("name", "Guest")
    user_email = user.get("email", "N/A")
    
    print(f"Event: {event}")
    print(f"User: {user_name} ({user_email})")
    
    # Return a response
    return {
        "_shsf": "v2",
        "_code": 200,
        "_res": {
            "message": f"Processed {event} event for {user_name}",
            "received_data": args.get("body", {})
        }
    }
