package main

// Example: HTTP Redirects
// Demonstrates how to redirect users to different URLs.
func main_user(args interface{}) (interface{}, error) {
	// Type assert to map to access data
	payload, ok := args.(map[string]interface{})
	if !ok {
		return map[string]interface{}{
			"_shsf": "v2",
			"_code": 400,
			"_res": map[string]interface{}{
				"state": false,
				"error": "Invalid payload format",
			},
		}, nil
	}

	// Get the redirect target from the request
	body, _ := payload["body"].(map[string]interface{})
	target := "https://example.com"
	if t, ok := body["target"].(string); ok {
		target = t
	}

	redirectType := "temporary"
	if rt, ok := body["type"].(string); ok {
		redirectType = rt
	}

	// Determine status code (301 = permanent, 302 = temporary)
	statusCode := 302
	if redirectType == "permanent" {
		statusCode = 301
	}

	// Return redirect response
	return map[string]interface{}{
		"_shsf":     "v2",
		"_code":     statusCode,
		"_location": target,
	}, nil
}

// Example use cases:
// - Redirecting after login: return map[string]interface{}{"_code": 302, "_location": "/dashboard", "_shsf": "v2"}
// - URL shortener: return map[string]interface{}{"_code": 301, "_location": "https://long-url.com/page", "_shsf": "v2"}
// - Form submission redirect: return map[string]interface{}{"_code": 302, "_location": "/thank-you", "_shsf": "v2"}
