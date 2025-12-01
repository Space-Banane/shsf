#!/usr/bin/env node

const chokidar = require("chokidar");
const axios = require("axios");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const { Command } = require("commander");
const chalk = require("chalk");
const os = require("os");
const readline = require("readline");
const { exec } = require("child_process");
const util = require("util");

const execPromise = util.promisify(exec);

const program = new Command();
const VERSION = "b1.0.0";

program
	.name("shsf-cli")
	.description("SHSF CLI for serverless functions")
	.version(VERSION)
	.requiredOption(
		"--mode <mode>",
		"Mode to run: push, pull, watchdog, settings, exec, set-key, set-url, or ignore",
	) // updated help
	.option("--project <path>", "Project folder path")
	.option("--link <id>", "Function link ID")
	.option("--key <key>", "SHSF session key (or use saved config)") // used for set-key too
	.option("--file <file>", "File pattern to ignore (for ignore mode)")
	.option("--list", "List ignored patterns (for ignore mode)")
	.option("--remove", "Remove pattern from ignore list (for ignore mode)")
	.option("--url <url>", "Set SHSF instance base URL (for set-url mode)")
	.parse(process.argv);

const opts = program.opts();

// Config file path in user's home directory
const CONFIG_PATH = path.join(os.homedir(), ".shsf-cli-config.json");

// Load or create config
function loadConfig() {
	try {
		if (fsSync.existsSync(CONFIG_PATH)) {
			const data = fsSync.readFileSync(CONFIG_PATH, "utf-8");
			return JSON.parse(data);
		}
	} catch (err) {
		console.error(chalk.yellow("⚠ Failed to load config, using defaults"));
	}
	return { token: null, base_url: null };
}

function saveConfig(config) {
	try {
		fsSync.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
		return true;
	} catch (err) {
		console.error(chalk.red("✗ Failed to save config:"), err.message);
		return false;
	}
}

const config = loadConfig();

// AppState
const AppState = {
	mode: opts.mode,
	link: opts.link ? parseInt(opts.link) : null,
	project: opts.project ? path.resolve(opts.project) : null,
	shsf_key: opts.key || config.token,
	base_url: config.base_url,
	headers: {},
};

// Settings mode doesn't require authentication initially
if (AppState.mode !== "settings" && AppState.mode !== "ignore") {
	// Validate SHSF key
	if (!AppState.shsf_key) {
		console.error(chalk.red("Error: SHSF session token not found."));
		console.error(
			chalk.yellow(
				"Run with --mode settings to configure your token, or use --key <token>",
			),
		);
		process.exit(1);
	}

	AppState.headers = {
		"X-Access-Key": `${AppState.shsf_key}`,
		"Content-Type": "application/json",
		"User-Agent": `shsf-cli/${VERSION}`,
	};

	console.log(chalk.blue(`Running in ${AppState.mode} mode...`));
	console.log(
		chalk.gray(`Using SHSF Key: ${AppState.shsf_key.substring(0, 8)}...`),
	);
}

// Create readline interface for user input
function createReadlineInterface() {
	return readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
}

function question(rl, prompt) {
	return new Promise((resolve) => {
		rl.question(prompt, (answer) => {
			resolve(answer);
		});
	});
}

