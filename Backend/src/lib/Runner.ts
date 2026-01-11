import { Function, FunctionFile } from "@prisma/client";
import Docker from "dockerode";
import { PassThrough } from "stream"; // Added PassThrough
import { API_URL, prisma } from "..";
import { HttpRequestContext } from "rjweb-server";
import { DataContext } from "rjweb-server/lib/typings/types/internal";
import { UsableMiddleware } from "rjweb-server/lib/typings/classes/Middleware";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { randomBytes } from "crypto";

interface TimingEntry {
	timestamp: number;
	value: number;
	description: string;
}

// Token expiry for execution tokens (in milliseconds)
const FUNCTION_DB_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const ServeOnlyFileNotFoundHTML = `<html><head><title>File Not Found</title></head><body><h1>404 - File Not Found</h1><p>The requested HTML file was not found in the function's files.</p></body></html>`;

const DbComScriptPY = `# Database Communication Script
# GENERATED ON THE FLY - DO NOT EDIT - THIS WILL BE OVERWRITTEN ON THE NEXT RUN
import requests
from typing import Any, Optional, Dict, List
from datetime import datetime

# Configuration placeholders
BASE_URL = "{{API}}"
ACCESS_KEY = "{{AUTHKEY}}"


class DatabaseError(Exception):
    """Custom exception for database operations"""
    pass


class Database:
    """
    Database class for interacting with the storage API.
    
    Usage:
        from _db_com import database
        db = database()
        db.set("storage1", "name", "Paul")
        print(db.get("storage1", "name"))
    """
    
    def __init__(self):
        self.base_url = BASE_URL.rstrip('/')
        self.headers = {
            "Content-Type": "application/json",
            "X-Access-Key": ACCESS_KEY
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
    
    def _make_request(self, method: str, url: str, **kwargs) -> Dict:
        """Make HTTP request and handle response"""
        try:
            response = self.session.request(method, url, **kwargs)
            data = response.json()
            
            if isinstance(data, dict) and data.get("status") != "OK" and "status" in data:
                raise DatabaseError(f"API Error: {data.get('message', 'Unknown error')}")
            
            return data
        except requests.exceptions.RequestException as e:
            raise DatabaseError(f"Request failed: {str(e)}")
    
    def create_storage(self, name: str, purpose: str = "") -> Dict:
        """
        Create a new storage.
        
        Args:
            name: Storage name
            purpose: Purpose description
            
        Returns:
            Storage object
        """
        url = f"{self.base_url}/api/storage"
        payload = {"name": name, "purpose": purpose}
        result = self._make_request("POST", url, json=payload)
        return result.get("data", result)
    
    def list_storages(self) -> List[Dict]:
        """
        List all storages for the user.
        
        Returns:
            List of storage objects
        """
        url = f"{self.base_url}/api/storage"
        result = self._make_request("GET", url)
        return result.get("data", result)
    
    def delete_storage(self, storage_name: str) -> Dict:
        """
        Delete a storage by name.
        
        Args:
            storage_name: Name of the storage to delete
            
        Returns:
            Response object
        """
        url = f"{self.base_url}/api/storage/{requests.utils.quote(storage_name)}"
        return self._make_request("DELETE", url)
    
    def clear(self, storage_name: str) -> Dict:
        """
        Clear all items in a storage.
        
        Args:
            storage_name: Name of the storage to clear
            
        Returns:
            Response object
        """
        url = f"{self.base_url}/api/storage/{requests.utils.quote(storage_name)}/items"
        return self._make_request("DELETE", url)
    
    def set(self, storage_name: str, key: str, value: Any, 
            expires_at: Optional[str] = None) -> Dict:
        """
        Set (create/update) an item in storage.
        
        Args:
            storage_name: Name of the storage
            key: Item key
            value: Item value (any JSON-serializable type)
            expires_at: Optional expiration timestamp (ISO format string or Unix timestamp)
            
        Returns:
            StorageItem object
        """
        url = f"{self.base_url}/api/storage/{requests.utils.quote(storage_name)}/item"
        payload = {"key": key, "value": value}
        if expires_at is not None:
            payload["expiresAt"] = expires_at
        
        result = self._make_request("POST", url, json=payload)
        return result.get("data", result)
    
    def get(self, storage_name: str, key: str) -> Any:
        """
        Get an item value by key from storage.
        
        Args:
            storage_name: Name of the storage
            key: Item key
            
        Returns:
            Item value (the actual value, not the full object)
        """
        url = f"{self.base_url}/api/storage/{requests.utils.quote(storage_name)}/item/{requests.utils.quote(key)}"
        result = self._make_request("GET", url)
        item = result.get("data", result)
        return item.get("value") if isinstance(item, dict) else item
    
    def get_item(self, storage_name: str, key: str) -> Dict:
        """
        Get full item object by key from storage (includes metadata).
        
        Args:
            storage_name: Name of the storage
            key: Item key
            
        Returns:
            Full StorageItem object
        """
        url = f"{self.base_url}/api/storage/{requests.utils.quote(storage_name)}/item/{requests.utils.quote(key)}"
        result = self._make_request("GET", url)
        return result.get("data", result)
    
    def list_items(self, storage_name: str) -> List[Dict]:
        """
        List all items in a storage.
        
        Args:
            storage_name: Name of the storage
            
        Returns:
            List of StorageItem objects
        """
        url = f"{self.base_url}/api/storage/{requests.utils.quote(storage_name)}/items"
        result = self._make_request("GET", url)
        return result.get("data", result)
    
    def delete_item(self, storage_name: str, key: str) -> Dict:
        """
        Delete an item by key from storage.
        
        Args:
            storage_name: Name of the storage
            key: Item key
            
        Returns:
            Response object
        """
        url = f"{self.base_url}/api/storage/{requests.utils.quote(storage_name)}/item/{requests.utils.quote(key)}"
        return self._make_request("DELETE", url)
    
    def exists(self, storage_name: str, key: str) -> bool:
        """
        Check if an item exists in storage.
        
        Args:
            storage_name: Name of the storage
            key: Item key
            
        Returns:
            True if item exists, False otherwise
        """
        try:
            self.get(storage_name, key)
            return True
        except DatabaseError:
            return False


def database() -> Database:
    """
    Factory function to create a Database instance.
    
    Returns:
        Database instance
    """
    return Database()


# Alternative: Direct instantiation
# You can also use: db = Database()`;

