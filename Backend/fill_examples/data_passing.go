package main

import (
	"fmt"
)

// Example: Data Passing
// Demonstrates how to receive and process data from triggers or HTTP requests.
func main_user(args interface{}) (interface{}, error) {
	fmt.Println("Received args:", args)

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

	// Access specific fields from the body
	body, _ := payload["body"].(map[string]interface{})
	event := "unknown"
	if e, ok := body["event"].(string); ok {
		event = e
	}

	user := make(map[string]interface{})
	if u, ok := body["user"].(map[string]interface{}); ok {
		user = u
	}

	// Process the data
	userName := "Guest"
	if name, ok := user["name"].(string); ok {
		userName = name
	}

	userEmail := "N/A"
	if email, ok := user["email"].(string); ok {
		userEmail = email
	}

	fmt.Printf("Event: %s\n", event)
	fmt.Printf("User: %s (%s)\n", userName, userEmail)

	// Return a response
	return map[string]interface{}{
		"_shsf": "v2",
		"_code": 200,
		"_res": map[string]interface{}{
			"message":       fmt.Sprintf("Processed %s event for %s", event, userName),
			"received_data": body,
		},
	}, nil
}
