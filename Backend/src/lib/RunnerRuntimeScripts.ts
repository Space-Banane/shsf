// Pure generator functions for per-runtime runner and init scripts.
// No I/O, no imports — all functions return strings for callers to write to disk.

export function generateGoRunnerWrapperCode(): string {
	return `package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
)

const shsfBinaryTransport = "base64-bytes-v1"

func envelopeBytes(raw []byte) map[string]interface{} {
	return map[string]interface{}{
		"__shsf_transport": shsfBinaryTransport,
		"data":             base64.StdEncoding.EncodeToString(raw),
		"length":           len(raw),
	}
}

func normalizeForTransport(value interface{}) interface{} {
	if value == nil {
		return nil
	}

	if raw, ok := value.([]byte); ok {
		return envelopeBytes(raw)
	}

	rv := reflect.ValueOf(value)

	switch rv.Kind() {
	case reflect.Pointer, reflect.Interface:
		if rv.IsNil() {
			return nil
		}
		return normalizeForTransport(rv.Elem().Interface())

	case reflect.Slice:
		if rv.Type().Elem().Kind() == reflect.Uint8 {
			raw := make([]byte, rv.Len())
			reflect.Copy(reflect.ValueOf(raw), rv)
			return envelopeBytes(raw)
		}

		out := make([]interface{}, rv.Len())
		for i := 0; i < rv.Len(); i++ {
			out[i] = normalizeForTransport(rv.Index(i).Interface())
		}
		return out

	case reflect.Array:
		if rv.Type().Elem().Kind() == reflect.Uint8 {
			raw := make([]byte, rv.Len())
			for i := 0; i < rv.Len(); i++ {
				raw[i] = byte(rv.Index(i).Uint())
			}
			return envelopeBytes(raw)
		}

		out := make([]interface{}, rv.Len())
		for i := 0; i < rv.Len(); i++ {
			out[i] = normalizeForTransport(rv.Index(i).Interface())
		}
		return out

	case reflect.Map:
		out := make(map[string]interface{}, rv.Len())
		iter := rv.MapRange()
		for iter.Next() {
			out[fmt.Sprint(iter.Key().Interface())] = normalizeForTransport(iter.Value().Interface())
		}
		return out

	case reflect.Struct:
		out := make(map[string]interface{}, rv.NumField())
		rt := rv.Type()
		for i := 0; i < rv.NumField(); i++ {
			field := rt.Field(i)
			// Skip unexported fields.
			if field.PkgPath != "" {
				continue
			}
			out[field.Name] = normalizeForTransport(rv.Field(i).Interface())
		}
		return out

	default:
		return value
	}
}

func writeResultFile(resultPath string, value interface{}) error {
	resultJSON, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("error serializing result: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(resultPath), 0755); err != nil {
		return err
	}

	tempPath := resultPath + ".tmp"
	if err := os.WriteFile(tempPath, resultJSON, 0644); err != nil {
		return err
	}
	return os.Rename(tempPath, resultPath)
}

// Runner wrapper that handles payload loading and result marshaling.
func runFunction(payloadPath string, resultPath string) error {
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

	// Marshal normalized result so binary values are transport-safe across runtimes.
	normalizedResult := normalizeForTransport(result)
	return writeResultFile(resultPath, normalizedResult)
}

func main() {
	// Redirect user's stdout to stderr; function results are written to result.json.
	os.Stdout = os.Stderr

	if len(os.Args) < 3 {
		fmt.Fprintln(os.Stderr, "Error: Payload or result file path not provided")
		os.Exit(1)
	}

	payloadPath := os.Args[1]
	resultPath := os.Args[2]

	if err := runFunction(payloadPath, resultPath); err != nil {
		// Ensure error goes to stderr
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
`;
}

export function generatePythonRunnerScript(startupFile: string): string {
	return `#!/bin/sh
# Source environment variables if the file exists
if [ -f /app/.shsf_env ]; then
    . /app/.shsf_env
    echo "[SHSF RUNNER] Sourced environment from /app/.shsf_env" >&2
else
    echo "[SHSF RUNNER] Warning: No .shsf_env file found" >&2
fi

# Execute the actual Python runner with payload and result file paths as arguments
python3 - "$@" << 'PYTHON_SCRIPT_EOF'
import json
import sys
import os
import base64
import traceback

SHSF_BINARY_TRANSPORT = "base64-bytes-v1"

def _shsf_json_default(obj):
	if isinstance(obj, (bytes, bytearray, memoryview)):
		raw = bytes(obj)
		return {
			"__shsf_transport": SHSF_BINARY_TRANSPORT,
			"data": base64.b64encode(raw).decode("ascii"),
			"length": len(raw)
		}

	if isinstance(obj, set):
		return list(obj)

	if hasattr(obj, "__dict__"):
		return obj.__dict__

	# Last-resort fallback keeps execution alive for unknown object types.
	return repr(obj)

# Get transport file paths from command line arguments
if len(sys.argv) < 3:
	sys.stderr.write("Error: Payload or result file path not provided\\n")
	sys.exit(1)

payload_file_path = sys.argv[1]
result_file_path = sys.argv[2]

def _write_result_file(path, value):
    temp_path = path + ".tmp"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(value, f, default=_shsf_json_default)
    os.replace(temp_path, path)

# Redirect stdout to stderr; function results are written to result.json.
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
            user_result = target_module.main(run_data) if run_data is not None else target_module.main()

            _write_result_file(result_file_path, user_result)
        except Exception as e:
            # Error during main execution or result serialization.
            sys.stdout = sys.stderr
            sys.stderr.write(f"Error executing main function or serializing result: {str(e)}\\n")
            traceback.print_exc(file=sys.stderr)
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
    sys.exit(1)
finally:
    sys.stdout = sys.stderr
PYTHON_SCRIPT_EOF
`;
}

