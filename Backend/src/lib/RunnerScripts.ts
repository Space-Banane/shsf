export const DbComScriptPY = `# Database Communication Script
# GENERATED ON THE FLY - DO NOT EDIT - THIS WILL BE OVERWRITTEN ON THE NEXT RUN
import json
import os
import time
import uuid
from typing import Any, Optional, Dict, List

REQUEST_DIR = os.environ.get("SHSF_STORAGE_REQUEST_DIR", "/executions/storage-requests")
RESPONSE_DIR = os.environ.get("SHSF_STORAGE_RESPONSE_DIR", "/executions/storage-responses")


class DatabaseError(Exception):
    """Custom exception for database operations"""
    pass


class Database:
    """
    Database class for interacting with the SHSF storage bridge.

    Usage:
        from _db_com import database
        db = database()
        db.set("storage1", "name", "Paul")
        print(db.get("storage1", "name"))
    """

    def __init__(self, timeout_seconds: float = 30.0):
        self.request_dir = REQUEST_DIR
        self.response_dir = RESPONSE_DIR
        self.timeout_seconds = timeout_seconds

    def _make_request(self, operation: str, args: Optional[Dict[str, Any]] = None) -> Any:
        request_id = uuid.uuid4().hex
        request_path = os.path.join(self.request_dir, f"{request_id}.json")
        temp_request_path = request_path + ".tmp"
        response_path = os.path.join(self.response_dir, f"{request_id}.json")

        os.makedirs(self.request_dir, exist_ok=True)
        os.makedirs(self.response_dir, exist_ok=True)

        with open(temp_request_path, "w", encoding="utf-8") as f:
            json.dump({"id": request_id, "operation": operation, "args": args or {}}, f)
        os.replace(temp_request_path, request_path)

        deadline = time.time() + self.timeout_seconds
        while time.time() < deadline:
            if os.path.exists(response_path):
                with open(response_path, "r", encoding="utf-8") as f:
                    response = json.load(f)
                try:
                    os.remove(response_path)
                except OSError:
                    pass

                if isinstance(response, dict) and response.get("status") == "OK":
                    return response.get("data")
                message = response.get("message", "Unknown storage error") if isinstance(response, dict) else "Invalid storage response"
                raise DatabaseError(message)
            time.sleep(0.01)

        raise DatabaseError("Timed out waiting for storage response")

    def create_storage(self, name: str, purpose: str = "") -> Dict:
        return self._make_request("create_storage", {"name": name, "purpose": purpose})

    def list_storages(self) -> List[Dict]:
        return self._make_request("list_storages")

    def delete_storage(self, storage_name: str) -> Dict:
        return self._make_request("delete_storage", {"storageName": storage_name})

    def clear(self, storage_name: str) -> Dict:
        return self._make_request("clear", {"storageName": storage_name})

    def set(self, storage_name: str, key: str, value: Any,
            expires_at: Optional[str] = None) -> Dict:
        payload = {"storageName": storage_name, "key": key, "value": value}
        if expires_at is not None:
            payload["expiresAt"] = expires_at
        return self._make_request("set", payload)

    def get(self, storage_name: str, key: str) -> Any:
        return self._make_request("get", {"storageName": storage_name, "key": key})

    def get_item(self, storage_name: str, key: str) -> Dict:
        return self._make_request("get_item", {"storageName": storage_name, "key": key})

    def list_items(self, storage_name: str) -> List[Dict]:
        return self._make_request("list_items", {"storageName": storage_name})

    def delete_item(self, storage_name: str, key: str) -> Dict:
        return self._make_request("delete_item", {"storageName": storage_name, "key": key})

    def exists(self, storage_name: str, key: str) -> bool:
        return bool(self._make_request("exists", {"storageName": storage_name, "key": key}))


def database() -> Database:
    return Database()


# Alternative: Direct instantiation
# You can also use: db = Database()`;

