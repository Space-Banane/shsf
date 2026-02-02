def main(args):
    """
    Example: HTTP Redirects
    Demonstrates how to redirect users to different URLs.
    """
    # Get the redirect target from the request
    target = args.get("body", {}).get("target", "https://example.com")
    redirect_type = args.get("body", {}).get("type", "temporary")
    
    # Determine status code (301 = permanent, 302 = temporary)
    status_code = 301 if redirect_type == "permanent" else 302
    
    # Return redirect response
    return {
        "_shsf": "v2",
        "_code": status_code,
        "_location": target
    }

# Example use cases:
# - Redirecting after login: return {"_code": 302, "_location": "/dashboard", "_shsf": "v2"}
# - URL shortener: return {"_code": 301, "_location": "https://long-url.com/page", "_shsf": "v2"}
# - Form submission redirect: return {"_code": 302, "_location": "/thank-you", "_shsf": "v2"}