const DbComScriptGO = `// Database Communication Script in Go
// GENERATED ON THE FLY - DO NOT EDIT - THIS WILL BE OVERWRITTEN ON THE NEXT RUN

package dbcom

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Configuration placeholders
const (
	BaseURL   = "{{API}}"
	AccessKey = "{{AUTHKEY}}"
)

// DatabaseError represents an API error
type DatabaseError struct {
	Message string
}

func (e *DatabaseError) Error() string {
	return fmt.Sprintf("API Error: %s", e.Message)
}

// Database client
type Database struct {
	client  *http.Client
	baseURL string
	headers map[string]string
}

// New creates a new Database instance
func New() *Database {
	return &Database{
		client:  &http.Client{Timeout: 30 * time.Second},
		baseURL: strings.TrimRight(BaseURL, "/"),
		headers: map[string]string{
			"Content-Type": "application/json",
			"X-Access-Key": AccessKey,
		},
	}
}

// internal response wrapper
type apiResponse struct {
	Status  string          ` +
	"`" +
	`json:"status"` +
	"`" +
	`
	Message string          ` +
	"`" +
	`json:"message,omitempty"` +
	"`" +
	`
	Data    json.RawMessage ` +
	"`" +
	`json:"data,omitempty"` +
	"`" +
	`
}

func (db *Database) makeRequest(method, path string, payload interface{}) ([]byte, error) {
	fullURL := db.baseURL + path
	var body io.Reader

	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		body = bytes.NewBuffer(b)
	}

	req, err := http.NewRequest(method, fullURL, body)
	if err != nil {
		return nil, err
	}

	for k, v := range db.headers {
		req.Header.Set(k, v)
	}

	resp, err := db.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Try to parse as standard API response
	var res apiResponse
	if err := json.Unmarshal(respData, &res); err == nil {
		// If it has a status field, check it
		if res.Status != "" && res.Status != "OK" {
			msg := res.Message
			if msg == "" {
				msg = "Unknown error"
			}
			return nil, &DatabaseError{Message: msg}
		}
		// If data is present, return that. Mimics python's result.get("data", result)
		if len(res.Data) > 0 {
			return res.Data, nil
		}
	}

	// Fallback: return raw body if not a standard wrapped response or parsing failed
	return respData, nil
}

// CreateStorage creates a new storage
func (db *Database) CreateStorage(name, purpose string) (map[string]interface{}, error) {
	urlPath := "/api/storage"
	payload := map[string]string{
		"name":    name,
		"purpose": purpose,
	}
	
	resp, err := db.makeRequest("POST", urlPath, payload)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	json.Unmarshal(resp, &result)
	return result, nil
}

// ListStorages lists all storages
func (db *Database) ListStorages() ([]map[string]interface{}, error) {
	urlPath := "/api/storage"
	resp, err := db.makeRequest("GET", urlPath, nil)
	if err != nil {
		return nil, err
	}

	var result []map[string]interface{}
	json.Unmarshal(resp, &result)
	return result, nil
}

// DeleteStorage deletes a storage by name
func (db *Database) DeleteStorage(name string) error {
	urlPath := fmt.Sprintf("/api/storage/%s", url.PathEscape(name))
	_, err := db.makeRequest("DELETE", urlPath, nil)
	return err
}

// Clear clears all items in a storage
func (db *Database) Clear(name string) error {
	urlPath := fmt.Sprintf("/api/storage/%s/items", url.PathEscape(name))
	_, err := db.makeRequest("DELETE", urlPath, nil)
	return err
}

// Set creates or updates an item
func (db *Database) Set(storageName, key string, value interface{}, expiresAt *string) (map[string]interface{}, error) {
	urlPath := fmt.Sprintf("/api/storage/%s/item", url.PathEscape(storageName))
	payload := map[string]interface{}{
		"key":   key,
		"value": value,
	}
	if expiresAt != nil {
		payload["expiresAt"] = *expiresAt
	}

	resp, err := db.makeRequest("POST", urlPath, payload)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	json.Unmarshal(resp, &result)
	return result, nil
}

// Get returns an item's value by key. 
// Returns interface{} to match Python's dynamic return type.
func (db *Database) Get(storageName, key string) (interface{}, error) {
	urlPath := fmt.Sprintf("/api/storage/%s/item/%s", url.PathEscape(storageName), url.PathEscape(key))
	resp, err := db.makeRequest("GET", urlPath, nil)
	if err != nil {
		return nil, err
	}

	// We need to check if the returned data is the item wrapper or the value itself.
	// Based on Python script: item.get("value")
	var itemWrapper map[string]interface{}
	if err := json.Unmarshal(resp, &itemWrapper); err == nil {
		if val, ok := itemWrapper["value"]; ok {
			return val, nil
		}
		// If no "value" key, return the whole object
		return itemWrapper, nil
	}
	
	return nil, fmt.Errorf("could not parse item")
}

// GetItem returns the full item object (metadata included)
func (db *Database) GetItem(storageName, key string) (map[string]interface{}, error) {
	urlPath := fmt.Sprintf("/api/storage/%s/item/%s", url.PathEscape(storageName), url.PathEscape(key))
	resp, err := db.makeRequest("GET", urlPath, nil)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	json.Unmarshal(resp, &result)
	return result, nil
}

// ListItems lists all items in storage
func (db *Database) ListItems(storageName string) ([]map[string]interface{}, error) {
	urlPath := fmt.Sprintf("/api/storage/%s/items", url.PathEscape(storageName))
	resp, err := db.makeRequest("GET", urlPath, nil)
	if err != nil {
		return nil, err
	}

	var result []map[string]interface{}
	json.Unmarshal(resp, &result)
	return result, nil
}

// DeleteItem deletes an item by key
func (db *Database) DeleteItem(storageName, key string) error {
	urlPath := fmt.Sprintf("/api/storage/%s/item/%s", url.PathEscape(storageName), url.PathEscape(key))
	_, err := db.makeRequest("DELETE", urlPath, nil)
	return err
}

// Exists checks if an item exists
func (db *Database) Exists(storageName, key string) bool {
	_, err := db.Get(storageName, key)
	return err == nil
}
`;

async function getOrCreateFunctionDbToken(userId: number): Promise<string> {
	const tokenName = `__function_db_access__`;

	// Try to find existing valid token
	const existingToken = await prisma.accessToken.findFirst({
		where: {
			userId: userId,
			name: tokenName,
			hidden: true,
			expiresAt: {
				gt: new Date(), // Not expired
			},
		},
	});

	if (existingToken) {
		return existingToken.token;
	}

	// Create new token with 24 hour expiry
	const newToken = randomBytes(32).toString("hex");
	await prisma.accessToken.create({
		data: {
			userId: userId,
			name: tokenName,
			token: newToken,
			hidden: true,
			purpose: "Shared database access token for all function executions",
			expiresAt: new Date(Date.now() + FUNCTION_DB_TOKEN_EXPIRY_MS),
		},
	});

	return newToken;
}