// Settings mode handler
async function handleSettings() {
	console.log(chalk.blue("\n⚙️  SHSF CLI Settings\n"));

	const rl = createReadlineInterface();

	try {
		console.log(chalk.cyan("What would you like to do?"));
		console.log("1. View current settings");
		console.log("2. Change session token");
		console.log("3. Exit\n");

		const choice = await question(rl, chalk.yellow("Enter your choice (1-3): "));

		if (choice === "1") {
			// View settings
			console.log(chalk.cyan("\n📋 Current Settings:"));
			console.log(chalk.gray("─".repeat(50)));

			if (config.token) {
				console.log(
					chalk.white("Session Token: ") +
						chalk.green(`${config.token.substring(0, 16)}...`),
				);
				console.log(chalk.gray(`(Full token: ${config.token.length} characters)`));
			} else {
				console.log(chalk.white("Session Token: ") + chalk.red("Not set"));
			}

			console.log(chalk.gray("─".repeat(50)));
			console.log(chalk.gray(`\nConfig file location: ${CONFIG_PATH}\n`));
		} else if (choice === "2") {
			// Change token
			console.log(chalk.cyan("\n🔑 Change Session Token\n"));

			if (config.token) {
				console.log(
					chalk.gray(`Current token: ${config.token.substring(0, 16)}...\n`),
				);
			}

			const newToken = await question(
				rl,
				chalk.yellow("Enter new session token (or press Enter to cancel): "),
			);

			if (newToken.trim()) {
				config.token = newToken.trim();
				if (saveConfig(config)) {
					console.log(chalk.green("\n✓ Session token saved successfully!"));
					console.log(chalk.gray(`Saved to: ${CONFIG_PATH}\n`));
				}
			} else {
				console.log(chalk.yellow("\n⚠ Token change cancelled\n"));
			}
		} else if (choice === "3") {
			console.log(chalk.gray("\nExiting settings...\n"));
		} else {
			console.log(chalk.red("\n✗ Invalid choice\n"));
		}
	} finally {
		rl.close();
	}
}

// Ignore file management functions
function getIgnorePath(projectPath) {
	return path.join(projectPath, ".shsf.ignore");
}

async function loadIgnorePatterns(projectPath) {
	const ignorePath = getIgnorePath(projectPath);

	try {
		if (fsSync.existsSync(ignorePath)) {
			const content = await fs.readFile(ignorePath, "utf-8");
			return content
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith("#"));
		}
	} catch (err) {
		console.error(chalk.yellow("⚠ Failed to load .shsf.ignore"));
	}

	return [];
}

async function saveIgnorePatterns(projectPath, patterns) {
	const ignorePath = getIgnorePath(projectPath);
	const content = patterns.join("\n") + "\n";

	try {
		await fs.writeFile(ignorePath, content, "utf-8");
		return true;
	} catch (err) {
		console.error(chalk.red("✗ Failed to save .shsf.ignore:"), err.message);
		return false;
	}
}

function matchesPattern(filename, pattern) {
	// Simple glob matching
	if (pattern.includes("*")) {
		const regexPattern = pattern
			.replace(/\./g, "\\.")
			.replace(/\*/g, ".*")
			.replace(/\?/g, ".");
		const regex = new RegExp(`^${regexPattern}$`);
		return regex.test(filename);
	}

	// Exact match or directory match
	return filename === pattern || filename.startsWith(pattern + "/");
}

function isIgnored(filename, patterns) {
	return patterns.some((pattern) => matchesPattern(filename, pattern));
}

async function handleIgnoreMode() {
	if (!AppState.project) {
		console.error(
			chalk.red("Error: --project parameter is required for ignore mode"),
		);
		process.exit(1);
	}

	if (!fsSync.existsSync(AppState.project)) {
		console.error(
			chalk.red(`Error: Project folder '${AppState.project}' does not exist.`),
		);
		process.exit(1);
	}

	const patterns = await loadIgnorePatterns(AppState.project);

	// List patterns
	if (opts.list) {
		console.log(chalk.blue("\n📋 Ignored Patterns:\n"));

		if (patterns.length === 0) {
			console.log(chalk.gray("No patterns configured"));
		} else {
			patterns.forEach((pattern, index) => {
				console.log(chalk.white(`${index + 1}. `) + chalk.cyan(pattern));
			});
		}

		console.log(
			chalk.gray(`\nIgnore file: ${getIgnorePath(AppState.project)}\n`),
		);
		return;
	}

	// Add or remove pattern
	if (!opts.file) {
		console.error(
			chalk.red("Error: --file parameter is required to add/remove patterns"),
		);
		console.log(chalk.yellow("\nUsage:"));
		console.log(
			chalk.white("  Add pattern:    ") +
				chalk.cyan("--mode ignore --project <path> --file <pattern>"),
		);
		console.log(
			chalk.white("  Remove pattern: ") +
				chalk.cyan("--mode ignore --project <path> --file <pattern> --remove"),
		);
		console.log(
			chalk.white("  List patterns:  ") +
				chalk.cyan("--mode ignore --project <path> --list"),
		);
		console.log(chalk.gray("\nExamples:"));
		console.log(chalk.white("  *.log, test_*, node_modules, .vscode\n"));
		process.exit(1);
	}

	const filePattern = opts.file.trim();

	if (opts.remove) {
		// Remove pattern
		if (patterns.includes(filePattern)) {
			const newPatterns = patterns.filter((p) => p !== filePattern);
			if (await saveIgnorePatterns(AppState.project, newPatterns)) {
				console.log(chalk.green(`\n✓ Removed pattern: ${filePattern}\n`));
			}
		} else {
			console.log(chalk.yellow(`\n⚠ Pattern not found: ${filePattern}\n`));
		}
	} else {
		// Add pattern
		if (patterns.includes(filePattern)) {
			console.log(chalk.yellow(`\n⚠ Pattern already exists: ${filePattern}\n`));
		} else {
			patterns.push(filePattern);
			if (await saveIgnorePatterns(AppState.project, patterns)) {
				console.log(chalk.green(`\n✓ Added pattern: ${filePattern}\n`));
			}
		}
	}
}