export function generateGoRunnerShScript(): string {
	return `#!/bin/sh
# Source environment variables if the file exists
if [ -f /app/.shsf_env ]; then
    . /app/.shsf_env
    echo "[SHSF RUNNER] Sourced environment from /app/.shsf_env" >&2
else
    echo "[SHSF RUNNER] Warning: No .shsf_env file found" >&2
fi

# Execute the compiled Go binary with payload and result file paths as arguments
/app/_shsf_runner "$@"
`;
}

export function generateDotnetRunnerScript(dotnetProjectPath: string | null): string {
	return `#!/bin/sh
if [ -f /app/.shsf_env ]; then
    . /app/.shsf_env
    echo "[SHSF RUNNER] Sourced environment from /app/.shsf_env" >&2
else
    echo "[SHSF RUNNER] Warning: No .shsf_env file found" >&2
fi

if [ $# -lt 3 ]; then
    echo "Error: Missing payload file path, result file path, or execution mode" >&2
    exit 1
fi

PAYLOAD_PATH="$1"
RESULT_PATH="$2"
EXECUTION_MODE="$3"
export SHSF_PAYLOAD_PATH="$PAYLOAD_PATH"
export SHSF_RESULT_PATH="$RESULT_PATH"
export SHSF_EXECUTION_MODE="$EXECUTION_MODE"
PROJECT_PATH="${dotnetProjectPath ?? ""}"

if [ -z "$PROJECT_PATH" ]; then
    echo "Error: No runnable .NET project could be resolved." >&2
    exit 1
fi

cd /app

if [ "$EXECUTION_MODE" = "dev_execute" ]; then
    exec dotnet run --project "$PROJECT_PATH" -- "$PAYLOAD_PATH" "$RESULT_PATH"
fi

ENTRY_PATH_FILE="/app/.shsf_dotnet_entry"
BUILT_TARGET=""

if [ -f "$ENTRY_PATH_FILE" ]; then
    BUILT_TARGET="$(cat "$ENTRY_PATH_FILE" 2>/dev/null)"
fi

if [ -z "$BUILT_TARGET" ] || [ ! -f "$BUILT_TARGET" ]; then
    PROJECT_DIR="$(dirname "$PROJECT_PATH")"
    ASSEMBLY_NAME="$(basename "$PROJECT_PATH" .csproj)"
    BUILT_TARGET="$(find "/app/$PROJECT_DIR/bin" -type f -name "$ASSEMBLY_NAME.dll" ! -path "*/ref/*" ! -path "*/obj/*" | sort | tail -n 1)"
fi

if [ -z "$BUILT_TARGET" ] || [ ! -f "$BUILT_TARGET" ]; then
    echo "Error: No built .NET assembly found for $PROJECT_PATH. Run .NET Build before using production execution routes." >&2
    exit 1
fi

exec dotnet "$BUILT_TARGET" "$PAYLOAD_PATH" "$RESULT_PATH"
`;
}

