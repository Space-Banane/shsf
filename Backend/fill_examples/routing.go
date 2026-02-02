package main

import "fmt"

// Example: Routing
// Demonstrates handling multiple routes in a single function.
// Routes are accessed via args["route"] and only support one path segment.
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

	// Get the route from args (default is "default")
	route := "default"
	if r, ok := payload["route"].(string); ok {
		route = r
	}

	// Handle different routes
	switch route {
	case "register":
		return handleRegister(payload)
	case "login":
		return handleLogin(payload)
	case "profile":
		return handleProfile(payload)
	case "default":
		return handleDefault(payload)
	default:
		// Handle unknown routes with 404
		return map[string]interface{}{
			"_shsf": "v2",
			"_code": 404,
			"_res": map[string]interface{}{
				"state":            false,
				"error":            fmt.Sprintf("Route '%s' not found", route),
				"available_routes": []string{"register", "login", "profile", "default"},
			},
		}, nil
	}
}

func handleRegister(payload map[string]interface{}) (interface{}, error) {
	body, _ := payload["body"].(map[string]interface{})
	username, _ := body["username"].(string)
	email, _ := body["email"].(string)

	if username == "" || email == "" {
		return map[string]interface{}{
			"_shsf": "v2",
			"_code": 400,
			"_res": map[string]interface{}{
				"state": false,
				"error": "Username and email are required",
			},
		}, nil
	}

	// Registration logic here
	return map[string]interface{}{
		"_shsf": "v2",
		"_code": 200,
		"_res": map[string]interface{}{
			"state":   true,
			"message": fmt.Sprintf("User %s registered successfully", username),
			"route":   "register",
		},
	}, nil
}

func handleLogin(payload map[string]interface{}) (interface{}, error) {
	body, _ := payload["body"].(map[string]interface{})
	username, _ := body["username"].(string)

	// Login logic here
	return map[string]interface{}{
		"_shsf": "v2",
		"_code": 200,
		"_res": map[string]interface{}{
			"state":   true,
			"message": fmt.Sprintf("User %s logged in", username),
			"route":   "login",
			"token":   "example-auth-token",
		},
	}, nil
}

func handleProfile(payload map[string]interface{}) (interface{}, error) {
	// Profile logic here
	return map[string]interface{}{
		"_shsf": "v2",
		"_code": 200,
		"_res": map[string]interface{}{
			"state": true,
			"route": "profile",
			"user": map[string]interface{}{
				"username": "example_user",
				"email":    "user@example.com",
			},
		},
	}, nil
}

func handleDefault(payload map[string]interface{}) (interface{}, error) {
	return map[string]interface{}{
		"_shsf": "v2",
		"_code": 200,
		"_res": map[string]interface{}{
			"state":   true,
			"message": "Welcome to the API",
			"routes": map[string]string{
				"/register": "POST - Register a new user",
				"/login":    "POST - Login a user",
				"/profile":  "GET - Get user profile",
				"/":         "GET - This message",
			},
		},
	}, nil
}

// Example URLs:
// https://your-function/exec/id/token/register  -> calls handleRegister()
// https://your-function/exec/id/token/login     -> calls handleLogin()
// https://your-function/exec/id/token/profile   -> calls handleProfile()
// https://your-function/exec/id/token           -> calls handleDefault()
