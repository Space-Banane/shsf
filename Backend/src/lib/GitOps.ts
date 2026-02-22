import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Encryption helpers — AES-256-GCM, key derived from the instance secret.
// Stored format:  <iv_hex>:<authTag_hex>:<ciphertext_hex>
// ---------------------------------------------------------------------------

function deriveKey(secret: string): Buffer {
	return createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext string with AES-256-GCM using the instance secret.
 * Returns a compact `iv:tag:ciphertext` hex string safe for DB storage.
 */
export function encryptSecret(plaintext: string, secret: string): string {
	const key = deriveKey(secret);
	const iv = randomBytes(12); // 96-bit IV recommended for GCM
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a value produced by `encryptSecret`.
 * Returns the original plaintext, or `null` if decryption fails.
 */
export function decryptSecret(ciphertext: string, secret: string): string | null {
	try {
		const parts = ciphertext.split(":");
		if (parts.length !== 3) return null;
		const [ivHex, tagHex, dataHex] = parts;
		const key = deriveKey(secret);
		const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
		decipher.setAuthTag(Buffer.from(tagHex, "hex"));
		const decrypted = Buffer.concat([
			decipher.update(Buffer.from(dataHex, "hex")),
			decipher.final(),
		]);
		return decrypted.toString("utf8");
	} catch {
		return null;
	}
}

export function getFuncAppDir(functionId: number): string {
	return path.join("/opt/shsf_data/functions", String(functionId), "app");
}

/**
 * Returns the directory used to hold the full git repository clone when a
 * sourceDir is configured. The app directory will only receive the contents
 * of the specified subdirectory.
 */
export function getGitRepoDir(functionId: number): string {
	return path.join("/opt/shsf_data/functions", String(functionId), "git_repo");
}

/**
 * Copies the contents of `<gitRepoDir>/<sourceDir>` into `appDir`,
 * replacing whatever was there before.
 * Performs a path-traversal check so `sourceDir` cannot escape the repo.
 */
export async function syncSourceDirToApp(
	gitRepoDir: string,
	sourceDir: string,
	appDir: string,
): Promise<{ success: boolean; message: string }> {
	const sourcePath = path.resolve(gitRepoDir, sourceDir);
	const resolvedRepo = path.resolve(gitRepoDir);
	// Guard against path traversal
	if (!sourcePath.startsWith(resolvedRepo + path.sep) && sourcePath !== resolvedRepo) {
		return { success: false, message: `Source directory "${sourceDir}" is outside the repository.` };
	}
	if (!fsSync.existsSync(sourcePath)) {
		return { success: false, message: `Source directory "${sourceDir}" not found in cloned repository.` };
	}
	const stat = await fs.stat(sourcePath);
	if (!stat.isDirectory()) {
		return { success: false, message: `"${sourceDir}" is not a directory inside the repository.` };
	}
	await clearAppDirectory(appDir);
	await fs.cp(sourcePath, appDir, { recursive: true });
	return { success: true, message: `Synced "${sourceDir}" → app directory.` };
}

export async function clearAppDirectory(appDir: string): Promise<void> {
	if (!fsSync.existsSync(appDir)) {
		await fs.mkdir(appDir, { recursive: true });
		return;
	}
	const entries = await fs.readdir(appDir);
	await Promise.all(
		entries.map((entry) =>
			fs.rm(path.join(appDir, entry), { recursive: true, force: true }),
		),
	);
}

/**
 * Embeds username & password into a git URL.
 * e.g. https://github.com/user/repo.git → https://myuser:mytoken@github.com/user/repo.git
 * Special characters in credentials are NOT percent-encoded.
 */
export function buildAuthUrl(
	url: string,
	username: string,
	password: string,
): string {
	try {
		const parsed = new URL(url);
		parsed.username = username;
		parsed.password = password;
		return parsed.toString();
	} catch {
		// Fallback for malformed URLs — just inject before host
		return url;
	}
}

/**
 * Strips credentials from a URL for safe logging / storage.
 */
export function stripCredentialsFromUrl(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.username = "";
		parsed.password = "";
		return parsed.toString();
	} catch {
		return url;
	}
}

export async function runGitCommand(
	cwd: string,
	args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const command = `git ${args.join(" ")}`;
	try {
		const { stdout, stderr } = await execAsync(command, {
			cwd,
			timeout: 120_000,
			env: {
				...process.env,
				GIT_TERMINAL_PROMPT: "0",
				GIT_ASKPASS: "echo",
			},
		});
		return { stdout, stderr, exitCode: 0 };
	} catch (err: any) {
		return {
			stdout: err.stdout ?? "",
			stderr: err.stderr ?? err.message ?? "Unknown error",
			exitCode: err.code ?? 1,
		};
	}
}

/**
 * Updates the remote origin URL in an existing clone (for credential rotation).
 */
export async function updateGitRemoteUrl(
	appDir: string,
	newRemoteUrl: string,
): Promise<{ success: boolean; message: string }> {
	if (!fsSync.existsSync(path.join(appDir, ".git"))) {
		return { success: false, message: "No .git directory found." };
	}
	const result = await runGitCommand(appDir, [
		"remote",
		"set-url",
		"origin",
		newRemoteUrl,
	]);
	if (result.exitCode !== 0) {
		return { success: false, message: result.stderr || "git remote set-url failed" };
	}
	return { success: true, message: "Remote URL updated." };
}

export async function performGitPull(
	functionId: number,
	sourceDir?: string | null,
): Promise<{ success: boolean; logs: string }> {
	const redact = (s: string) => s.replace(/\/\/[^:]+:[^@]+@/g, "//[REDACTED]@");
	const logLines: string[] = [];

	if (sourceDir) {
		// When a source dir is configured the repo lives in git_repo/, not app/
		const gitRepoDir = getGitRepoDir(functionId);
		const appDir = getFuncAppDir(functionId);
		if (!fsSync.existsSync(path.join(gitRepoDir, ".git"))) {
			return {
				success: false,
				logs: "[GIT] No .git directory found in git_repo. Please clone first.",
			};
		}
		const result = await runGitCommand(gitRepoDir, ["pull"]);
		if (result.stdout) logLines.push(`[stdout]\n${redact(result.stdout.trim())}`);
		if (result.stderr) logLines.push(`[stderr]\n${redact(result.stderr.trim())}`);
		if (result.exitCode !== 0) {
			return { success: false, logs: logLines.join("\n") || "[GIT] No output" };
		}
		// Sync the source subdirectory into the app directory
		const syncResult = await syncSourceDirToApp(gitRepoDir, sourceDir, appDir);
		logLines.push(`[GIT] ${syncResult.message}`);
		return { success: syncResult.success, logs: logLines.join("\n") };
	} else {
		// No source dir — repo IS the app dir (legacy behaviour)
		const appDir = getFuncAppDir(functionId);
		if (!fsSync.existsSync(path.join(appDir, ".git"))) {
			return {
				success: false,
				logs: "[GIT] No .git directory found. Please clone first.",
			};
		}
		const result = await runGitCommand(appDir, ["pull"]);
		if (result.stdout) logLines.push(`[stdout]\n${redact(result.stdout.trim())}`);
		if (result.stderr) logLines.push(`[stderr]\n${redact(result.stderr.trim())}`);
		return {
			success: result.exitCode === 0,
			logs: logLines.join("\n") || "[GIT] No output",
		};
	}
}