export async function executeFunction(
	id: number,
	functionData: Function,
	files: FunctionFile[],
	stream:
		| { enabled: true; onChunk: (data: string) => void }
		| { enabled: false },
	payload: string
) {
	const starting_time = Date.now();
	const tooks: TimingEntry[] = [];
	let func_result: string = ""; // Stores the JSON string result from the function
	let logs: string = ""; // Stores logs from the function execution

	const recordTiming = (() => {
		let lastTimestamp = starting_time;
		return (description: string) => {
			const currentTimestamp = Date.now();
			const value = (currentTimestamp - lastTimestamp) / 1000;
			tooks.push({ timestamp: currentTimestamp, value, description });
			console.log(`[SHSF CRONS] ${description}: ${value.toFixed(3)} seconds`);
		};
	})();

	// Serve Only HTML (serve-only)
	if (functionData.startup_file?.endsWith(".html")) {
		return {
			logs: "Serve Only HTML function executed.",
			result: {
				_shsf: "v2",
				_headers: { "Content-Type": "text/html; charset=utf-8" },
				_code: 200,
				_res:
					files.find((f) => f.name === functionData.startup_file)?.content ||
					ServeOnlyFileNotFoundHTML,
			},
			tooks: [
				{
					description: "Serve Only HTML function executed.",
					value: 0,
					timestamp: starting_time,
				},
			] as TimingEntry[],
			exit_code: 0,
		};
	}

	const docker = new Docker();
	let dbAccessToken = ""; // Keep for cleanup logic, but won't be deleted anymore
	const functionIdStr = String(functionData.id);
	const containerName = `shsf_func_${functionIdStr}`;
	// Persistent directory on the host for this function's app files
	const funcAppDir = path.join("/opt/shsf_data/functions", functionIdStr, "app");
	const runtimeType = functionData.image.split(":")[0];
	let exitCode = 0; // Default exit code

	// Generate a unique execution ID for this request to avoid race conditions
	// Use crypto.randomUUID() for better uniqueness if available, otherwise fallback
	const executionId =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
	const executionDir = path.join(
		"/opt/shsf_data/functions",
		functionIdStr,
		"executions",
		executionId
	);

	// Define startupFile and initScript here as they are needed for script generation
	const startupFile = functionData.startup_file;

	let initScript =
		"#!/bin/sh\nset -e\necho '[SHSF INIT] Starting environment setup...'\ncd /app\n";

	try {
		let container = docker.getContainer(containerName);
		let containerJustCreated = false;

		// Ensure function app directory exists
		await fs.mkdir(funcAppDir, { recursive: true });

		// Create unique execution directory for this request
		await fs.mkdir(executionDir, { recursive: true });
		recordTiming("Created unique execution directory");

		// Always update the user files regardless of container state
		recordTiming("Updating function files");
		await Promise.all(
			files.map(async (file) => {
				const filePath = path.join(funcAppDir, file.name);
				await fs.writeFile(filePath, file.content);
			})
		);
		recordTiming("User files written to host app directory");

		// For Go runtime, generate the runner wrapper file and go.mod if needed
		if (runtimeType === "golang") {
			const runnerWrapperCode = `package main

import (
	"encoding/json"
	"fmt"
	"os"
)

// Runner wrapper that handles payload loading and result marshaling
func runFunction(payloadPath string, out *os.File) error {
	// Read payload from file
	var payload interface{}
	if payloadPath != "" {
		data, err := os.ReadFile(payloadPath)
		if err != nil {
			return fmt.Errorf("error reading payload file: %w", err)
		}
		
		if len(data) > 0 {
			if err := json.Unmarshal(data, &payload); err != nil {
				return fmt.Errorf("error decoding payload JSON: %w", err)
			}
		}
	}
	
	// Call user's main_user function
	result, err := main_user(payload)
	if err != nil {
		return fmt.Errorf("error executing main function: %w", err)
	}
	
	// Marshal result to JSON
	resultJSON, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("error serializing result: %w", err)
	}
	
	// Write result with markers to original stdout (passed as out)
	fmt.Fprintln(out, "SHSF_FUNCTION_RESULT_START")
	fmt.Fprint(out, string(resultJSON))
	fmt.Fprint(out, "\\nSHSF_FUNCTION_RESULT_END")
	
	return nil
}

func main() {
	// Redirect user's stdout to stderr so logs don't interfere with result
	oldStdout := os.Stdout
	os.Stdout = os.Stderr
	
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Error: Payload file path not provided")
		os.Exit(1)
	}
	
	payloadPath := os.Args[1]
	
	// Do NOT restore stdout here for user code execution.
	// This ensures fmt.Println in user code goes to stderr (logs).
	
	// Run the function, passing original stdout for the result
	if err := runFunction(payloadPath, oldStdout); err != nil {
		// Ensure error goes to stderr
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
`;
			await fs.writeFile(path.join(funcAppDir, "shsf_runner.go"), runnerWrapperCode);
			
			// Generate go.mod if it doesn't exist
			const goModPath = path.join(funcAppDir, "go.mod");
			if (!fsSync.existsSync(goModPath)) {
				const goModContent = `module shsf_function_${functionData.id}\n\ngo 1.23\n`;
				await fs.writeFile(goModPath, goModContent);
				recordTiming("Generated default go.mod file");
			}
			
			recordTiming("Go runner wrapper (shsf_runner.go) written to host app directory");
		}

		// Always generate/update the runner script to accept payload file path as argument
		if (runtimeType === "python") {
			const wrapperPath = path.join(funcAppDir, "_runner.py");
			const wrapperContent = `#!/bin/sh
# Source environment variables if the file exists
if [ -f /app/.shsf_env ]; then
    . /app/.shsf_env
    echo "[SHSF RUNNER] Sourced environment from /app/.shsf_env" >&2
else
    echo "[SHSF RUNNER] Warning: No .shsf_env file found" >&2
fi

# Execute the actual Python runner with payload file path as argument
python3 - "$@" << 'PYTHON_SCRIPT_EOF'
import json
import sys
import os
import traceback

# Get payload file path from command line argument
if len(sys.argv) < 2:
	sys.stderr.write("Error: Payload file path not provided\\n")
	sys.exit(1)

payload_file_path = sys.argv[1]  # This will be /executions/<id>/payload.json due to new mount

# Store original stdout, then redirect sys.stdout to sys.stderr for user code
original_stdout = sys.stdout
sys.stdout = sys.stderr

sys.path.append('/app')
target_module_name = "${startupFile.replace(".py", "")}"

# Read payload from the specified file
run_data = None
try:
    with open(payload_file_path, 'r') as f:
        payload_content = f.read()
        if payload_content.strip():
            run_data = json.loads(payload_content)
except FileNotFoundError:
    sys.stderr.write(f"Warning: Payload file not found at {payload_file_path}\\n")
except json.JSONDecodeError as e:
    sys.stderr.write(f"Error decoding payload JSON: {str(e)}\\n")
    sys.exit(1)
except Exception as e:
    sys.stderr.write(f"Error reading payload file: {str(e)}\\n")
    sys.exit(1)

user_result = None
try:
    original_name_val = __name__
    __name__ = 'imported_module'
    target_module = __import__(target_module_name)
    __name__ = original_name_val # Restore __name__

    if hasattr(target_module, 'main') and callable(target_module.main):
        try:
            # User's main function is called. Its print() statements will go to current sys.stdout (which is sys.stderr).
            if run_data is not None:
                user_result = target_module.main(run_data)
            else:
                user_result = target_module.main()
            
            # Restore original stdout for printing the JSON result
            sys.stdout = original_stdout
            # Wrap the output in markers for clear identification on the *original* stdout
            sys.stdout.write("SHSF_FUNCTION_RESULT_START\\n")
            sys.stdout.write(json.dumps(user_result))
            sys.stdout.write("\\nSHSF_FUNCTION_RESULT_END")
            sys.stdout.flush()
        except Exception as e:
            # Error during main execution or result serialization.
            # Ensure output goes to stderr. If json.dumps failed, sys.stdout might be original_stdout.
            sys.stdout = sys.stderr
            sys.stderr.write(f"Error executing main function or serializing result: {str(e)}\\n")
            traceback.print_exc(file=sys.stderr)
            sys.stdout = original_stdout # Restore for finally block consistency
            sys.exit(1)
    else:
        # sys.stdout is already sys.stderr
        sys.stderr.write(f"No 'main' function found in {target_module_name}.py\\n")
        sys.exit(1)
except Exception as e:
    # Error during module import or other setup.
    # Ensure output goes to stderr.
    sys.stdout = sys.stderr
    sys.stderr.write(f"Error importing module {target_module_name} or during initial setup: {str(e)}\\n")
    traceback.print_exc(file=sys.stderr)
    sys.stdout = original_stdout # Restore for finally block consistency
    sys.exit(1)
finally:
    # Ensure sys.stdout is restored to its original state before exiting.
    # This is good practice, though effect might be minimal in docker exec.
    sys.stdout = original_stdout
PYTHON_SCRIPT_EOF
`;
			await fs.writeFile(wrapperPath, wrapperContent);
			await fs.chmod(wrapperPath, "755");
			recordTiming(
				"Python runner script (_runner.py) written to host app directory"
			);
		} else if (runtimeType === "golang") {
			const wrapperPath = path.join(funcAppDir, "_runner.sh");
			const wrapperContent = `#!/bin/sh
# Source environment variables if the file exists
if [ -f /app/.shsf_env ]; then
    . /app/.shsf_env
    echo "[SHSF RUNNER] Sourced environment from /app/.shsf_env" >&2
else
    echo "[SHSF RUNNER] Warning: No .shsf_env file found" >&2
fi

# Execute the compiled Go binary with payload file path as argument
/app/_shsf_runner "$@"
`;
			await fs.writeFile(wrapperPath, wrapperContent);
			await fs.chmod(wrapperPath, "755");
			recordTiming(
				"Go runner script (_runner.sh) written to host app directory"
			);
		} else {
			console.warn(
				`[executeFunction] Runner script generation skipped: Unsupported runtime type '${runtimeType}' for function ${functionData.id}.`
			);
		}

		// Always generate/update the init.sh script
		if (runtimeType === "python") {
			// Add ffmpeg installation if requested
			if (functionData.ffmpeg_install) {
				initScript += `
      echo "[SHSF INIT] Checking ffmpeg installation..."
      if [ ! -f ".already_installed_ffmpeg" ]; then
          command -v ffmpeg >/dev/null 2>&1 || (apt update && apt-get install -y ffmpeg && touch /app/.already_installed_ffmpeg)
      else
          echo "[SHSF INIT] ffmpeg already installed (marker file present)."
      fi
      echo "[SHSF INIT] ffmpeg check complete."
      `;
			}

			initScript += `
if [ -f "requirements.txt" ]; then 
	echo "[SHSF INIT] Setting up Python environment for function ${functionData.id}"
	VENV_DIR="/pip-cache/venv/function-${functionData.id}" 
	HASH_FILE="/pip-cache/hashes/function-${functionData.id}/req.hash"
	PIP_PKG_CACHE_DIR="/pip-cache/pip_packages_cache"
	mkdir -p "$(dirname "$VENV_DIR")" "$(dirname "$HASH_FILE")" "$PIP_PKG_CACHE_DIR"
	REQUIREMENTS_HASH=$(md5sum requirements.txt | awk '{print $1}')
	NEEDS_UPDATE=0
	if [ ! -d "$VENV_DIR" ]; then NEEDS_UPDATE=1; echo "[SHSF INIT] No venv. Creating."; fi
	if [ ! -f "$HASH_FILE" ] || [ "$(cat "$HASH_FILE" 2>/dev/null)" != "$REQUIREMENTS_HASH" ]; then NEEDS_UPDATE=1; echo "[SHSF INIT] Hash mismatch. Updating."; fi
	
	if [ $NEEDS_UPDATE -eq 1 ]; then
		rm -rf "$VENV_DIR"
		python -m venv "$VENV_DIR"
		. "$VENV_DIR/bin/activate"
		pip install --upgrade pip
		if pip install --cache-dir "$PIP_PKG_CACHE_DIR" -r requirements.txt; then
			echo "$REQUIREMENTS_HASH" > "$HASH_FILE"
			echo "[SHSF INIT] Python dependencies installed."
		else
			echo "[SHSF INIT] Error installing Python dependencies." >&2
			exit 1
		fi
	else
		echo "[SHSF INIT] Python venv up-to-date."
	fi
	. "$VENV_DIR/bin/activate" # Ensure activated for subsequent exec
	
	# Create a persistent environment file that can be sourced during execution
	echo "export PATH=$VENV_DIR/bin:\$PATH" > /app/.shsf_env
	echo "export PYTHONPATH=/app:\$PYTHONPATH" >> /app/.shsf_env
	echo "export VIRTUAL_ENV=$VENV_DIR" >> /app/.shsf_env
fi
echo "[SHSF INIT] Python setup complete."
`;
		} else if (runtimeType === "golang") {
			// Add ffmpeg installation if requested
			if (functionData.ffmpeg_install) {
				initScript += `
      echo "[SHSF INIT] Checking ffmpeg installation..."
      if [ ! -f ".already_installed_ffmpeg" ]; then
          command -v ffmpeg >/dev/null 2>&1 || (apt update && apt-get install -y ffmpeg && touch /app/.already_installed_ffmpeg)
      else
          echo "[SHSF INIT] ffmpeg already installed (marker file present)."
      fi
      echo "[SHSF INIT] ffmpeg check complete."
      `;
			}

			initScript += `
echo "[SHSF INIT] Setting up Go environment for function ${functionData.id}"
BIN_DIR="/go-cache/bin/function-${functionData.id}"
HASH_FILE="/go-cache/hashes/function-${functionData.id}/go.hash"
GO_PKG_CACHE_DIR="/go-cache/go_packages_cache"
mkdir -p "$(dirname "$BIN_DIR")" "$(dirname "$HASH_FILE")" "$GO_PKG_CACHE_DIR"

# Calculate hash of all Go files
GO_HASH=$(find . -name "*.go" -type f | sort | xargs cat | md5sum | awk '{print $1}')
if [ -f "go.mod" ]; then
	if [ -f "go.sum" ]; then
		GO_HASH=$(cat go.mod go.sum | md5sum | awk '{print $1}')-$GO_HASH
	else
		GO_HASH=$(md5sum go.mod | awk '{print $1}')-$GO_HASH
	fi
fi

NEEDS_BUILD=0
if [ ! -f "$BIN_DIR/_shsf_runner" ]; then NEEDS_BUILD=1; echo "[SHSF INIT] No binary. Building."; fi
if [ ! -f "$HASH_FILE" ] || [ "$(cat "$HASH_FILE" 2>/dev/null)" != "$GO_HASH" ]; then NEEDS_BUILD=1; echo "[SHSF INIT] Hash mismatch. Rebuilding."; fi

if [ $NEEDS_BUILD -eq 1 ]; then
	export GOCACHE="$GO_PKG_CACHE_DIR"
	export GOMODCACHE="$GO_PKG_CACHE_DIR/mod"
	
	# Run go mod tidy to add missing dependencies from imports
	if [ -f "go.mod" ]; then
		echo "[SHSF INIT] Running go mod tidy to resolve dependencies..."
		if go mod tidy; then
			echo "[SHSF INIT] Dependencies resolved."
		else
			echo "[SHSF INIT] Error running go mod tidy." >&2
			exit 1
		fi
	fi
	
	# Download dependencies if go.mod exists
	if [ -f "go.mod" ]; then
		if go mod download; then
			echo "[SHSF INIT] Go dependencies downloaded."
		else
			echo "[SHSF INIT] Error downloading Go dependencies." >&2
			exit 1
		fi
	fi
	
	# Build the runner binary
	if go build -o "$BIN_DIR/_shsf_runner" .; then
		cp "$BIN_DIR/_shsf_runner" /app/_shsf_runner
		chmod +x /app/_shsf_runner
		echo "$GO_HASH" > "$HASH_FILE"
		echo "[SHSF INIT] Go binary built successfully."
	else
		echo "[SHSF INIT] Error building Go binary." >&2
		exit 1
	fi
else
	echo "[SHSF INIT] Go binary up-to-date."
	# Copy the cached binary to /app in case it's missing
	if [ ! -f "/app/_shsf_runner" ]; then
		cp "$BIN_DIR/_shsf_runner" /app/_shsf_runner
		chmod +x /app/_shsf_runner
	fi
fi

# Create a persistent environment file that can be sourced during execution
echo "export GOCACHE=$GO_PKG_CACHE_DIR" > /app/.shsf_env
echo "export GOMODCACHE=$GO_PKG_CACHE_DIR/mod" >> /app/.shsf_env
echo "export PATH=/app:\$PATH" >> /app/.shsf_env
echo "[SHSF INIT] Go setup complete."
`;
		} else {
			// This was already checked for runner script, but as a safeguard for init.sh:
			console.warn(
				`[executeFunction] init.sh script generation skipped: Unsupported runtime type '${runtimeType}' for function ${functionData.id}.`
			);
			// Potentially throw an error if an unsupported runtime should halt execution.
			// throw new Error(`Unsupported runtime type for init script generation: ${runtimeType}`);
		}
		initScript +=
			"\necho '[SHSF INIT] Environment setup finished successfully.'\n";
		await fs.writeFile(path.join(funcAppDir, "init.sh"), initScript);
		await fs.chmod(path.join(funcAppDir, "init.sh"), "755");
		recordTiming("init.sh script generated on host");

		// Check if any file contains _db_com, and if so, setup DB communication
		const requiresDbCom = files.some((file) => file.content.includes("_db_com"));
		if (requiresDbCom) {
			// Get or create a shared 24-hour token for this user's functions
			dbAccessToken = await getOrCreateFunctionDbToken(functionData.userId);
			recordTiming("Database access token retrieved/created");

			// Add Database Communication Script based on runtime
			if (runtimeType === "python") {
				const dbScript = DbComScriptPY.replace("{{API}}", API_URL!).replace(
					"{{AUTHKEY}}",
					dbAccessToken
				);
				await fs.writeFile(path.join(funcAppDir, "_db_com.py"), dbScript);
				await fs.chmod(path.join(funcAppDir, "_db_com.py"), "755");
				recordTiming("Database communication script (Python) generated on host");
			} else if (runtimeType === "golang") {
				const dbScript = DbComScriptGO.replace("{{API}}", API_URL!).replace(
					"{{AUTHKEY}}",
					dbAccessToken
				);
				await fs.writeFile(path.join(funcAppDir, "_db_com.go"), dbScript);
				await fs.chmod(path.join(funcAppDir, "_db_com.go"), "755");
				recordTiming("Database communication script (Golang) generated on host");
			}
		}

		try {
			const inspectInfo = await container.inspect();
			if (!inspectInfo.State.Running) {
				recordTiming("Starting existing stopped container");
				await container.start();
				recordTiming("Container started");
			} else {
				recordTiming("Found existing running container");
			}
			
			// For existing containers, ensure init.sh runs again to rebuild if needed
			// This ensures Go binaries are always up-to-date
			if (runtimeType === "golang") {
				recordTiming("Running init.sh on existing container");
				const initExec = await container.exec({
					Cmd: ["/bin/sh", "/app/init.sh"],
					AttachStdout: true,
					AttachStderr: true,
				});
				const initStream = await initExec.start({ hijack: true, stdin: false });
				const initOutput = { stdout: "", stderr: "" };
				
				const initStdout = new PassThrough();
				const initStderr = new PassThrough();
				
				initStdout.on("data", (chunk) => {
					initOutput.stdout += chunk.toString("utf8");
				});
				initStderr.on("data", (chunk) => {
					initOutput.stderr += chunk.toString("utf8");
				});
				
				docker.modem.demuxStream(initStream, initStdout, initStderr);
				
				await new Promise<void>((resolve) => {
					initStream.on("end", resolve);
				});
				
				console.log("[SHSF Init Output]:", initOutput.stderr);
				recordTiming("Init script executed on existing container");
			}
		} catch (error: any) {
			if (error.statusCode === 404) {
				// Container not found, create it
				containerJustCreated = true;
				recordTiming("Container not found, preparing for creation");

				// Cache directories setup on host (ensure these base paths exist)
				const baseCacheDir = "/opt/shsf_data/cache"; // Centralized cache on host
				await fs.mkdir(baseCacheDir, { recursive: true });
				const pipCacheHost = path.join(baseCacheDir, "pip");
				const goCacheHost = path.join(baseCacheDir, "go");

				await Promise.all([
					fs.mkdir(pipCacheHost, { recursive: true }),
					fs.mkdir(goCacheHost, { recursive: true })
				]);
				recordTiming("Host cache directories ensured");

				// Mount the base function directory which contains both app/ and executions/
				const funcBaseDir = path.join("/opt/shsf_data/functions", functionIdStr);
				// Mount /app and /executions separately instead of the old /function_data
				let BINDS: string[] = [
					`${funcBaseDir}/app:/app`,
					`${funcBaseDir}/executions:/executions`,
				];

				if (functionData.docker_mount) {
					BINDS.push("/var/run/docker.sock:/var/run/docker.sock"); // Mount Docker socket
				}

				if (runtimeType === "python") {
					BINDS.push(`${pipCacheHost}:/pip-cache`); // Mount persistent pip cache
				} else if (runtimeType === "golang") {
					BINDS.push(`${goCacheHost}:/go-cache`); // Mount persistent go cache
				} else {
					throw new Error(
						`Unsupported runtime type for container BIND setup: ${runtimeType}`
					);
				}

				// Image pull logic (same as original)
				const imageStart = Date.now();
				let imagePulled = false;
				try {
					const imageExists = await docker.listImages({
						filters: JSON.stringify({ reference: [functionData.image] }),
					});
					if (imageExists.length === 0) {
						imagePulled = true;
						recordTiming("Pulling image: " + functionData.image);
						const pullStream = await docker.pull(functionData.image);
						await new Promise((resolve, reject) => {
							docker.modem.followProgress(pullStream, (err) =>
								err ? reject(err) : resolve(null)
							);
						});
					}
				} catch (imgError) {
					console.error("Error checking or pulling image:", imgError);
					throw imgError;
				}
				recordTiming(imagePulled ? "Image pull complete" : "Image check complete");

				const initialEnv = functionData.env
					? JSON.parse(functionData.env).map(
							(env: { name: string; value: any }) => `${env.name}=${env.value}`
					  )
					: [];

				container = await docker.createContainer({
					Image: functionData.image,
					name: containerName,
					Env: initialEnv,
					HostConfig: {
						Binds: BINDS,
						AutoRemove: false, // CRITICAL: Container is persistent
						Memory: (functionData.max_ram || 128) * 1024 * 1024,
					},
					// Run init.sh once, then keep container alive
					Cmd: [
						"/bin/sh",
						"-c",
						"/app/init.sh && echo '[SHSF] Container initialized and idling.' && tail -f /dev/null",
					],
					Tty: false, // No TTY needed for background container
				});
				recordTiming("Container created");
				await container.start();
				recordTiming("New container started after init");
			} else {
				// Some other error inspecting container
				throw error;
			}
		}

		// At this point, container is running (either existing or newly created and initialized)
		// Now, execute the function logic using docker exec

		// Write payload to a unique file for this execution to avoid race conditions
		const payloadFilePath = path.join(executionDir, "payload.json");
		await fs.writeFile(payloadFilePath, payload);
		recordTiming("Payload written to unique execution file");

		const execEnv: string[] = []; // Remove RUN_DATA from env
		// Add function-specific env vars to exec as well, in case they are needed by the runner script directly
		// and not just by the init.sh environment.
		if (functionData.env) {
			try {
				const parsedEnv = JSON.parse(functionData.env);
				if (Array.isArray(parsedEnv)) {
					parsedEnv.forEach((envVar: { name: string; value: any }) =>
						execEnv.push(`${envVar.name}=${envVar.value}`)
					);
				}
			} catch (e) {
				console.error("Failed to parse functionData.env for exec:", e);
			}
		}

		// Pass the unique payload file path as an argument to the runner script
		const containerPayloadPath = `/executions/${executionId}/payload.json`; // Updated to use /executions mount
		let execCmd: string[];
		if (runtimeType === "python") {
			execCmd = ["/bin/sh", "/app/_runner.py", containerPayloadPath];
		} else if (runtimeType === "golang") {
			execCmd = ["/bin/sh", "/app/_runner.sh", containerPayloadPath];
		} else {
			throw new Error(
				`Unsupported runtime type for exec command: ${runtimeType}`
			);
		}

		const exec = await container.exec({
			Cmd: execCmd,
			Env: execEnv,
			AttachStdout: true,
			AttachStderr: true,
			Tty: false,
		});
		recordTiming("Exec created");

		const execStream = await exec.start({ hijack: true, stdin: false });
		recordTiming("Exec started");

		const execOutput = { stdout: "", stderr: "" };
		const MAX_OUTPUT_SIZE = 3 * 1024 * 1024; // 3MB limit to stay under Docker's 4MB limit
		let stdoutTruncated = false;
		let stderrTruncated = false;

		const stdoutMultiplex = new PassThrough();
		const stderrMultiplex = new PassThrough();

		stdoutMultiplex.on("data", (chunk) => {
			const text = chunk.toString("utf8");
			if (execOutput.stdout.length + text.length <= MAX_OUTPUT_SIZE) {
				execOutput.stdout += text;
			} else if (!stdoutTruncated) {
				const remaining = MAX_OUTPUT_SIZE - execOutput.stdout.length;
				if (remaining > 0) {
					execOutput.stdout += text.substring(0, remaining);
				}
				execOutput.stdout +=
					"\n[SHSF TRUNCATED] Output exceeded 3MB limit and was truncated";
				stdoutTruncated = true;
			}
		});

		stderrMultiplex.on("data", (chunk) => {
			const text = chunk.toString("utf8");
			if (execOutput.stderr.length + text.length <= MAX_OUTPUT_SIZE) {
				execOutput.stderr += text;
			} else if (!stderrTruncated) {
				const remaining = MAX_OUTPUT_SIZE - execOutput.stderr.length;
				if (remaining > 0) {
					execOutput.stderr += text.substring(0, remaining);
				}
				execOutput.stderr +=
					"\n[SHSF TRUNCATED] Logs exceeded 3MB limit and were truncated";
				stderrTruncated = true;
			}

			if (stream.enabled && !stderrTruncated) {
				const ansiRegex = /\x1B\[[0-9;]*[A-Za-z]/g;
				const nonPrintableRegex = /[^\x20-\x7E\n\r\t]/g;
				const cleanText = text
					.replace(ansiRegex, "")
					.replace(nonPrintableRegex, "");
				stream.onChunk(cleanText);
			}
		});

		docker.modem.demuxStream(execStream, stdoutMultiplex, stderrMultiplex);

		const execTimeoutMs = (functionData.timeout || 15) * 1000; // functionData.timeout is in seconds

		const execPromise = new Promise<Docker.ExecInspectInfo>((resolve, reject) => {
			execStream.on("end", () => {
				exec.inspect().then(resolve).catch(reject);
			});
			execStream.on("error", reject);
		});

		const timeoutPromise = new Promise<Docker.ExecInspectInfo>((_, reject) =>
			setTimeout(
				() =>
					reject(new Error(`Execution timed out after ${execTimeoutMs / 1000}s`)),
				execTimeoutMs
			)
		);

		let execResultDetails: Docker.ExecInspectInfo;
		try {
			execResultDetails = await Promise.race([execPromise, timeoutPromise]);
			exitCode = execResultDetails.ExitCode ?? 1; // Default to 1 if null/undefined
			logs = execOutput.stderr;
			if (exitCode === 0 && execOutput.stdout) {
				func_result = execOutput.stdout.trim();
			} else if (exitCode !== 0) {
				// Combine outputs but respect size limits
				const combinedOutput = `Exit Code: ${exitCode}\n${execOutput.stderr}\n${execOutput.stdout}`;
				logs =
					combinedOutput.length > MAX_OUTPUT_SIZE
						? combinedOutput.substring(0, MAX_OUTPUT_SIZE) +
						  "\n[SHSF TRUNCATED] Combined output exceeded 3MB limit"
						: combinedOutput;
				console.error(
					`[executeFunction] Exec failed with code ${exitCode}. Logs truncated due to size.`
				);
			}
		} catch (execError: any) {
			console.error(
				"[executeFunction] Exec failed or timed out:",
				execError.message
			);
			logs = `${execOutput.stderr}\nExecution Error: ${execError.message}`;
			exitCode = -1;
			func_result = "";
		}
		recordTiming("Container execution via exec finished");
		// Process result if successful
		let parsedResult: any = null;
		if (exitCode === 0 && func_result) {
			try {
				// Look for the function result markers
				const startMarker = "SHSF_FUNCTION_RESULT_START";
				const endMarker = "SHSF_FUNCTION_RESULT_END";
				const startIdx = func_result.indexOf(startMarker);
				const endIdx = func_result.lastIndexOf(endMarker);

				if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
					// Ensure markers are present and in correct order
					// Extract only the content between markers
					const actualResult = func_result
						.substring(startIdx + startMarker.length, endIdx)
						.trim();

					// Content before or after markers in stdout is now unexpected, but log it as a warning if it occurs.
					const prefix = func_result.substring(0, startIdx).trim();
					if (prefix) {
						logs += `\n[Runner Warning] Unexpected content before result marker in stdout: ${prefix}`;
					}

					const suffix = func_result.substring(endIdx + endMarker.length).trim();
					if (suffix) {
						logs += `\n[Runner Warning] Unexpected content after result marker in stdout: ${suffix}`;
					}

					parsedResult = JSON.parse(actualResult);
				} else {
					// If no markers are found, or they are in the wrong order,
					// treat the entire stdout as potential logging output.
					console.warn(
						`[executeFunction] Function result markers not found or in wrong order in stdout. Treating stdout as logs.`
					);
					if (func_result.trim()) {
						logs += `\nStdout content (no valid markers found):\n${func_result.trim()}`;
					}
					// No parsedResult, leave it as null
				}
			} catch (e: any) {
				console.error(
					`[executeFunction] Failed to parse JSON result from stdout: ${e.message}. Raw stdout content: ${func_result}`
				);
				logs += `\nError parsing result JSON from stdout: ${e.message}`;
				exitCode = -2; // Custom code for result parsing error
			}
		}

		tooks.push({
			timestamp: Date.now(),
			value: (Date.now() - starting_time) / 1000,
			description: "Total execution time (including potential setup)",
		});

		// No longer revoke the token after execution - it's shared and long-lived
		// Token will expire automatically after 24 hours

		return {
			logs,
			result: parsedResult, // Return parsed object or null
			tooks,
			exit_code: exitCode,
		};
	} catch (error: any) {
		console.error(
			`[executeFunction] Critical error during execution of function ${id}:`,
			error
		);
		recordTiming("Critical error occurred");
		tooks.push({
			timestamp: Date.now(),
			value: (Date.now() - starting_time) / 1000,
			description: "Total execution time until error",
		});
		return {
			logs: `${logs}\nCritical Error: ${error.message}\n${error.stack}`,
			result: "Sorry, an error occurred during execution.",
			tooks,
			exit_code: error.statusCode || -3, // Custom code for unhandled errors
		};
	} finally {
		recordTiming("Finalizing execution log");

		// Clean up the unique execution directory
		try {
			await fs.rm(executionDir, { recursive: true, force: true });
			recordTiming("Cleaned up execution directory");
		} catch (cleanupError: any) {
			if (cleanupError.code === "EACCES") {
				console.error(
					`[executeFunction] Permission denied when cleaning up execution directory ${executionDir}:`,
					cleanupError
				);
			} else if (cleanupError.code === "EBUSY") {
				console.error(
					`[executeFunction] Directory in use, could not clean up execution directory ${executionDir}:`,
					cleanupError
				);
			} else {
				console.error(
					`[executeFunction] Error cleaning up execution directory ${executionDir}:`,
					cleanupError
				);
			}
		}

		// Container and funcAppDir are not removed here as they are persistent.
		// Cleanup of old/unused containers/directories would be a separate process/tool.

		console.log(
			`[SHSF CRONS] Function ${functionData.id} (${
				functionData.name
			}) processed. Resulting exit code: ${exitCode}. Total time: ${
				(Date.now() - starting_time) / 1000
			} seconds`
		);

		try {
			await prisma.function.update({
				where: { id },
				data: { lastRun: new Date() },
			});
		} catch (dbError) {
			console.error("Error updating function lastRun:", dbError);
		}

		try {
			// Ensure func_result is a string for the DB, even if it's an error message or empty
			const resultForDb =
				typeof func_result === "string" && func_result !== ""
					? func_result
					: JSON.stringify(null);
			const DB_FIELD_LIMIT = 10000; // Reasonable DB field size limit

			await prisma.triggerLog.create({
				data: {
					functionId: id,
					logs:
						logs.length > DB_FIELD_LIMIT
							? logs.substring(0, DB_FIELD_LIMIT) + "...[truncated for DB]"
							: logs,
					result: JSON.stringify({
						exit_code: exitCode,
						tooks: tooks,
						output:
							resultForDb.length > DB_FIELD_LIMIT
								? resultForDb.substring(0, DB_FIELD_LIMIT) + "...[truncated for DB]"
								: resultForDb,
						payload:
							payload.length > DB_FIELD_LIMIT
								? payload.substring(0, DB_FIELD_LIMIT) + "...[truncated for DB]"
								: payload,
					}),
				},
			});
		} catch (error) {
			console.error("Error creating trigger log:", error);
		}
	}
}

