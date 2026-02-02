package main

// Example: Custom Responses
// Shows how to return custom HTTP status codes and responses.
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

	// Example validation logic
	body, _ := payload["body"].(map[string]interface{})
	requiredField, fieldExists := body["required_field"]

	if !fieldExists || requiredField == nil {
		// Return error response with 400 status code
		return map[string]interface{}{
			"_shsf": "v2",
			"_code": 400,
			"_res": map[string]interface{}{
				"state": false,
				"error": "Missing required_field in request",
			},
			"_headers": map[string]interface{}{
				"X-Custom-Header": "validation-failed",
			},
		}, nil
	}

	// Success response with 200 status code
	return map[string]interface{}{
		"_shsf": "v2",
		"_code": 200,
		"_res": map[string]interface{}{
			"state":   true,
			"message": "Request processed successfully",
			"data":    requiredField,
		},
		"_headers": map[string]interface{}{
			"X-Custom-Header": "validation-success",
		},
	}, nil
}
