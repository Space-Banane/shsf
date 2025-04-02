import os
import uuid
import subprocess
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Utility functions to read and write the config file.
CONFIG_FILE = "./config.json"

def read_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            try:
                return json.load(f)
            except Exception:
                return {}
    return {}

def write_config(data):
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f)

@app.route('/runcode', methods=['POST'])
def run_code():
    data = request.get_json()
    # Validate request body
    if not data:
        return jsonify({"error": "Request body is missing."}), 400
    if 'name' not in data:
        return jsonify({"error": "Field 'name' is missing in the request body."}), 400
    if 'image' not in data:
        return jsonify({"error": "Field 'image' is missing in the request body."}), 400

    file_name = data['name']
    image = data['image'].strip()
    if not image:
        return jsonify({"error": "Field 'image' cannot be empty."}), 400
    if not all(c.isalnum() or c in ".:/-_@" for c in image):
        return jsonify({"error": f"Invalid characters in image name: {image}"}), 400

    file_path = f"./files/{file_name}.py"
    meta_path = f"./files/{file_name}.json"
    if not os.path.exists(file_path) or not os.path.exists(meta_path):
        return jsonify({"error": f"Function {file_name} does not exist."}), 404
    try:
        # Update metadata with the last selected image
        with open(meta_path, "r") as meta_file:
            metadata = json.load(meta_file)
        metadata["last_image"] = image
        with open(meta_path, "w") as meta_file:
            json.dump(metadata, meta_file)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    print(f"Executing code from {file_path} with image {image}")
    try:
        # Run the code using Docker
        container_name = f"code_runner_{file_name}"
        result = subprocess.run(
            [
                "docker", "run", "--rm",
                "-v", f"{os.path.abspath('./files')}:/app",
                image,
                "python3", f"/app/{file_name}.py"
            ],
            text=True,
            capture_output=True,
            timeout=30
        )
        output = result.stdout if result.returncode == 0 else result.stderr
        return jsonify({"message": output}), 200
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Code execution timed out."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_allow_http_flag():
    config = read_config()
    return str(config.get("allow_http", "false")).lower() == "true"

@app.route('/setallowhttp', methods=['POST'])
def set_allow_http():
    data = request.get_json()
    if data and 'name' in data and 'allow' in data:
        file_name = data['name']
        meta_path = f"./files/{file_name}.json"
        if not os.path.exists(meta_path):
            return jsonify({"error": f"Function {file_name} does not exist."}), 404
        try:
            with open(meta_path, "r") as meta_file:
                metadata = json.load(meta_file)
            metadata["allow_http"] = True if data['allow'] else False
            with open(meta_path, "w") as meta_file:
                json.dump(metadata, meta_file)
            return jsonify({"message": f"HTTP execution for {file_name} set to {data['allow']}."}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "No function name or allow flag provided."}), 400

@app.route('/getallowhttp', methods=['POST'])
def get_allow_http():
    data = request.get_json()
    if data and 'name' in data:
        file_name = data['name']
        meta_path = f"./files/{file_name}.json"
        if not os.path.exists(meta_path):
            return jsonify({"error": f"Function {file_name} does not exist."}), 404
        try:
            with open(meta_path, "r") as meta_file:
                metadata = json.load(meta_file)
            allow_http = metadata.get("allow_http", False)
            return jsonify({"allow": allow_http}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "No function name provided."}), 400

@app.route('/remoteruncode', methods=['POST'])
def remote_run_code():
    data = request.get_json()
    if data and 'name' in data:
        file_name = data['name']
        meta_path = f"./files/{file_name}.json"
        file_path = f"./files/{file_name}.py"
        if not os.path.exists(meta_path) or not os.path.exists(file_path):
            return jsonify({"error": f"Function {file_name} does not exist."}), 404
        try:
            with open(meta_path, "r") as meta_file:
                metadata = json.load(meta_file)
            if not metadata.get("allow_http", False):
                return jsonify({"error": f"Remote HTTP execution is disabled for {file_name}."}), 403
            last_image = metadata.get("last_image", "").strip()
            if not last_image:
                return jsonify({"error": "No previously selected image found for this function."}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 500

        print(f"Remote executing code from {file_path} with image {last_image}")
        try:
            container_name = f"code_runner_{file_name}"
            result = subprocess.run(
                [
                    "docker", "run", "--rm",
                    "-v", f"{os.path.abspath('./files')}:/app",
                    last_image,
                    "python3", f"/app/{file_name}.py"
                ],
                text=True,
                capture_output=True,
                timeout=30
            )
            output = result.stdout if result.returncode == 0 else result.stderr
            return jsonify({"message": output}), 200
        except subprocess.TimeoutExpired:
            return jsonify({"error": "Code execution timed out."}), 500
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "No function name or code provided in the request body."}), 400

