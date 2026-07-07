import { randomBytes } from "crypto";
import { prisma } from "..";
import {
	FUNCTION_DB_TOKEN_EXPIRY_MS,
	SHSF_FUNCTION_RESULT_START,
	SHSF_FUNCTION_RESULT_END,
} from "./RunnerTypes";

export const DbComScriptPY = `# Database Communication Script
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

export const DbComScriptGO = `// Database Communication Script in Go
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

export const DbComScriptCS = `// Database Communication Script in C#
// GENERATED ON THE FLY - DO NOT EDIT - THIS WILL BE OVERWRITTEN ON THE NEXT RUN
using System;
using System.Net.Http;
using System.Text;
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
    private static readonly HttpClient Client = new();
    private readonly string _baseUrl = "{{API}}".TrimEnd('/');
    private readonly string _accessKey = "{{AUTHKEY}}";

    private async Task<JsonNode?> MakeRequestAsync(HttpMethod method, string path, object? payload = null)
    {
        using var request = new HttpRequestMessage(method, _baseUrl + path);
        request.Headers.TryAddWithoutValidation("X-Access-Key", _accessKey);

        if (payload is not null)
        {
            request.Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json"
            );
        }

        using var response = await Client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        JsonNode? parsed = null;

        if (!string.IsNullOrWhiteSpace(body))
        {
            parsed = JsonNode.Parse(body);
        }

        if (parsed is JsonObject obj && obj["status"] is not null)
        {
            var status = obj["status"]?.GetValue<string>();
            if (!string.Equals(status, "OK", StringComparison.OrdinalIgnoreCase))
            {
                throw new DatabaseError(obj["message"]?.GetValue<string>() ?? "Unknown error");
            }

            return obj["data"] ?? parsed;
        }

        if (!response.IsSuccessStatusCode)
        {
            throw new DatabaseError($"HTTP {(int)response.StatusCode}: {body}");
        }

        return parsed;
    }

    public Task<JsonNode?> CreateStorage(string name, string purpose = "") =>
        MakeRequestAsync(HttpMethod.Post, "/api/storage", new { name, purpose });

    public Task<JsonNode?> ListStorages() =>
        MakeRequestAsync(HttpMethod.Get, "/api/storage");

    public Task<JsonNode?> DeleteStorage(string storageName) =>
        MakeRequestAsync(HttpMethod.Delete, $"/api/storage/{Uri.EscapeDataString(storageName)}");

    public Task<JsonNode?> Clear(string storageName) =>
        MakeRequestAsync(HttpMethod.Delete, $"/api/storage/{Uri.EscapeDataString(storageName)}/items");

    public Task<JsonNode?> Set(string storageName, string key, object? value, string? expiresAt = null) =>
        MakeRequestAsync(
            HttpMethod.Post,
            $"/api/storage/{Uri.EscapeDataString(storageName)}/item",
            expiresAt is null
                ? new { key, value }
                : new { key, value, expiresAt }
        );

    public async Task<JsonNode?> Get(string storageName, string key)
    {
        var result = await MakeRequestAsync(
            HttpMethod.Get,
            $"/api/storage/{Uri.EscapeDataString(storageName)}/item/{Uri.EscapeDataString(key)}"
        );

        if (result is JsonObject obj && obj["value"] is not null)
        {
            return obj["value"];
        }

        return result;
    }

    public Task<JsonNode?> GetItem(string storageName, string key) =>
        MakeRequestAsync(
            HttpMethod.Get,
            $"/api/storage/{Uri.EscapeDataString(storageName)}/item/{Uri.EscapeDataString(key)}"
        );

    public Task<JsonNode?> ListItems(string storageName) =>
        MakeRequestAsync(HttpMethod.Get, $"/api/storage/{Uri.EscapeDataString(storageName)}/items");

    public Task<JsonNode?> DeleteItem(string storageName, string key) =>
        MakeRequestAsync(
            HttpMethod.Delete,
            $"/api/storage/{Uri.EscapeDataString(storageName)}/item/{Uri.EscapeDataString(key)}"
        );

    public async Task<bool> Exists(string storageName, string key)
    {
        try
        {
            await Get(storageName, key);
            return true;
        }
        catch (DatabaseError)
        {
            return false;
        }
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
    internal static readonly TextWriter OriginalStdout = new StreamWriter(Console.OpenStandardOutput())
    {
        AutoFlush = true
    };

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

    public static string LoadPayload() => File.ReadAllText(PayloadPath);

    public static T? LoadPayloadJson<T>() =>
        JsonSerializer.Deserialize<T>(LoadPayload());

    public static void Return(object? value)
    {
        RuntimeBootstrap.OriginalStdout.WriteLine("${SHSF_FUNCTION_RESULT_START}");
        RuntimeBootstrap.OriginalStdout.Write(JsonSerializer.Serialize(value));
        RuntimeBootstrap.OriginalStdout.WriteLine();
        RuntimeBootstrap.OriginalStdout.Write("${SHSF_FUNCTION_RESULT_END}");
        RuntimeBootstrap.OriginalStdout.Flush();
    }
}
`;

export async function getOrCreateFunctionDbToken(userId: number): Promise<string> {
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