export const DbComScriptGO = `// Database Communication Script in Go
// GENERATED ON THE FLY - DO NOT EDIT - THIS WILL BE OVERWRITTEN ON THE NEXT RUN

package dbcom

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"time"
)

// DatabaseError represents a storage bridge error.
type DatabaseError struct {
	Message string
}

func (e *DatabaseError) Error() string {
	return fmt.Sprintf("Storage Error: %s", e.Message)
}

// Database client.
type Database struct {
	requestDir  string
	responseDir string
	timeout     time.Duration
}

// New creates a new Database instance.
func New() *Database {
	requestDir := os.Getenv("SHSF_STORAGE_REQUEST_DIR")
	if requestDir == "" {
		requestDir = "/executions/storage-requests"
	}
	responseDir := os.Getenv("SHSF_STORAGE_RESPONSE_DIR")
	if responseDir == "" {
		responseDir = "/executions/storage-responses"
	}
	return &Database{
		requestDir:  requestDir,
		responseDir: responseDir,
		timeout:     30 * time.Second,
	}
}

type rpcRequest struct {
	ID        string                 ` + "`" + `json:"id"` + "`" + `
	Operation string                 ` + "`" + `json:"operation"` + "`" + `
	Args      map[string]interface{} ` + "`" + `json:"args"` + "`" + `
}

type rpcResponse struct {
	Status  string          ` + "`" + `json:"status"` + "`" + `
	Message string          ` + "`" + `json:"message,omitempty"` + "`" + `
	Data    json.RawMessage ` + "`" + `json:"data,omitempty"` + "`" + `
}

func requestID() string {
	return fmt.Sprintf("%d_%d", time.Now().UnixNano(), rand.Int63())
}

func (db *Database) makeRequest(operation string, args map[string]interface{}) ([]byte, error) {
	id := requestID()
	if args == nil {
		args = map[string]interface{}{}
	}

	if err := os.MkdirAll(db.requestDir, 0o755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(db.responseDir, 0o755); err != nil {
		return nil, err
	}

	requestPath := filepath.Join(db.requestDir, id+".json")
	tempRequestPath := requestPath + ".tmp"
	responsePath := filepath.Join(db.responseDir, id+".json")

	payload, err := json.Marshal(rpcRequest{ID: id, Operation: operation, Args: args})
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(tempRequestPath, payload, 0o644); err != nil {
		return nil, err
	}
	if err := os.Rename(tempRequestPath, requestPath); err != nil {
		return nil, err
	}

	deadline := time.Now().Add(db.timeout)
	for time.Now().Before(deadline) {
		raw, err := os.ReadFile(responsePath)
		if err == nil {
			_ = os.Remove(responsePath)
			var response rpcResponse
			if err := json.Unmarshal(raw, &response); err != nil {
				return nil, err
			}
			if response.Status != "OK" {
				if response.Message == "" {
					response.Message = "Unknown storage error"
				}
				return nil, &DatabaseError{Message: response.Message}
			}
			if len(response.Data) == 0 {
				return []byte("null"), nil
			}
			return response.Data, nil
		}
		time.Sleep(10 * time.Millisecond)
	}

	return nil, &DatabaseError{Message: "Timed out waiting for storage response"}
}

// CreateStorage creates a new storage.
func (db *Database) CreateStorage(name, purpose string) (map[string]interface{}, error) {
	resp, err := db.makeRequest("create_storage", map[string]interface{}{"name": name, "purpose": purpose})
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	json.Unmarshal(resp, &result)
	return result, nil
}

// ListStorages lists all storages.
func (db *Database) ListStorages() ([]map[string]interface{}, error) {
	resp, err := db.makeRequest("list_storages", nil)
	if err != nil {
		return nil, err
	}
	var result []map[string]interface{}
	json.Unmarshal(resp, &result)
	return result, nil
}

// DeleteStorage deletes a storage by name.
func (db *Database) DeleteStorage(name string) error {
	_, err := db.makeRequest("delete_storage", map[string]interface{}{"storageName": name})
	return err
}

// Clear clears all items in storage.
func (db *Database) Clear(name string) error {
	_, err := db.makeRequest("clear", map[string]interface{}{"storageName": name})
	return err
}

// Set creates or updates an item.
func (db *Database) Set(storageName, key string, value interface{}, expiresAt *string) (map[string]interface{}, error) {
	args := map[string]interface{}{"storageName": storageName, "key": key, "value": value}
	if expiresAt != nil {
		args["expiresAt"] = *expiresAt
	}
	resp, err := db.makeRequest("set", args)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	json.Unmarshal(resp, &result)
	return result, nil
}

// Get returns an item's value by key.
func (db *Database) Get(storageName, key string) (interface{}, error) {
	resp, err := db.makeRequest("get", map[string]interface{}{"storageName": storageName, "key": key})
	if err != nil {
		return nil, err
	}
	var result interface{}
	json.Unmarshal(resp, &result)
	return result, nil
}

// GetItem returns the full item object.
func (db *Database) GetItem(storageName, key string) (map[string]interface{}, error) {
	resp, err := db.makeRequest("get_item", map[string]interface{}{"storageName": storageName, "key": key})
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	json.Unmarshal(resp, &result)
	return result, nil
}

// ListItems lists all items in storage.
func (db *Database) ListItems(storageName string) ([]map[string]interface{}, error) {
	resp, err := db.makeRequest("list_items", map[string]interface{}{"storageName": storageName})
	if err != nil {
		return nil, err
	}
	var result []map[string]interface{}
	json.Unmarshal(resp, &result)
	return result, nil
}

// DeleteItem deletes an item by key.
func (db *Database) DeleteItem(storageName, key string) error {
	_, err := db.makeRequest("delete_item", map[string]interface{}{"storageName": storageName, "key": key})
	return err
}

// Exists checks if an item exists.
func (db *Database) Exists(storageName, key string) bool {
	resp, err := db.makeRequest("exists", map[string]interface{}{"storageName": storageName, "key": key})
	if err != nil {
		return false
	}
	var exists bool
	json.Unmarshal(resp, &exists)
	return exists
}
`;