// API Helper Functions
async function apiRequest(method, endpoint, data = null) {
	try {
		const config = {
			method,
			url: `${AppState.base_url}${endpoint}`,
			headers: AppState.headers,
		};

		if (data) {
			config.data = data;
		}

		const response = await axios(config);
		if (response.status !== 200) {
			console.error(chalk.red(`Error: ${response.statusText}`));
			return null;
		}
		return response.data;
	} catch (error) {
		console.error(chalk.red(`API Error: ${error.message}`));
		if (error.response) {
			console.error(chalk.red(`Status: ${error.response.status}`));
			console.error(chalk.red(`Response: ${JSON.stringify(error.response.data)}`));
		}
		throw error;
	}
}

// Pull metadata and save to .meta.json
async function pullMetadata() {
	console.log(chalk.cyan("Pulling metadata..."));
	const data = await apiRequest("GET", `/function/${AppState.link}`);

	if (data.status === "OK") {
		const metaPath = path.join(AppState.project, ".meta.json");
		await fs.writeFile(metaPath, JSON.stringify(data.data, null, 2), "utf-8");
		console.log(chalk.green("✓ Metadata saved to .meta.json"));
		return data.data;
	} else {
		throw new Error("Failed to retrieve metadata");
	}
}

// Push metadata from .meta.json
async function pushMetadata() {
	const metaPath = path.join(AppState.project, ".meta.json");

	if (!fsSync.existsSync(metaPath)) {
		console.log(chalk.yellow("⚠ No .meta.json found, skipping metadata push"));
		return;
	}

	console.log(chalk.cyan("Checking metadata changes..."));

	// Read local metadata
	const localMeta = JSON.parse(await fs.readFile(metaPath, "utf-8"));

	// Fetch remote metadata to compare
	const remoteData = await apiRequest("GET", `/function/${AppState.link}`);
	const remoteMeta = remoteData.data;

	// Compare relevant fields
	const hasChanges =
		localMeta.name !== remoteMeta.name ||
		localMeta.description !== remoteMeta.description ||
		localMeta.image !== remoteMeta.image ||
		localMeta.startup_file !== remoteMeta.startup_file ||
		localMeta.max_ram !== remoteMeta.max_ram ||
		localMeta.timeout !== remoteMeta.timeout ||
		localMeta.allow_http !== remoteMeta.allow_http ||
		localMeta.secure_header !== remoteMeta.secure_header ||
		localMeta.retry_on_failure !== remoteMeta.retry_on_failure ||
		localMeta.executionAlias !== remoteMeta.executionAlias ||
		localMeta.max_retries !== remoteMeta.max_retries ||
		JSON.stringify(localMeta.tags) !== JSON.stringify(remoteMeta.tags);

	if (!hasChanges) {
		console.log(chalk.gray("No metadata changes detected"));
		return;
	}

	console.log(chalk.cyan("Pushing metadata changes..."));

	// Build payload with all supported fields
	const payload = {};

	// Top-level fields
	if (localMeta.name !== remoteMeta.name) {
		payload.name = localMeta.name;
	}
	if (localMeta.description !== remoteMeta.description) {
		payload.description = localMeta.description;
	}
	if (localMeta.image !== remoteMeta.image) {
		payload.image = localMeta.image;
	}
	if (localMeta.startup_file !== remoteMeta.startup_file) {
		payload.startup_file = localMeta.startup_file;
	}

	// Settings object - only include if there are changes
	const settings = {};
	let hasSettingsChanges = false;

	if (localMeta.max_ram !== remoteMeta.max_ram) {
		settings.max_ram = localMeta.max_ram;
		hasSettingsChanges = true;
	}
	if (localMeta.timeout !== remoteMeta.timeout) {
		settings.timeout = localMeta.timeout;
		hasSettingsChanges = true;
	}
	if (localMeta.allow_http !== remoteMeta.allow_http) {
		settings.allow_http = localMeta.allow_http;
		hasSettingsChanges = true;
	}
	if (localMeta.secure_header !== remoteMeta.secure_header) {
		settings.secure_header = localMeta.secure_header;
		hasSettingsChanges = true;
	}
	if (localMeta.retry_on_failure !== remoteMeta.retry_on_failure) {
		settings.retry_on_failure = localMeta.retry_on_failure;
		hasSettingsChanges = true;
	}
	if (localMeta.max_retries !== remoteMeta.max_retries) {
		settings.retry_count = localMeta.max_retries; // Note: API expects 'retry_count', meta stores as 'max_retries'
		hasSettingsChanges = true;
	}
	if (localMeta.executionAlias !== remoteMeta.executionAlias) {
		settings.executionAlias = localMeta.executionAlias;
		hasSettingsChanges = true;
	}

	// Handle tags (parse from string if needed)
	let localTags = localMeta.tags;
	if (typeof localTags === "string") {
		// Tags might be stored as comma-separated string
		localTags = localTags
			? localTags
					.split(",")
					.map((t) => t.trim())
					.filter((t) => t)
			: [];
	} else if (!Array.isArray(localTags)) {
		localTags = [];
	}

	let remoteTags = remoteMeta.tags;
	if (typeof remoteTags === "string") {
		remoteTags = remoteTags
			? remoteTags
					.split(",")
					.map((t) => t.trim())
					.filter((t) => t)
			: [];
	} else if (!Array.isArray(remoteTags)) {
		remoteTags = [];
	}

	if (JSON.stringify(localTags) !== JSON.stringify(remoteTags)) {
		settings.tags = localTags;
		hasSettingsChanges = true;
	}

	if (hasSettingsChanges) {
		payload.settings = settings;
	}

	// Only send request if there are actual changes
	if (Object.keys(payload).length === 0) {
		console.log(chalk.gray("No metadata changes to push"));
		return;
	}

	const result = await apiRequest(
		"PATCH",
		`/function/${AppState.link}`,
		payload,
	);

	if (result.status === "OK") {
		console.log(chalk.green("✓ Metadata updated successfully"));
		// Update local .meta.json with server response
		await fs.writeFile(metaPath, JSON.stringify(result.data, null, 2), "utf-8");
	}
}