export async function buildPayloadFromGET(
	ctr: DataContext<
		"HttpRequest",
		"GET",
		HttpRequestContext<{}>,
		UsableMiddleware<{}>[]
	>
): Promise<{
	headers: Record<string, string>;
	queries: Record<string, string>;
	source_ip: string;
	route: string | "default";
	method: string;
}> {
	return {
		headers: Object.fromEntries(ctr.headers.entries()),
		queries: Object.fromEntries(ctr.queries.entries()),
		source_ip: ctr.client.ip.usual(),
		route: ctr.params.get("route") || "default",
		method: "GET",
	};
}

export async function buildPayloadFromPOST(
	ctr: DataContext<
		"HttpRequest",
		"POST",
		HttpRequestContext<{}>,
		UsableMiddleware<{}>[]
	>
): Promise<{
	headers: Record<string, string>;
	body: string;
	queries: Record<string, string>;
	source_ip: string;
	route: string | "default";
	raw_body: string;
	method: string;
}> {
	return {
		headers: Object.fromEntries(ctr.headers.entries()),
		queries: Object.fromEntries(ctr.queries.entries()),
		body: await ctr.rawBody("utf-8"),
		raw_body: await ctr.rawBody("binary"),
		source_ip: ctr.client.ip.usual(),
		route: ctr.params.get("route") || "default",
		method: "POST",
	};
}

