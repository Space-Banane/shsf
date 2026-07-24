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

export const DbComScriptJS = `// Database Communication Script for Node.js
// GENERATED ON THE FLY - DO NOT EDIT - THIS WILL BE OVERWRITTEN ON THE NEXT RUN
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REQUEST_DIR = process.env.SHSF_STORAGE_REQUEST_DIR || '/executions/storage-requests';
const RESPONSE_DIR = process.env.SHSF_STORAGE_RESPONSE_DIR || '/executions/storage-responses';

const _sleepBuf = new Int32Array(new SharedArrayBuffer(4));
function _sleepMs(ms) {
  Atomics.wait(_sleepBuf, 0, 0, ms);
}

class DatabaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatabaseError';
  }
}

class Database {
  constructor(timeoutMs = 30000) {
    this.timeoutMs = timeoutMs;
  }

  _makeRequest(operation, args = {}) {
    const requestId = crypto.randomBytes(16).toString('hex');
    const requestPath = path.join(REQUEST_DIR, requestId + '.json');
    const tmpPath = requestPath + '.tmp';
    const responsePath = path.join(RESPONSE_DIR, requestId + '.json');

    fs.mkdirSync(REQUEST_DIR, { recursive: true });
    fs.mkdirSync(RESPONSE_DIR, { recursive: true });

    fs.writeFileSync(tmpPath, JSON.stringify({ id: requestId, operation, args }), 'utf-8');
    fs.renameSync(tmpPath, requestPath);

    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      if (fs.existsSync(responsePath)) {
        const raw = fs.readFileSync(responsePath, 'utf-8');
        try { fs.unlinkSync(responsePath); } catch (_) {}
        const response = JSON.parse(raw);
        if (response.status === 'OK') return response.data;
        throw new DatabaseError(response.message || 'Unknown storage error');
      }
      _sleepMs(10);
    }
    throw new DatabaseError('Timed out waiting for storage response');
  }

  createStorage(name, purpose = '') { return this._makeRequest('create_storage', { name, purpose }); }
  listStorages() { return this._makeRequest('list_storages'); }
  deleteStorage(storageName) { return this._makeRequest('delete_storage', { storageName }); }
  clear(storageName) { return this._makeRequest('clear', { storageName }); }
  set(storageName, key, value, expiresAt) {
    const args = { storageName, key, value };
    if (expiresAt !== undefined) args.expiresAt = expiresAt;
    return this._makeRequest('set', args);
  }
  get(storageName, key) { return this._makeRequest('get', { storageName, key }); }
  getItem(storageName, key) { return this._makeRequest('get_item', { storageName, key }); }
  listItems(storageName) { return this._makeRequest('list_items', { storageName }); }
  deleteItem(storageName, key) { return this._makeRequest('delete_item', { storageName, key }); }
  exists(storageName, key) { return !!this._makeRequest('exists', { storageName, key }); }
}

function database() { return new Database(); }

module.exports = { Database, database, DatabaseError };
`;

export const CallFuncScriptPY = `# callF — inter-function call helper
# GENERATED ON THE FLY - DO NOT EDIT - THIS WILL BE OVERWRITTEN ON THE NEXT RUN
import json
import os
import time
import uuid
from typing import Any

_REQUEST_DIR = os.environ.get("SHSF_CALLFUNC_REQUEST_DIR", "/executions/callfunc-requests")
_RESPONSE_DIR = os.environ.get("SHSF_CALLFUNC_RESPONSE_DIR", "/executions/callfunc-responses")


class CallFuncError(Exception):
    pass


def callF(function_name: str, args: Any = None, timeout_seconds: float = 30.0) -> Any:
    """Call another function owned by the same user. Returns the function result."""
    request_id = uuid.uuid4().hex
    request_path = os.path.join(_REQUEST_DIR, f"{request_id}.json")
    temp_path = request_path + ".tmp"
    response_path = os.path.join(_RESPONSE_DIR, f"{request_id}.json")

    os.makedirs(_REQUEST_DIR, exist_ok=True)
    os.makedirs(_RESPONSE_DIR, exist_ok=True)

    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump({"id": request_id, "functionName": function_name, "args": args if args is not None else {}}, f)
    os.replace(temp_path, request_path)

    deadline = time.time() + timeout_seconds
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
            message = response.get("message", "callF failed") if isinstance(response, dict) else "Invalid callF response"
            raise CallFuncError(message)
        time.sleep(0.01)

    raise CallFuncError(f"callF timed out waiting for '{function_name}' after {timeout_seconds}s")
`;