// Pull all files
async function pullFiles() {
	console.log(chalk.cyan(`Pulling files for link ID ${AppState.link}...`));

	const data = await apiRequest("GET", `/function/${AppState.link}/files`);

	if (data.status === "OK") {
		const files = data.data;

		for (const file of files) {
			const filePath = path.join(AppState.project, file.name);
			await fs.writeFile(filePath, file.content, "utf-8");
			console.log(chalk.green(`✓ Written file: ${file.name}`));
		}

		// Delete local files not on remote (except .env and .meta.json)
		const existingFiles = await fs.readdir(AppState.project);
		const remoteFileNames = files.map((f) => f.name);

		for (const existingFile of existingFiles) {
			if (
				!remoteFileNames.includes(existingFile) &&
				!existingFile.startsWith(".")
			) {
				await fs.unlink(path.join(AppState.project, existingFile));
				console.log(
					chalk.yellow(`✓ Deleted file: ${existingFile} (not on remote)`),
				);
			}
		}
	}
}

// Pull environment variables
async function pullEnv() {
	console.log(chalk.cyan("Pulling environment data..."));

	const data = await apiRequest("GET", `/function/${AppState.link}`);

	if (data.status === "OK" && data.data.env) {
		const env = JSON.parse(data.data.env);
		const envPath = path.join(AppState.project, ".env");

		const envContent =
			env.map((item) => `${item.name}=${item.value}`).join("\n") + "\n";
		await fs.writeFile(envPath, envContent, "utf-8");
		console.log(chalk.green("✓ Environment variables saved to .env"));
	} else {
		console.log(chalk.yellow("⚠ No environment data found"));
	}
}