@app.route('/savefunction', methods=['POST'])
def save_function():
    data = request.get_json()
    if data and 'code' in data and 'name' in data:
        file_name = data['name']
        file_path = f"./files/{file_name}.py"
        meta_path = f"./files/{file_name}.json"
        os.makedirs("./files", exist_ok=True)
        with open(file_path, "w") as code_file:
            code_file.write(data['code'])
        # Update or create the metadata file.
        metadata = {"name": file_name}
        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r") as meta_file:
                    metadata = json.load(meta_file)
            except Exception:
                pass
        metadata["last_saved"] = datetime.now().isoformat()
        with open(meta_path, "w") as meta_file:
            json.dump(metadata, meta_file)
        return jsonify({"message": f"Function saved as {file_name}.py"}), 200
    else:
        return jsonify({"error": "No code or name provided in the request body."}), 400

@app.route('/deletefunction', methods=['POST'])
def delete_function():
    data = request.get_json()
    if data and 'name' in data:
        file_name = data['name']
        file_path = f"./files/{file_name}.py"
        meta_path = f"./files/{file_name}.json"
        if os.path.exists(file_path):
            os.remove(file_path)
        if os.path.exists(meta_path):
            os.remove(meta_path)
        return jsonify({"message": f"Function {file_name} deleted."}), 200
    else:
        return jsonify({"error": "No name provided in the request body."}), 400

@app.route('/createfunction', methods=['POST'])
def create_function():
    data = request.get_json()
    if data and 'name' in data:
        file_name = data['name']
        if file_name == "":
            return jsonify({"error": "Function name cannot be empty."}), 400
        if not file_name.isidentifier(): # Check if the name is a valid Python identifier
            return jsonify({"error": "Invalid function name."}), 400
        file_path = f"./files/{file_name}.py"
        meta_path = f"./files/{file_name}.json"
        os.makedirs("./files", exist_ok=True)
        if os.path.exists(file_path):
            return jsonify({"error": f"Function {file_name}.py already exists."}), 400
        default_code = f"def {file_name}():\n    # TODO: Implement your function logic here\n    pass\n"
        with open(file_path, "w") as code_file:
            code_file.write(default_code)
        # Create JSON metadata file for this function.
        metadata = {
            "name": file_name,
            "created_at": datetime.now().isoformat(),
            "last_saved": datetime.now().isoformat()
        }
        with open(meta_path, "w") as meta_file:
            json.dump(metadata, meta_file)
        return jsonify({"message": f"Function {file_name}.py created with default code."}), 200
    else:
        return jsonify({"error": "No name provided in the request body."}), 400

@app.route('/listfunctions', methods=['GET'])
def list_functions():
    try:
        os.makedirs("./files", exist_ok=True)
        functions = []
        for file in os.listdir("./files"):
            if file.endswith(".json"):
                with open(f"./files/{file}", "r") as meta_file:
                    metadata = json.load(meta_file)
                    functions.append(metadata)
        return jsonify({"functions": functions}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/getfunction', methods=['POST'])
def get_function():
    data = request.get_json()
    if data and 'name' in data:
        file_name = data['name']
        file_path = f"./files/{file_name}.py"
        meta_path = f"./files/{file_name}.json"
        if os.path.exists(file_path) and os.path.exists(meta_path):
            with open(file_path, "r") as code_file:
                code_content = code_file.read()
            with open(meta_path, "r") as meta_file:
                metadata = json.load(meta_file)
            return jsonify({"code": code_content, "metadata": metadata}), 200
        else:
            return jsonify({"error": f"Function {file_name} does not exist."}), 404
    else:
        return jsonify({"error": "No name provided in the request body."}), 400

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')