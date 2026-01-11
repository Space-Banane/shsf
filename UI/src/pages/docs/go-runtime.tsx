import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const DocsGoRuntime = () => {
	return (
		<div className="min-h-screen bg-background text-text p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6">
					<a href="/docs" className="text-sm text-blue-500 hover:underline">
						← Back to docs
					</a>
				</div>

				<ScrollProgressbar />

				<h1 className="text-3xl font-bold text-primary mb-2">Go Runtime</h1>
				<p className="mt-3 text-lg text-text/90 mb-8">
					Learn how to create and deploy serverless functions using Go in SHSF.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">Overview</h2>
				<p className="mb-6 text-text/90">
					SHSF supports Go as a runtime for your serverless functions. Go provides
					excellent performance, static typing, and built-in concurrency support,
					making it ideal for high-performance serverless applications.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Supported Go Versions
				</h2>
				<p className="mb-4 text-text/90">The following Go versions are available:</p>
				<ul className="list-disc list-inside mb-6 text-text/90 space-y-2">
					<li>golang:1.20</li>
					<li>golang:1.21</li>
					<li>golang:1.22</li>
					<li>golang:1.23 (latest)</li>
				</ul>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Creating Your First Go Function
				</h2>
				
				<h3 className="text-xl font-semibold text-primary mb-4">
					1. Basic Function Structure
				</h3>
				<p className="mb-4 text-text/90">
					Go functions must define a <code>main_user</code> function that accepts
					an <code>interface{'{}'}</code> parameter and returns <code>(interface{'{}'}, error)</code>:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`package main

import "fmt"

// main_user is called by the SHSF runtime
func main_user(args interface{}) (interface{}, error) {
    // Your function logic here
    result := map[string]string{
        "message": "Hello from Go!",
        "status": "success",
    }
    return result, nil
}`}</code>
				</pre>

				<h3 className="text-xl font-semibold text-primary mb-4">
					2. Working with Payload Data
				</h3>
				<p className="mb-4 text-text/90">
					Access request data by type asserting the args parameter:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`package main

import "fmt"

func main_user(args interface{}) (interface{}, error) {
    // Type assert the args to a map
    payload, ok := args.(map[string]interface{})
    if !ok {
        return nil, fmt.Errorf("invalid payload format")
    }
    
    // Access data from the payload
    name, _ := payload["name"].(string)
    
    result := map[string]string{
        "greeting": fmt.Sprintf("Hello, %s!", name),
    }
    return result, nil
}`}</code>
				</pre>

				<h3 className="text-xl font-semibold text-primary mb-4">
					3. Using Go Modules
				</h3>
				<p className="mb-4 text-text/90">
					Create a <code>go.mod</code> file to manage dependencies. SHSF will
					automatically download and cache your dependencies:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`module myfunction

go 1.23

require (
    github.com/google/uuid v1.3.0
)`}</code>
				</pre>

				<p className="mb-4 text-text/90">
					Then use the dependency in your function:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`package main

import (
    "github.com/google/uuid"
)

func main_user(args interface{}) (interface{}, error) {
    id := uuid.New()
    return map[string]string{
        "id": id.String(),
    }, nil
}`}</code>
				</pre>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Advanced Features
				</h2>

				<h3 className="text-xl font-semibold text-primary mb-4">
					Custom Response Formats
				</h3>
				<p className="mb-4 text-text/90">
					Return custom HTTP responses with headers and status codes:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`package main

func main_user(args interface{}) (interface{}, error) {
    return map[string]interface{}{
        "_shsf": "v2",
        "_code": 201,
        "_headers": map[string]string{
            "Content-Type": "application/json",
            "X-Custom-Header": "MyValue",
        },
        "_res": map[string]string{
            "status": "created",
            "id": "123",
        },
    }, nil
}`}</code>
				</pre>

				<h3 className="text-xl font-semibold text-primary mb-4">
					Error Handling
				</h3>
				<p className="mb-4 text-text/90">
					Return errors when something goes wrong:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`package main

import "fmt"

func main_user(args interface{}) (interface{}, error) {
    payload, ok := args.(map[string]interface{})
    if !ok {
        return nil, fmt.Errorf("payload must be a JSON object")
    }
    
    requiredField, exists := payload["required"]
    if !exists {
        return nil, fmt.Errorf("missing required field: 'required'")
    }
    
    return map[string]interface{}{
        "result": requiredField,
    }, nil
}`}</code>
				</pre>

				<h3 className="text-xl font-semibold text-primary mb-4">
					Logging
				</h3>
				<p className="mb-4 text-text/90">
					Use standard output for logging. Logs appear in the function execution logs:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`package main

import (
    "fmt"
    "log"
)

func main_user(args interface{}) (interface{}, error) {
    log.Println("Function started")
    fmt.Println("Processing request...")
    
    // Your logic here
    
    log.Println("Function completed")
    return map[string]string{"status": "ok"}, nil
}`}</code>
				</pre>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Database Communication
				</h2>
				<p className="mb-4 text-text/90">
					Import the <code>dbcom</code> package to interact with SHSF's storage system:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`package main