// Push environment variables
async function pushEnv() {
	const envPath = path.join(AppState.project, ".env");

	if (!fsSync.existsSync(envPath)) {
		console.log(chalk.gray("No .env file found, skipping"));
		return;
	}

	console.log(chalk.cyan("Pushing environment variables..."));

	const content = await fs.readFile(envPath, "utf-8");
	const lines = content
		.split("\n")
		.filter((line) => line.trim() && line.includes("="));

	const env = lines
		.map((line) => {
			const [name, ...valueParts] = line.split("=");
			const value = valueParts.join("=");
			return { name: name.trim(), value: value.trim() };
		})
		.filter(
			(item) =>
				item.name.length >= 1 &&
				item.name.length <= 128 &&
				item.value.length >= 1 &&
				item.value.length <= 256,
		);

	const result = await apiRequest("PATCH", `/function/${AppState.link}`, {
		environment: env,
	});

	if (result.status === "OK") {
		console.log(chalk.green("✓ Environment variables updated"));
	}
}

// Push single file
async function pushFile(filename, content) {
	if (filename.length > 256) {
		throw new Error("Filename exceeds 256 characters");
	}
	if (!content || content.length === 0) {
		throw new Error("File content is empty");
	}
	if (content.length > 1000000) {
		// 1MB limit
		throw new Error("File content exceeds 1MB limit");
	}

	await apiRequest("PUT", `/function/${AppState.link}/file`, {
		filename,
		code: content,
	});
}

// Push all files
async function pushFiles() {
	console.log(chalk.cyan("Syncing files..."));

	// Load ignore patterns
	const ignorePatterns = await loadIgnorePatterns(AppState.project);

	// Get remote files
	const remoteData = await apiRequest("GET", `/function/${AppState.link}/files`);
	const remoteFiles = remoteData.status === "OK" ? remoteData.data : [];
	const remoteFileNames = remoteFiles.map((f) => f.name);

	// Get local files
	const allFiles = await fs.readdir(AppState.project);
	const localFiles = [];

	for (const file of allFiles) {
		const filePath = path.join(AppState.project, file);
		const stat = await fs.stat(filePath);

		if (stat.isFile() && !file.startsWith(".")) {
			// Check if file is ignored
			if (isIgnored(file, ignorePatterns)) {
				console.log(chalk.gray(`⊝ Ignoring: ${file}`));
				continue;
			}
			localFiles.push(file);
		}
	}

	// Upload/update local files
	for (const filename of localFiles) {
		if (filename.length > 256) {
			console.log(chalk.yellow(`⚠ Skipping ${filename} (name too long)`));
			continue;
		}

		try {
			const filePath = path.join(AppState.project, filename);

			// Validate file before syncing
			const validation = await validateFileBeforeSync(filePath, filename);
			if (!validation.valid) {
				console.log(
					chalk.yellow(
						`⚠ Skipping ${filename} (${validation.type}): ${validation.message}`,
					),
				);
				continue;
			}

			const content = await fs.readFile(filePath, "utf-8");
			await pushFile(filename, content);

			const action = remoteFileNames.includes(filename) ? "Updated" : "Uploaded";
			console.log(chalk.green(`✓ ${action} file: ${filename}`));
		} catch (err) {
			if (err.code === "ERR_ENCODING") {
				console.log(chalk.yellow(`⚠ Skipping ${filename} (binary file)`));
			} else {
				console.error(chalk.red(`✗ Error with ${filename}: ${err.message}`));
			}
		}
	}

	// Delete remote files not in local
	for (const remoteFile of remoteFiles) {
		if (!localFiles.includes(remoteFile.name)) {
			try {
				await apiRequest(
					"DELETE",
					`/function/${AppState.link}/file/${remoteFile.id}`,
				);
				console.log(chalk.yellow(`✓ Deleted remote file: ${remoteFile.name}`));
			} catch (err) {
				console.error(chalk.red(`✗ Failed to delete ${remoteFile.name}`));
			}
		}
	}
}