export async function installDependencies(
	functionId: number,
	functionData: any,
	files: any[]
): Promise<boolean | 404> {
	const docker = new Docker();
	const functionIdStr = String(functionId);
	const containerName = `shsf_func_${functionIdStr}`;

	try {
		let container = docker.getContainer(containerName);

		try {
			const inspectInfo = await container.inspect();
			if (!inspectInfo.State.Running) {
				await container.start();
			}
		} catch (error: any) {
			if (error.statusCode === 404) {
				return 404; // We cant run it, as we dont know what it does.
			} else {
				throw error;
			}
		}

		const execEnv: string[] = functionData.env
			? JSON.parse(functionData.env).map(
					(env: { name: string; value: any }) => `${env.name}=${env.value}`
			  )
			: [];

		console.log(
			"[SHSF] Starting dependency installation for function:",
			functionId
		);

		const exec = await container.exec({
			Cmd: [
				"/bin/sh",
				"-c",
				"cd /app && if [ -f requirements.txt ]; then pip install --user -r requirements.txt; else echo 'No requirements.txt found.'; fi",
			],
			Env: execEnv,
			AttachStdout: true,
			AttachStderr: true,
			Tty: false,
		});

		console.log("[SHSF] Exec command created for dependency installation.");

		const execStream = await exec.start({ hijack: true, stdin: false });

		console.log("[SHSF] Exec stream started for dependency installation.");

		// // Log the stream output
		// const execOutput = { stdout: "", stderr: "" };
		// execStream.on("data", (chunk) => {
		// 	const text = chunk.toString("utf8");
		// 	execOutput.stdout += text;
		// 	console.log("[SHSF] Exec stdout:", text.trim());
		// });
		// execStream.on("error", (chunk) => {
		// 	const text = chunk.toString();
		// 	execOutput.stderr += text;
		// 	console.error("[SHSF] Exec stderr:", text.trim());
		// });

		// Consume the stream to completion (required for exec to finish)
		await new Promise<void>((resolve, reject) => {
			execStream.on("end", () => {
				// console.log("[SHSF] Exec stream ended for dependency installation.");
				resolve();
			});
			execStream.on("error", (error) => {
				// console.error("[SHSF] Exec stream error during dependency installation:", error);
				reject(error);
			});
			// Drain the stream
			execStream.resume();
		});

		// Inspect the exec to get the exit code
		const inspect = await exec.inspect();
		console.log("[SHSF] Exec inspection completed. Exit code:", inspect.ExitCode);

		if (inspect.ExitCode === 0) {
			console.log(
				"[SHSF] Dependency installation completed successfully for function:",
				functionId
			);
			return true;
		} else {
			console.error(
				"[SHSF] Dependency installation failed for function:",
				functionId,
				"Exit code:",
				inspect.ExitCode
			);
			return false;
		}
	} catch (error) {
		console.error("Error installing dependencies:", error);
		return false;
	}
}