import (
    "myfunction/dbcom"
)

func main_user(args interface{}) (interface{}, error) {
    db := dbcom.New()
    
    // Set a value
    _, err := db.Set("my-storage", "key", "value", nil)
    if err != nil {
        return nil, err
    }
    
    // Get a value
    value, err := db.Get("my-storage", "key")
    if err != nil {
        return nil, err
    }
    
    return map[string]interface{}{
        "stored_value": value,
    }, nil
}`}</code>
				</pre>

				<div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
					<p className="text-sm text-blue-300">
						<strong>Note:</strong> The <code>dbcom</code> package is automatically
						generated when your function code contains "_db_com" references.
					</p>
				</div>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					File Structure
				</h2>
				<p className="mb-4 text-text/90">
					A typical Go function structure looks like this:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`myfunction/
├── main.go        # Your function code (startup file)
├── go.mod         # Go module definition (optional)
└── go.sum         # Dependency checksums (auto-generated)`}</code>
				</pre>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Performance Tips
				</h2>
				<ul className="list-disc list-inside mb-6 text-text/90 space-y-2">
					<li>
						Go functions are compiled once and cached, so subsequent executions are fast
					</li>
					<li>
						Dependencies are downloaded and cached based on go.mod/go.sum hash
					</li>
					<li>
						Use Go's built-in concurrency features (goroutines, channels) for parallel processing
					</li>
					<li>
						Keep your binary size small by avoiding unnecessary dependencies
					</li>
				</ul>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Example: Complete Function
				</h2>
				<p className="mb-4 text-text/90">
					Here's a complete example that demonstrates multiple features:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`package main

import (
    "fmt"
    "strings"
)

func main_user(args interface{}) (interface{}, error) {
    // Parse input
    payload, ok := args.(map[string]interface{})
    if !ok {
        return map[string]interface{}{
            "_shsf": "v2",
            "_code": 400,
            "_res": map[string]string{
                "error": "Invalid payload format",
            },
        }, nil
    }
    
    // Extract parameters
    text, ok := payload["text"].(string)
    if !ok {
        return map[string]interface{}{
            "_shsf": "v2",
            "_code": 400,
            "_res": map[string]string{
                "error": "Missing 'text' parameter",
            },
        }, nil
    }
    
    // Process
    fmt.Println("Processing text:", text)
    result := strings.ToUpper(text)
    wordCount := len(strings.Fields(text))
    
    // Return response
    return map[string]interface{}{
        "_shsf": "v2",
        "_code": 200,
        "_headers": map[string]string{
            "Content-Type": "application/json",
        },
        "_res": map[string]interface{}{
            "original": text,
            "uppercase": result,
            "word_count": wordCount,
        },
    }, nil
}`}</code>
				</pre>

				<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
					<h2 className="text-xl font-bold text-primary mb-3">
						📚 Keep Your Instance Updated
					</h2>
					<p className="text-text/90 mb-4">
						This is the latest documentation available. Make sure to keep your SHSF
						instance updated to get access to new features and improvements!
					</p>
				</div>
			</div>
		</div>
	);
};