export const DbComScriptCS = `// Database Communication Script in C#
// GENERATED ON THE FLY - DO NOT EDIT - THIS WILL BE OVERWRITTEN ON THE NEXT RUN
using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace SHSF;

public sealed class DatabaseError : Exception
{
    public DatabaseError(string message) : base(message) { }
}

public sealed class Database
{
    private readonly string _requestDir = Environment.GetEnvironmentVariable("SHSF_STORAGE_REQUEST_DIR") ?? "/executions/storage-requests";
    private readonly string _responseDir = Environment.GetEnvironmentVariable("SHSF_STORAGE_RESPONSE_DIR") ?? "/executions/storage-responses";
    private readonly TimeSpan _timeout = TimeSpan.FromSeconds(30);

    private async Task<JsonNode?> MakeRequestAsync(string operation, object? args = null)
    {
        Directory.CreateDirectory(_requestDir);
        Directory.CreateDirectory(_responseDir);

        var id = Guid.NewGuid().ToString("N");
        var requestPath = Path.Combine(_requestDir, id + ".json");
        var tempRequestPath = requestPath + ".tmp";
        var responsePath = Path.Combine(_responseDir, id + ".json");
        var request = JsonSerializer.Serialize(new { id, operation, args = args ?? new { } });
        await File.WriteAllTextAsync(tempRequestPath, request);
        File.Move(tempRequestPath, requestPath, true);

        var deadline = DateTime.UtcNow + _timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (File.Exists(responsePath))
            {
                var raw = await File.ReadAllTextAsync(responsePath);
                try { File.Delete(responsePath); } catch { }
                var response = JsonNode.Parse(raw);
                if (response is JsonObject obj && string.Equals(obj["status"]?.GetValue<string>(), "OK", StringComparison.OrdinalIgnoreCase))
                {
                    return obj["data"];
                }
                throw new DatabaseError(response?["message"]?.GetValue<string>() ?? "Unknown storage error");
            }
            await Task.Delay(10);
        }

        throw new DatabaseError("Timed out waiting for storage response");
    }

    public Task<JsonNode?> CreateStorage(string name, string purpose = "") =>
        MakeRequestAsync("create_storage", new { name, purpose });

    public Task<JsonNode?> ListStorages() =>
        MakeRequestAsync("list_storages");

    public Task<JsonNode?> DeleteStorage(string storageName) =>
        MakeRequestAsync("delete_storage", new { storageName });

    public Task<JsonNode?> Clear(string storageName) =>
        MakeRequestAsync("clear", new { storageName });

    public Task<JsonNode?> Set(string storageName, string key, object? value, string? expiresAt = null) =>
        MakeRequestAsync(
            "set",
            expiresAt is null
                ? new { storageName, key, value }
                : new { storageName, key, value, expiresAt }
        );

    public Task<JsonNode?> Get(string storageName, string key) =>
        MakeRequestAsync("get", new { storageName, key });

    public Task<JsonNode?> GetItem(string storageName, string key) =>
        MakeRequestAsync("get_item", new { storageName, key });

    public Task<JsonNode?> ListItems(string storageName) =>
        MakeRequestAsync("list_items", new { storageName });

    public Task<JsonNode?> DeleteItem(string storageName, string key) =>
        MakeRequestAsync("delete_item", new { storageName, key });

    public async Task<bool> Exists(string storageName, string key)
    {
        var result = await MakeRequestAsync("exists", new { storageName, key });
        return result?.GetValue<bool>() ?? false;
    }
}
`;

export const ShsfRuntimeScriptCS = `// SHSF runtime helper for C#
// GENERATED ON THE FLY - DO NOT EDIT - THIS WILL BE OVERWRITTEN ON THE NEXT RUN
using System;
using System.IO;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace SHSF;

internal static class RuntimeBootstrap
{
    [ModuleInitializer]
    internal static void Initialize()
    {
        Console.SetOut(Console.Error);
    }
}

public static class Runtime
{
    public static string PayloadPath =>
        Environment.GetEnvironmentVariable("SHSF_PAYLOAD_PATH")
        ?? (Environment.GetCommandLineArgs().Length > 1
            ? Environment.GetCommandLineArgs()[1]
            : throw new InvalidOperationException("SHSF payload path not provided."));

    public static string ResultPath =>
        Environment.GetEnvironmentVariable("SHSF_RESULT_PATH")
        ?? (Environment.GetCommandLineArgs().Length > 2
            ? Environment.GetCommandLineArgs()[2]
            : throw new InvalidOperationException("SHSF result path not provided."));

    public static string LoadPayload() => File.ReadAllText(PayloadPath);

    public static T? LoadPayloadJson<T>() =>
        JsonSerializer.Deserialize<T>(LoadPayload());

    public static void Return(object? value)
    {
        var tempPath = ResultPath + ".tmp";
        File.WriteAllText(tempPath, JsonSerializer.Serialize(value));
        File.Move(tempPath, ResultPath, true);
    }
}
`;