export const CallFuncScriptGO = `// callF — inter-function call helper
// GENERATED ON THE FLY - DO NOT EDIT - THIS WILL BE OVERWRITTEN ON THE NEXT RUN

package callfunc

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"time"
)

// CallFuncError is returned when the target function fails or cannot be found.
type CallFuncError struct {
	Message string
}

func (e *CallFuncError) Error() string {
	return fmt.Sprintf("callF error: %s", e.Message)
}

func requestID() string {
	return fmt.Sprintf("%d_%d", time.Now().UnixNano(), rand.Int63())
}

func requestDir() string {
	if d := os.Getenv("SHSF_CALLFUNC_REQUEST_DIR"); d != "" {
		return d
	}
	return "/executions/callfunc-requests"
}

func responseDir() string {
	if d := os.Getenv("SHSF_CALLFUNC_RESPONSE_DIR"); d != "" {
		return d
	}
	return "/executions/callfunc-responses"
}

type callFuncRequest struct {
	ID           string      ` + "`" + `json:"id"` + "`" + `
	FunctionName string      ` + "`" + `json:"functionName"` + "`" + `
	Args         interface{} ` + "`" + `json:"args"` + "`" + `
}

type callFuncResponse struct {
	Status  string          ` + "`" + `json:"status"` + "`" + `
	Message string          ` + "`" + `json:"message,omitempty"` + "`" + `
	Data    json.RawMessage ` + "`" + `json:"data,omitempty"` + "`" + `
}

// CallF calls another function owned by the same user and returns its result.
// args is serialised into the called function's body field.
// timeout is how long to wait for the response (default 30s if zero).
func CallF(functionName string, args interface{}, timeout time.Duration) (interface{}, error) {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	id := requestID()
	reqDir := requestDir()
	respDir := responseDir()

	if err := os.MkdirAll(reqDir, 0o755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(respDir, 0o755); err != nil {
		return nil, err
	}

	payload, err := json.Marshal(callFuncRequest{ID: id, FunctionName: functionName, Args: args})
	if err != nil {
		return nil, err
	}

	reqPath := filepath.Join(reqDir, id+".json")
	tmpPath := reqPath + ".tmp"
	if err := os.WriteFile(tmpPath, payload, 0o644); err != nil {
		return nil, err
	}
	if err := os.Rename(tmpPath, reqPath); err != nil {
		return nil, err
	}

	respPath := filepath.Join(respDir, id+".json")
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		raw, err := os.ReadFile(respPath)
		if err == nil {
			_ = os.Remove(respPath)
			var resp callFuncResponse
			if err := json.Unmarshal(raw, &resp); err != nil {
				return nil, err
			}
			if resp.Status != "OK" {
				msg := resp.Message
				if msg == "" {
					msg = "callF failed"
				}
				return nil, &CallFuncError{Message: msg}
			}
			var result interface{}
			if len(resp.Data) > 0 {
				_ = json.Unmarshal(resp.Data, &result)
			}
			return result, nil
		}
		time.Sleep(10 * time.Millisecond)
	}

	return nil, &CallFuncError{Message: fmt.Sprintf("callF timed out waiting for '%s'", functionName)}
}
`;

export const CallFuncScriptJS = `// callF — inter-function call helper
// GENERATED ON THE FLY - DO NOT EDIT - THIS WILL BE OVERWRITTEN ON THE NEXT RUN
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const _REQUEST_DIR = process.env.SHSF_CALLFUNC_REQUEST_DIR || '/executions/callfunc-requests';
const _RESPONSE_DIR = process.env.SHSF_CALLFUNC_RESPONSE_DIR || '/executions/callfunc-responses';

const _sleepBuf = new Int32Array(new SharedArrayBuffer(4));
function _sleepMs(ms) {
  Atomics.wait(_sleepBuf, 0, 0, ms);
}

class CallFuncError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CallFuncError';
  }
}

/**
 * Call another function owned by the same user.
 * @param {string} functionName - Name of the target function.
 * @param {*} args - Arguments passed into the target function's body field.
 * @param {number} [timeoutMs=30000] - How long to wait for the response.
 * @returns {*} The return value of the called function.
 */
function callF(functionName, args = {}, timeoutMs = 30000) {
  const requestId = crypto.randomBytes(16).toString('hex');
  const requestPath = path.join(_REQUEST_DIR, requestId + '.json');
  const tmpPath = requestPath + '.tmp';
  const responsePath = path.join(_RESPONSE_DIR, requestId + '.json');

  fs.mkdirSync(_REQUEST_DIR, { recursive: true });
  fs.mkdirSync(_RESPONSE_DIR, { recursive: true });

  fs.writeFileSync(tmpPath, JSON.stringify({ id: requestId, functionName, args }), 'utf-8');
  fs.renameSync(tmpPath, requestPath);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(responsePath)) {
      const raw = fs.readFileSync(responsePath, 'utf-8');
      try { fs.unlinkSync(responsePath); } catch (_) {}
      const response = JSON.parse(raw);
      if (response.status === 'OK') return response.data;
      throw new CallFuncError(response.message || 'callF failed');
    }
    _sleepMs(10);
  }
  throw new CallFuncError(\`callF timed out waiting for '\${functionName}'\`);
}

module.exports = { callF, CallFuncError };
`;