// Helper function to clean up container when deleting a function
export async function cleanupFunctionContainer(functionId: number) {
	const functionIdStr = String(functionId);
	const containerName = `shsf_func_${functionIdStr}`;
	const funcAppDir = path.join("/opt/shsf_data/functions", functionIdStr);

	try {
		const docker = new Docker();
		// Try to stop and remove the container if it exists
		try {
			const container = docker.getContainer(containerName);
			const containerInfo = await container.inspect();

			if (containerInfo.State.Running) {
				console.log(`[SHSF] Stopping container for function ${functionId}`);
				await container.kill({ t: 10 }); // 10-second timeout
			}

			console.log(`[SHSF] Removing container for function ${functionId}`);
			await container.remove();
		} catch (containerError: any) {
			if (containerError.statusCode !== 404) {
				console.error(
					`[SHSF] Error removing container for function ${functionId}:`,
					containerError
				);
			} else {
				console.log(
					`[SHSF] Container for function ${functionId} not found, skipping removal`
				);
			}
		}

		// Remove the function directory
		try {
			console.log(`[SHSF] Removing function directory: ${funcAppDir}`);
			await fs.rm(funcAppDir, { recursive: true, force: true });
		} catch (dirError) {
			console.error(
				`[SHSF] Error removing function directory ${funcAppDir}:`,
				dirError
			);
		}

		// Clean up cache directories
		try {
			// Python venv
			const pipCacheDir = `/opt/shsf_data/cache/pip/venv/function-${functionId}`;
			if (fsSync.existsSync(pipCacheDir)) {
				await fs.rm(pipCacheDir, { recursive: true, force: true });
			}

			// Pip hash
			const pipHashDir = `/opt/shsf_data/cache/pip/hashes/function-${functionId}`;
			if (fsSync.existsSync(pipHashDir)) {
				await fs.rm(pipHashDir, { recursive: true, force: true });
			}
		} catch (cacheError) {
			console.error(
				`[SHSF] Error cleaning up cache directories for function ${functionId}:`,
				cacheError
			);
		}

		return true;
	} catch (error) {
		console.error(
			`[SHSF] Error during container cleanup for function ${functionId}:`,
			error
		);
		return false;
	}
}
