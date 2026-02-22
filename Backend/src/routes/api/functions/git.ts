import { API_KEY_HEADER, COOKIE, fileRouter, prisma, INSTANCE_SECRET } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import {
	buildAuthUrl,
	clearAppDirectory,
	encryptSecret,
	decryptSecret,
	getFuncAppDir,
	getGitRepoDir,
	syncSourceDirToApp,
	performGitPull,
	runGitCommand,
	stripCredentialsFromUrl,
	updateGitRemoteUrl,
} from "../../../lib/GitOps";

function redactLogs(s: string): string {
	return s.replace(/\/\/[^:]+:[^@]+@/g, "//[REDACTED]@");
}

export = new fileRouter.Path("/")
	// GET /api/function/{id}/git — return git config (never return password)
	.http("GET", "/api/function/{id}/git", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}

			const id = ctr.params.get("id");
			if (!id || isNaN(parseInt(id))) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: "Invalid function id" });
			}

			const functionData = await prisma.function.findFirst({
				where: { id: parseInt(id), userId: authCheck.user.id },
			});
			if (!functionData) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Function not found" });
			}

			return ctr.print({
				status: "OK",
				data: {
					git_url: functionData.git_url ?? null,
					git_username: functionData.git_username ?? null,
					git_has_credentials: Boolean(functionData.git_password),
					git_periodic_pull: functionData.git_periodic_pull,
					git_pull_interval: functionData.git_pull_interval,
					git_source_dir: functionData.git_source_dir ?? null,
				},
			});
		}),
	)

	// POST /api/function/{id}/git/clone — nuke app dir, clone repo with optional auth
	.http("POST", "/api/function/{id}/git/clone", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}

			const [body, err] = await ctr.bindBody((z) =>
				z.object({
					git_url: z.string().min(3).max(1024),
					git_username: z.string().max(256).optional(),
					git_password: z.string().max(512).optional(),
					git_source_dir: z.string().max(512).optional(),
				}),
			);
			if (!body) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: err.toString() });
			}

			const id = ctr.params.get("id");
			if (!id || isNaN(parseInt(id))) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: "Invalid function id" });
			}
			const functionId = parseInt(id);

			const functionData = await prisma.function.findFirst({
				where: { id: functionId, userId: authCheck.user.id },
			});
			if (!functionData) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Function not found" });
			}

			const appDir = getFuncAppDir(functionId);
			const logLines: string[] = [];

			// Build the URL used for cloning — embeds credentials if provided
			const cloneUrl =
				body.git_username && body.git_password
					? buildAuthUrl(body.git_url, body.git_username, body.git_password)
					: body.git_url;

			const sourceDir = body.git_source_dir?.trim() || null;

			if (sourceDir) {
				// ── Source-dir mode: clone into git_repo/, then sync subdir → app/ ──
				const gitRepoDir = getGitRepoDir(functionId);

				logLines.push(`[GIT] Clearing git_repo directory: ${gitRepoDir}`);
				if (fsSync.existsSync(gitRepoDir)) {
					await fs.rm(gitRepoDir, { recursive: true, force: true });
				}
				logLines.push(`[GIT] git_repo cleared.`);

				logLines.push(`[GIT] Cloning ${stripCredentialsFromUrl(cloneUrl)} into git_repo ...`);
				const cloneResult = await runGitCommand(
					path.dirname(gitRepoDir),
					["clone", cloneUrl, "git_repo"],
				);
				if (cloneResult.stdout) logLines.push(`[stdout]\n${redactLogs(cloneResult.stdout)}`);
				if (cloneResult.stderr) logLines.push(`[stderr]\n${redactLogs(cloneResult.stderr)}`);

				if (cloneResult.exitCode !== 0) {
					logLines.push(`[GIT] Clone failed with exit code ${cloneResult.exitCode}`);
					return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
						status: "FAILED",
						message: "Git clone failed",
						logs: logLines.join("\n"),
					});
				}

				logLines.push(`[GIT] Clone successful! Syncing source directory "${sourceDir}" → app ...`);
				const syncResult = await syncSourceDirToApp(gitRepoDir, sourceDir, appDir);
				logLines.push(`[GIT] ${syncResult.message}`);

				if (!syncResult.success) {
					return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
						status: "FAILED",
						message: syncResult.message,
						logs: logLines.join("\n"),
					});
				}
			} else {
				// ── Legacy mode: clone directly into app/ ──
				logLines.push(`[GIT] Clearing app directory: ${appDir}`);
				await clearAppDirectory(appDir);
				logLines.push(`[GIT] App directory cleared.`);

				logLines.push(`[GIT] Cloning ${stripCredentialsFromUrl(cloneUrl)} ...`);
				const cloneResult = await runGitCommand(path.dirname(appDir), [
					"clone",
					cloneUrl,
					"app",
				]);
				if (cloneResult.stdout) logLines.push(`[stdout]\n${redactLogs(cloneResult.stdout)}`);
				if (cloneResult.stderr) logLines.push(`[stderr]\n${redactLogs(cloneResult.stderr)}`);

				if (cloneResult.exitCode !== 0) {
					logLines.push(`[GIT] Clone failed with exit code ${cloneResult.exitCode}`);
					return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
						status: "FAILED",
						message: "Git clone failed",
						logs: logLines.join("\n"),
					});
				}
				logLines.push(`[GIT] Clone successful!`);
			}

			// Persist config — store the clean URL + credentials separately
			// Encrypt the password at rest using the instance secret.
			await prisma.function.update({
				where: { id: functionId },
				data: {
					git_url: body.git_url,
					git_username: body.git_username ?? null,
					git_password: body.git_password
						? encryptSecret(body.git_password, INSTANCE_SECRET)
						: null,
					git_source_dir: sourceDir,
				},
			});

			return ctr.print({
				status: "OK",
				message: "Repository cloned successfully",
				logs: logLines.join("\n"),
			});
		}),
	)

	// POST /api/function/{id}/git/pull — manual pull
	.http("POST", "/api/function/{id}/git/pull", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}

			const id = ctr.params.get("id");
			if (!id || isNaN(parseInt(id))) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: "Invalid function id" });
			}
			const functionId = parseInt(id);

			const functionData = await prisma.function.findFirst({
				where: { id: functionId, userId: authCheck.user.id },
			});
			if (!functionData) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Function not found" });
			}

			if (!functionData.git_url) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "No git URL configured. Clone a repository first.",
				});
			}

			const result = await performGitPull(functionId, functionData.git_source_dir ?? undefined);

			return ctr.print({
				status: result.success ? "OK" : "FAILED",
				message: result.success ? "Pull successful" : "Pull failed",
				logs: result.logs,
			});
		}),
	)

	// PATCH /api/function/{id}/git — update periodic pull and/or credentials
	.http("PATCH", "/api/function/{id}/git", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}

			const [body, err] = await ctr.bindBody((z) =>
				z.object({
					git_periodic_pull: z.boolean().optional(),
					git_pull_interval: z.number().int().min(1).max(1440).optional(),
					git_username: z.string().max(256).optional().nullable(),
					git_password: z.string().max(512).optional().nullable(),
					git_source_dir: z.string().max(512).optional().nullable(),
				}),
			);
			if (!body) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: err.toString() });
			}

			const id = ctr.params.get("id");
			if (!id || isNaN(parseInt(id))) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: "Invalid function id" });
			}
			const functionId = parseInt(id);

			const functionData = await prisma.function.findFirst({
				where: { id: functionId, userId: authCheck.user.id },
			});
			if (!functionData) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Function not found" });
			}

			if (!functionData.git_url) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "No git URL configured. Configure git first.",
				});
			}

			// Build update payload
			const updateData: Record<string, any> = {};
			if (body.git_periodic_pull !== undefined) {
				updateData.git_periodic_pull = body.git_periodic_pull;
			}
			if (body.git_pull_interval !== undefined) {
				updateData.git_pull_interval = body.git_pull_interval;
			}
			if (body.git_source_dir !== undefined) {
				updateData.git_source_dir = body.git_source_dir?.trim() || null;
			}

			const credentialsChanging =
				body.git_username !== undefined || body.git_password !== undefined;

			if (credentialsChanging) {
				const newUsername =
					body.git_username !== undefined
						? body.git_username
						: functionData.git_username;

				// Determine the plaintext password (for building the auth URL)
				// and the encrypted value to persist.
				let newPasswordPlaintext: string | null = null;
				let newPasswordEncrypted: string | null = null;
				if (body.git_password !== undefined) {
					// Caller is supplying a new password — encrypt for storage.
					newPasswordPlaintext = body.git_password;
					newPasswordEncrypted = body.git_password
						? encryptSecret(body.git_password, INSTANCE_SECRET)
						: null;
				} else if (functionData.git_password) {
					// Reuse the existing encrypted password — decrypt to build the URL.
					newPasswordPlaintext = decryptSecret(functionData.git_password, INSTANCE_SECRET);
					newPasswordEncrypted = functionData.git_password;
				}

				updateData.git_username = newUsername;
				updateData.git_password = newPasswordEncrypted;

				// Update the remote URL in the existing clone so future pulls use new credentials
				// If a source dir is configured the repo lives in git_repo/, otherwise in app/
				const resolvedGitDir = functionData.git_source_dir
					? getGitRepoDir(functionId)
					: getFuncAppDir(functionId);
				const newAuthUrl =
					newUsername && newPasswordPlaintext
						? buildAuthUrl(functionData.git_url, newUsername, newPasswordPlaintext)
						: functionData.git_url;
				await updateGitRemoteUrl(resolvedGitDir, newAuthUrl);
			}

			await prisma.function.update({
				where: { id: functionId },
				data: updateData,
			});

			return ctr.print({
				status: "OK",
				message: "Git settings updated",
			});
		}),
	)

	// DELETE /api/function/{id}/git — remove git configuration
	.http("DELETE", "/api/function/{id}/git", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}

			const id = ctr.params.get("id");
			if (!id || isNaN(parseInt(id))) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: "Invalid function id" });
			}
			const functionId = parseInt(id);

			const functionData = await prisma.function.findFirst({
				where: { id: functionId, userId: authCheck.user.id },
			});
			if (!functionData) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Function not found" });
			}

			await prisma.function.update({
				where: { id: functionId },
				data: {
					git_url: null,
					git_username: null,
					git_password: null,
					git_periodic_pull: false,
					git_source_dir: null,
				},
			});

			// Clean up the git_repo directory if it exists
			const gitRepoDir = getGitRepoDir(functionId);
			if (fsSync.existsSync(gitRepoDir)) {
				await fs.rm(gitRepoDir, { recursive: true, force: true });
			}

			return ctr.print({
				status: "OK",
				message: "Git configuration removed",
			});
		}),
	);