// Validate Python file syntax
async function validatePythonSyntax(filePath) {
	try {
		// Use Python's compile to check syntax without executing
		await execPromise(`python -m py_compile "${filePath}"`, {
			timeout: 5000, // 5 second timeout
		});
		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: error.stderr || error.message,
		};
	}
}

// Check if a file should be validated before syncing
function shouldValidateFile(filename) {
	const ext = path.extname(filename).toLowerCase();
	return ext === ".py";
}

// Validate file before syncing (extensible for other file types)
async function validateFileBeforeSync(filePath, filename) {
	if (shouldValidateFile(filename)) {
		const ext = path.extname(filename).toLowerCase();

		if (ext === ".py") {
			const validation = await validatePythonSyntax(filePath);
			if (!validation.valid) {
				return {
					valid: false,
					message: `Python syntax error: ${validation.error}`,
					type: "syntax",
				};
			}
		}
	}

	return { valid: true };
}

// Handle set-url mode
async function handleSetUrl() {
	if (!opts.url) {
		console.error(
			chalk.red("Error: --url parameter is required for set-url mode"),
		);
		process.exit(1);
	}
	let url = opts.url.trim();
	// Remove trailing slash if present
	if (url.endsWith("/")) url = url.slice(0, -1);
	// Add /api if not present
	if (!url.endsWith("/api")) url = url + "/api";
	config.base_url = url;
	if (saveConfig(config)) {
		console.log(chalk.green("\n✓ Instance URL saved successfully!"));
		console.log(chalk.gray(`Saved to: ${CONFIG_PATH}`));
		console.log(chalk.gray(`Current instance URL: ${config.base_url}\n`));
	}
}

// Execute function and log result
async function execFunctionAndLog(namespaceId, route) {
	if (!opts.link) {
		console.error(chalk.red("Error: --link parameter is required for exec mode"));
		process.exit(1);
	}
	console.log(chalk.cyan(`Executing function (link ID ${AppState.link})...`));
	try {
		const data = await apiRequest(
			"POST",
			`/exec/${namespaceId}/${AppState.link}/${route}`,
		);
		if (data.type === "output") {
			const output = [
				`Output:\n${data.output}`,
				`Exit Code: ${data.exitCode}`,
				`Result: ${JSON.stringify(data.result)}`,
				`Took: ${data.took}ms`,
			].join("\n");
			console.log(chalk.green("\n=== Execution Result ===\n"));
			console.log(output);

			// Log to .last-exec.log in project directory
			const logPath = path.join(AppState.project, ".last-exec.log");
			await fs.writeFile(logPath, output + "\n", "utf-8");
			console.log(chalk.gray(`\n✓ Execution result logged to ${logPath}\n`));
		} else {
			console.log(
				chalk.red("✗ Execution failed:"),
				data.message || "Unknown error",
			);
		}
	} catch (err) {
		console.error(chalk.red("✗ Execution error:"), err.message);
	}
}

