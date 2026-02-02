def main(args):
    """
    Example: Custom Responses
    Shows how to return custom HTTP status codes and responses.
    """
    # Example validation logic
    data = args.get("body", {})
    required_field = data.get("required_field")
    
    if not required_field:
        # Return error response with 400 status code
        return {
            "_shsf": "v2",
            "_code": 400,
            "_res": {
                "state": False,
                "error": "Missing required_field in request"
            },
            "_headers": {
                "X-Custom-Header": "validation-failed"
            }
        }
    
    # Success response with 200 status code
    return {
        "_shsf": "v2",
        "_code": 200,
        "_res": {
            "state": True,
            "message": "Request processed successfully",
            "data": required_field
        },
        "_headers": {
            "X-Custom-Header": "validation-success"
        }
    }