export function generatePythonInitBody(
	functionId: number,
	opts: { ffmpeg_install?: boolean | null; opencv_install?: boolean | null },
): string {
	let body = "";

	if (opts.ffmpeg_install) {
		body += `
      echo "[SHSF INIT] Checking ffmpeg installation..."
      if [ ! -f ".already_installed_ffmpeg" ]; then
          command -v ffmpeg >/dev/null 2>&1 || (apt update && apt-get install -y ffmpeg && touch /app/.already_installed_ffmpeg)
      else
          echo "[SHSF INIT] ffmpeg already installed (marker file present)."
      fi
      echo "[SHSF INIT] ffmpeg check complete."
      `;
	}

	if (opts.opencv_install) {
		body += `
      echo "[SHSF INIT] Checking opencv installation..."
      if [ ! -f ".already_installed_opencv" ]; then
          python3 -c "import cv2" >/dev/null 2>&1 || (apt update && apt install -y python3-opencv && touch /app/.already_installed_opencv)
      else
          echo "[SHSF INIT] opencv already installed (marker file present)."
      fi
      echo "[SHSF INIT] opencv check complete."
      `;
	}

	body += `
if [ -f "requirements.txt" ]; then
	echo "[SHSF INIT] Setting up Python environment for function ${functionId}"
	VENV_DIR="/pip-cache/venv/function-${functionId}"
	HASH_FILE="/pip-cache/hashes/function-${functionId}/req.hash"
	mkdir -p "$(dirname "$VENV_DIR")" "$(dirname "$HASH_FILE")"
	REQUIREMENTS_HASH=$(md5sum requirements.txt | awk '{print $1}')
	NEEDS_UPDATE=0
	if [ ! -d "$VENV_DIR" ]; then NEEDS_UPDATE=1; echo "[SHSF INIT] No venv. Creating."; fi
	if [ ! -f "$HASH_FILE" ] || [ "$(cat "$HASH_FILE" 2>/dev/null)" != "$REQUIREMENTS_HASH" ]; then NEEDS_UPDATE=1; echo "[SHSF INIT] Hash mismatch. Updating."; fi

	if [ $NEEDS_UPDATE -eq 1 ]; then
		rm -rf "$VENV_DIR"
		python -m venv "$VENV_DIR"
		. "$VENV_DIR/bin/activate"
		pip install --upgrade pip
		if pip install --no-cache-dir -r requirements.txt; then
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
	echo "export PATH=$VENV_DIR/bin:$PATH" > /app/.shsf_env
	echo "export PYTHONPATH=/app:$PYTHONPATH" >> /app/.shsf_env
	echo "export VIRTUAL_ENV=$VENV_DIR" >> /app/.shsf_env
fi
echo "[SHSF INIT] Python setup complete."
`;

	return body;
}

export function generateGoInitBody(
	functionId: number,
	opts?: { ffmpeg_install?: boolean | null },
): string {
	let body = "";

	if (opts?.ffmpeg_install) {
		body += `
      echo "[SHSF INIT] Checking ffmpeg installation..."
      if [ ! -f ".already_installed_ffmpeg" ]; then
          command -v ffmpeg >/dev/null 2>&1 || (apt update && apt-get install -y ffmpeg && touch /app/.already_installed_ffmpeg)
      else
          echo "[SHSF INIT] ffmpeg already installed (marker file present)."
      fi
      echo "[SHSF INIT] ffmpeg check complete."
      `;
	}

	body += `
echo "[SHSF INIT] Setting up Go environment for function ${functionId}"
BIN_DIR="/go-cache/bin/function-${functionId}"
HASH_FILE="/go-cache/hashes/function-${functionId}/go.hash"
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
echo "export PATH=/app:$PATH" >> /app/.shsf_env
echo "[SHSF INIT] Go setup complete."
`;

	return body;
}

export function generateDotnetInitBody(functionId: number): string {
	return `
echo "[SHSF INIT] Setting up .NET environment for function ${functionId}"
DOTNET_CACHE_DIR="/dotnet-cache/function-${functionId}"
NUGET_PACKAGES_DIR="$DOTNET_CACHE_DIR/nuget"
DOTNET_CLI_HOME_DIR="$DOTNET_CACHE_DIR/cli-home"
mkdir -p "$NUGET_PACKAGES_DIR" "$DOTNET_CLI_HOME_DIR"
echo "export NUGET_PACKAGES=$NUGET_PACKAGES_DIR" > /app/.shsf_env
echo "export DOTNET_CLI_HOME=$DOTNET_CLI_HOME_DIR" >> /app/.shsf_env
echo "export PATH=/app:$PATH" >> /app/.shsf_env
echo "[SHSF INIT] .NET setup complete."
`;
}

// Standalone init script used by buildDotnetFunction (has its own shebang + set -e).
// Differs from generateDotnetInitBody in structure: complete script vs. appended fragment.
export function generateDotnetBuildInitScript(functionId: number): string {
	return `#!/bin/sh
set -e
echo "[SHSF INIT] Setting up .NET environment..."
DOTNET_CACHE_DIR="/dotnet-cache/function-${functionId}"
NUGET_PACKAGES_DIR="$DOTNET_CACHE_DIR/nuget"
DOTNET_CLI_HOME_DIR="$DOTNET_CACHE_DIR/cli-home"
mkdir -p "$NUGET_PACKAGES_DIR" "$DOTNET_CLI_HOME_DIR"
echo "export NUGET_PACKAGES=$NUGET_PACKAGES_DIR" > /app/.shsf_env
echo "export DOTNET_CLI_HOME=$DOTNET_CLI_HOME_DIR" >> /app/.shsf_env
echo "export PATH=/app:\\$PATH" >> /app/.shsf_env
echo "[SHSF INIT] .NET environment ready."
`;
}