// Main execution
async function main() {
	// Handle set-key mode
	if (AppState.mode === "set-key") {
		if (!opts.key) {
			console.error(
				chalk.red("Error: --key parameter is required for set-key mode"),
			);
			process.exit(1);
		}
		config.token = opts.key.trim();
		if (saveConfig(config)) {
			console.log(chalk.green("\n✓ Session token saved successfully!"));
			console.log(chalk.gray(`Saved to: ${CONFIG_PATH}\n`));
		}
		return;
	}

	// Handle set-url mode
	if (AppState.mode === "set-url") {
		await handleSetUrl();
		return;
	}

	// Handle settings mode first
	if (AppState.mode === "settings") {
		await handleSettings();
		return;
	}

	// Handle ignore mode
	if (AppState.mode === "ignore") {
		await handleIgnoreMode();
		return;
	}

	// Validate required parameters for non-settings modes
	if (!AppState.project && AppState.mode != "exec") {
		console.error(chalk.red("Error: --project parameter is required"));
		process.exit(1);
	}

	if (!AppState.link) {
		console.error(chalk.red("Error: --link parameter is required"));
		process.exit(1);
	}

	// Ensure project directory exists
	if (!fsSync.existsSync(AppState.project) && AppState.mode !== "exec") {
		if (AppState.mode === "pull") {
			await fs.mkdir(AppState.project, { recursive: true });
			console.log(chalk.green(`✓ Created project directory: ${AppState.project}`));
		} else {
			console.error(
				chalk.red(`Error: Project folder '${AppState.project}' does not exist.`),
			);
			process.exit(1);
		}
	}

	if (AppState.mode === "pull") {
		await pullMetadata();
		await pullFiles();
		await pullEnv();
		console.log(chalk.green("\n✅ Pull completed successfully!"));
	} else if (AppState.mode === "push") {
		await pushMetadata();
		await pushEnv();
		await pushFiles();
		console.log(chalk.green("\n✅ Push completed successfully!"));
	} else if (AppState.mode === "watchdog") {
		console.log(
			chalk.blue(`\n👀 Watching project '${AppState.project}' for changes...\n`),
		);

		// Load ignore patterns
		const ignorePatterns = await loadIgnorePatterns(AppState.project);
		if (ignorePatterns.length > 0) {
			console.log(chalk.gray(`Ignoring patterns: ${ignorePatterns.join(", ")}\n`));
		}

		// Debounce mechanism to prevent multiple syncs
		const pendingChanges = new Map();
		const DEBOUNCE_DELAY = 1000; // 1 second delay

		const watcher = chokidar.watch(AppState.project, {
			ignored: /(^|[\/\\])\../, // ignore dotfiles
			persistent: true,
			ignoreInitial: true,
			awaitWriteFinish: {
				stabilityThreshold: 1000,
				pollInterval: 200,
			},
		});

		const handleChange = async (filePath) => {
			const filename = path.basename(filePath);

			// Skip dotfiles
			if (filename.startsWith(".")) return;

			// Check if file is ignored
			if (isIgnored(filename, ignorePatterns)) {
				console.log(chalk.gray(`\n⊝ Ignoring change: ${filename}`));
				return;
			}

			// Clear existing timeout for this file
			if (pendingChanges.has(filename)) {
				clearTimeout(pendingChanges.get(filename));
			}

			// Set new timeout
			const timeoutId = setTimeout(async () => {
				pendingChanges.delete(filename);

				try {
					console.log(chalk.cyan(`\n📝 Detected change: ${filename}`));

					// Validate file before syncing
					const validation = await validateFileBeforeSync(filePath, filename);
					if (!validation.valid) {
						console.log(
							chalk.yellow(
								`⚠ Skipping ${filename} (incomplete or invalid): ${validation.message}`,
							),
						);
						return;
					}

					const content = await fs.readFile(filePath, "utf-8");
					await pushFile(filename, content);
					console.log(chalk.green(`✓ Pushed: ${filename}`));
				} catch (err) {
					console.error(chalk.red(`✗ Failed to push ${filename}: ${err.message}`));
				}
			}, DEBOUNCE_DELAY);

			pendingChanges.set(filename, timeoutId);
		};

		watcher
			.on("add", handleChange)
			.on("change", handleChange)
			.on("unlink", async (filePath) => {
				const filename = path.basename(filePath);
				if (filename.startsWith(".")) return;

				// Check if file is ignored
				if (isIgnored(filename, ignorePatterns)) {
					return;
				}

				// Clear pending change if exists
				if (pendingChanges.has(filename)) {
					clearTimeout(pendingChanges.get(filename));
					pendingChanges.delete(filename);
				}

				try {
					console.log(chalk.yellow(`\n🗑️  Detected deletion: ${filename}`));
					// Get file ID from remote
					const remoteData = await apiRequest(
						"GET",
						`/function/${AppState.link}/files`,
					);
					const remoteFile = remoteData.data.find((f) => f.name === filename);

					if (remoteFile) {
						await apiRequest(
							"DELETE",
							`/function/${AppState.link}/file/${remoteFile.id}`,
						);
						console.log(chalk.green(`✓ Deleted: ${filename}`));
					}
				} catch (err) {
					console.error(chalk.red(`✗ Failed to delete ${filename}: ${err.message}`));
				}
			})
			.on("error", (error) => console.error(chalk.red("Watcher error:"), error));

		// Graceful shutdown
		process.on("SIGINT", () => {
			console.log(chalk.yellow("\n\n👋 Stopping watchdog..."));
			// Clear all pending timeouts
			for (const timeoutId of pendingChanges.values()) {
				clearTimeout(timeoutId);
			}
			watcher.close();
			process.exit(0);
		});
	} else if (AppState.mode === "update-alias") {
		// Update execution alias via PATCH /function/{id}
		const metaPath = path.join(AppState.project, ".meta.json");
		if (!fsSync.existsSync(metaPath)) {
			console.error(
				chalk.red("Error: .meta.json not found in project directory."),
			);
			process.exit(1);
		}
		const localMeta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
		if (!opts.alias) {
			console.error(
				chalk.red("Error: --alias parameter is required for update-alias mode"),
			);
			process.exit(1);
		}
		const payload = { executionAlias: opts.alias };
		const result = await apiRequest(
			"PATCH",
			`/function/${AppState.link}`,
			payload,
		);
		if (result.status === "OK") {
			console.log(chalk.green("✓ Execution alias updated successfully"));
			localMeta.executionAlias = opts.alias;
			await fs.writeFile(metaPath, JSON.stringify(localMeta, null, 2), "utf-8");
		} else {
			console.error(chalk.red("✗ Failed to update execution alias"));
		}
		return;
	} else if (AppState.mode === "exec") {
		if (!AppState.project || !fsSync.existsSync(AppState.project)) {
			console.error(
				chalk.red("Error: --project parameter is required for exec mode"),
			);
			process.exit(1);
		}
		// Run function via /api/exec/{namespaceId}/{functionId}/{route}
		const metaPath = path.join(AppState.project, ".meta.json");
		if (!fsSync.existsSync(metaPath)) {
			console.error(
				chalk.red("Error: .meta.json not found in project directory."),
			);
			process.exit(1);
		}
		const localMeta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
		const namespaceId = localMeta.namespaceId;
		const functionId = localMeta.executionId;
		if (!namespaceId || !functionId) {
			console.error(
				chalk.red("Error: namespaceId or executionId missing in .meta.json"),
			);
			process.exit(1);
		}
		if (opts.route && opts.route.startsWith("/")) {
			console.error(
				chalk.red("Error: --route is not allowed to start with a leading slash"),
			);
			process.exit(1);
		}
		if (opts.route && opts.route.length > 256) {
			console.error(
				chalk.red("Error: --route exceeds maximum length of 256 characters"),
			);
			process.exit(1);
		}

		// Route validation allows empty string (default route), while executionAlias requires at least one character.
		// If you want stricter validation, use /^[a-zA-Z0-9-_]+$/ instead.
		if (opts.route && !/^[a-zA-Z0-9-_]*$/.test(opts.route)) {
			// Only allow alphanumeric, underscore, hyphen; empty route is valid
			console.error(chalk.red("Error: --route contains invalid characters"));
			process.exit(1);
		}

		const method = opts.method ? opts.method.toUpperCase() : "POST";
		const route = opts.route ?? "";
		let endpoint = `/exec/${namespaceId}/${functionId}/${route}`;
		let result;
		if (method === "GET") {
			result = await apiRequest("GET", endpoint);
		} else {
			let body = {};
			if (opts.body) {
				try {
					body = JSON.parse(opts.body);
				} catch (e) {
					console.error(chalk.red("Error: --body must be valid JSON"));
					process.exit(1);
				}
			}
			result = await apiRequest("POST", endpoint, body);
		}
		console.log(chalk.green("=== Function Execution Result ==="));
		console.log(result);
		return;
	} else {
		console.error(
			chalk.red(
				`Error: Unknown mode '${AppState.mode}'. Use: pull, push, watchdog, settings, ignore, update-alias, exec`,
			),
		);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error(chalk.red("\n❌ Fatal error:"), err.message);
	process.exit(1);
});
