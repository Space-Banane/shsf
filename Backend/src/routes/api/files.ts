import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../..";
import { checkAuthentication } from "../../lib/Authentication";
import Docker from "dockerode";
import path from "path";
import * as fs from "fs/promises";

// Add Docker integration
const docker = new Docker();

// Helper function to update container dependencies when key files change
async function updateContainerDependencies(
	functionId: number,
	filename: string,
	content: string,
) {
	// Only process dependency files
	if (filename !== "requirements.txt" && filename !== "package.json") {
		return;
	}

	const containerName = `shsf_func_${functionId}`;
	try {
		const container = docker.getContainer(containerName);
		await container.restart();
		console.log(
			`[SHSF] Restarted container ${containerName} due to changes in ${filename}`,
		);
		return true;
	} catch (err) {
		console.error(`[SHSF] Failed to restart container ${containerName}:`, err);
		return false;
	}
}

export = new fileRouter.Path("/")
	.http("PUT", "/api/function/{id}/file", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);

			if (!authCheck.success) {
				return ctr.print({
					status: 401,
					message: authCheck.message,
				});
			}

			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					filename: z.string().min(1).max(256),
					code: z.string(),
				}),
			);

			if (!data) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: error.toString(),
				});
			}

			const DisallowedFiles = ["_runner.py", "_runner.js", "init.sh"];
			if (DisallowedFiles.includes(data.filename)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: `File name "${data.filename}" is not allowed`,
				});
			}

			const id = ctr.params.get("id");
			if (!id) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Missing function id",
				});
			}
			const functionId = parseInt(id);
			if (isNaN(functionId)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Invalid function id",
				});
			}

			const existingFile = await prisma.functionFile.findFirst({
				where: {
					functionId: functionId,
					name: data.filename,
				},
			});

			let out;
			if (existingFile) {
				out = await prisma.functionFile.update({
					where: {
						id: existingFile.id,
					},
					data: {
						content: data.code,
					},
				});
			} else {
				out = await prisma.functionFile.create({
					data: {
						name: data.filename,
						content: data.code,
						functionId: functionId,
					},
				});
			}

			// Also write the file to the host function app directory so persistent containers
			// that use a bind mount will see the changes.
			const funcAppDir = path.join(
				"/opt/shsf_data/functions",
				String(functionId),
				"app",
			);
			try {
				await fs.mkdir(funcAppDir, { recursive: true });
				await fs.writeFile(path.join(funcAppDir, data.filename), data.code, {
					encoding: "utf-8",
				});
				console.log(
					`[SHSF] Wrote updated file to host app dir: ${path.join(funcAppDir, data.filename)}`,
				);
			} catch (err) {
				console.error(`[SHSF] Failed to write updated file to host:`, err);
			}

			console.log(
				`[SHSF] Updated host file for function ${functionId}: ${path.join(funcAppDir, data.filename)}`,
			);

			return ctr.print({
				status: "OK",
				data: out,
			});
		}),
	)
	.http("GET", "/api/function/{id}/files", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);

			if (!authCheck.success) {
				return ctr.print({
					status: 401,
					message: authCheck.message,
				});
			}

			const id = ctr.params.get("id");
			if (!id) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Missing function id",
				});
			}
			const functionId = parseInt(id);
			if (isNaN(functionId)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Invalid function id",
				});
			}

			const files = await prisma.functionFile.findMany({
				where: {
					functionId: functionId,
				},
			});

			return ctr.print({
				status: "OK",
				data: files,
			});
		}),
	)
	.http("DELETE", "/api/function/{id}/file/{fileId}", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);

			if (!authCheck.success) {
				return ctr.print({
					status: 401,
					message: authCheck.message,
				});
			}

			const id = ctr.params.get("id");
			const fileId = ctr.params.get("fileId");

			if (!id || !fileId) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Missing function id or file id",
				});
			}

			const functionId = parseInt(id);
			const fileIdInt = parseInt(fileId);

			if (isNaN(functionId) || isNaN(fileIdInt)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Invalid function id or file id",
				});
			}

			const totalFiles = await prisma.functionFile.count({
				where: {
					functionId: functionId,
				},
			});

			if (totalFiles <= 1) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Cannot delete the only file in the function",
				});
			}

			const fileToDelete = await prisma.functionFile.findUnique({
				where: { id: fileIdInt },
			});

			await prisma.functionFile.delete({
				where: {
					id: fileIdInt,
				},
			});

			// If deleting a dependencies file, we should create an empty one
			// to prevent broken deployments
			if (
				fileToDelete &&
				(fileToDelete.name === "requirements.txt" ||
					fileToDelete.name === "package.json")
			) {
				const funcAppDir = path.join(
					"/opt/shsf_data/functions",
					String(functionId),
					"app",
				);
				try {
					await fs.writeFile(
						path.join(funcAppDir, fileToDelete.name),
						"# File was deleted\n",
					);
					console.log(
						`[SHSF] Created empty ${fileToDelete.name} after deletion to prevent broken deployments`,
					);
				} catch (err) {
					console.error(`[SHSF] Error creating empty ${fileToDelete.name}:`, err);
				}
			}

			return ctr.print({
				status: "OK",
				message: "File deleted successfully",
			});
		}),
	)
	.http("PATCH", "/api/function/{id}/file/{fileId}/rename", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);

			if (!authCheck.success) {
				return ctr.print({
					status: 401,
					message: authCheck.message,
				});
			}

			const id = ctr.params.get("id");
			const fileId = ctr.params.get("fileId");

			if (!id || !fileId) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Missing function id or file id",
				});
			}

			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					newFilename: z.string().min(1).max(256),
				}),
			);

			if (!data) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: error.toString(),
				});
			}

			const functionId = parseInt(id);
			const fileIdInt = parseInt(fileId);

			if (isNaN(functionId) || isNaN(fileIdInt)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Invalid function id or file id",
				});
			}

			const oldFile = await prisma.functionFile.findUnique({
				where: { id: fileIdInt },
			});

			const updatedFile = await prisma.functionFile.update({
				where: {
					id: fileIdInt,
				},
				data: {
					name: data.newFilename,
				},
			});

			// Handle renames of dependency files, which requires updating files on disk too
			if (
				oldFile &&
				(oldFile.name === "requirements.txt" ||
					oldFile.name === "package.json" ||
					data.newFilename === "requirements.txt" ||
					data.newFilename === "package.json")
			) {
				const funcAppDir = path.join(
					"/opt/shsf_data/functions",
					String(functionId),
					"app",
				);
				try {
					// If renaming away from a dependency file, create an empty one
					if (
						oldFile.name === "requirements.txt" ||
						oldFile.name === "package.json"
					) {
						await fs.writeFile(
							path.join(funcAppDir, oldFile.name),
							"# File was renamed\n",
						);
						console.log(
							`[SHSF] Created empty ${oldFile.name} after rename to prevent broken deployments`,
						);
					}

					// If renaming to a dependency file, write the content and update dependencies
					if (
						data.newFilename === "requirements.txt" ||
						data.newFilename === "package.json"
					) {
						await fs.writeFile(
							path.join(funcAppDir, data.newFilename),
							updatedFile.content,
						);
						await updateContainerDependencies(
							functionId,
							data.newFilename,
							updatedFile.content,
						);
					}
				} catch (err) {
					console.error(`[SHSF] Error handling rename of dependency file:`, err);
				}
			}

			return ctr.print({
				status: "OK",
				data: updatedFile,
			});
		}),
	)
	.http("POST", "/api/function/{id}/file/{fileId}/load-fill_default", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);

			if (!authCheck.success) {
				return ctr.print({
					status: 401,
					message: authCheck.message,
				});
			}

			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					defaultToLoad: z.string(),
				}),
			);

			if (!data) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: error.toString(),
				});
			}

			const id = ctr.params.get("id");
			const fileId = ctr.params.get("fileId");

			if (!id || !fileId) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Missing function id or file id",
				});
			}

			const functionId = parseInt(id);
			const fileIdInt = parseInt(fileId);

			if (isNaN(functionId) || isNaN(fileIdInt)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Invalid function id or file id",
				});
			}

			const fileToFill = await prisma.functionFile.findUnique({
				where: { id: fileIdInt },
			});

			if (!fileToFill) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "File not found",
				});
			}

			// Get the function to check its runtime
			const func = await prisma.function.findUnique({
				where: { id: functionId },
				select: { image: true },
			});

			if (!func) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function not found",
				});
			}

			// Map the defaultToLoad to actual file path
			const defaultFileMap: Record<string, string> = {
				python_default: "../fill_examples/default.py",
				python_data_passing: "../fill_examples/data_passing.py",
				python_custom_responses: "../fill_examples/custom_responses.py",
				python_environment_variables: "../fill_examples/environment_variables.py",
				python_persistent_data: "../fill_examples/persistent_data.py",
				python_redirects: "../fill_examples/redirects.py",
				python_secure_headers: "../fill_examples/secure_headers.py",
				python_database_communication: "../fill_examples/database_communication.py",
				python_routing: "../fill_examples/routing.py",
				python_discord_webhook: "../fill_examples/discord_webhook.py",
				python_api_client: "../fill_examples/api_client.py",
				go_default: "../fill_examples/default.go",
				go_data_passing: "../fill_examples/data_passing.go",
				go_custom_responses: "../fill_examples/custom_responses.go",
				go_routing: "../fill_examples/routing.go",
				go_redirects: "../fill_examples/redirects.go",
			};

			const filePath = defaultFileMap[data.defaultToLoad];
			if (!filePath) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: `Unknown default template: ${data.defaultToLoad}`,
				});
			}

			// Validate runtime matches the template
			const templateLanguage = data.defaultToLoad.split("_")[0]; // Extract language prefix (e.g., "python" from "python_default")
			const functionRuntime = func.image.toLowerCase(); // e.g., "python:3.11"

			// Check if the runtime matches the template language
			if (!functionRuntime.startsWith(templateLanguage)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: `Cannot load ${templateLanguage} template into a ${functionRuntime.split(":")[0]} function`,
				});
			}

			// Actually filling it
			let loadedContent: string;
			try {
				loadedContent = await fs.readFile(filePath, { encoding: "utf-8" });
			} catch (err) {
				console.error(`[SHSF] Error reading default file ${filePath}:`, err);
				return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
					status: 500,
					message: "Failed to load default template",
				});
			}

			const updatedFile = await prisma.functionFile.update({
				where: {
					id: fileIdInt,
				},
				data: {
					content: loadedContent,
				},
			});

			return ctr.print({
				status: "OK",
				data: updatedFile,
			});
		}),
	)
	.http("GET", "/api/function-fill-defaults", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);

			if (!authCheck.success) {
				return ctr.print({
					status: 401,
					message: authCheck.message,
				});
			}

			// Read all files from fill_examples directory
			try {
				const fillExamplesDir = "../fill_examples";
				const files = await fs.readdir(fillExamplesDir);

				// Convert filenames to default names with metadata
				// e.g., "default.py" -> { id: "python_default", name: "Default", language: "python", description: "..." }
				const defaults = files
					.filter(
						(file) =>
							file.endsWith(".py") ||
							file.endsWith(".js") ||
							file.endsWith(".ts") ||
							file.endsWith(".go"),
					)
					.map((file) => {
						const nameWithoutExt = file.replace(/\.[^.]+$/, "");
						let language = "";
						let id = "";

						const descriptions: Record<string, string> = {
							default: "Basic function template",
							data_passing:
								"Receive and process JSON data from triggers or HTTP requests",
							custom_responses: "Return custom HTTP status codes and responses",
							environment_variables: "Securely use API keys via environment variables",
							persistent_data: "Store data that persists between function invocations",
							redirects: "Implement HTTP redirects (301/302)",
							secure_headers: "Validate x-secure-header for additional security",
							database_communication: "Use SHSF's built-in database interface",
							routing: "Handle multiple routes in a single function",
							discord_webhook: "Send messages to Discord (great for scheduled tasks)",
							api_client: "Make authenticated requests to external APIs",
						};

						if (file.endsWith(".py")) {
							language = "python";
							id = `python_${nameWithoutExt}`;
						} else if (file.endsWith(".js")) {
							language = "javascript";
							id = `javascript_${nameWithoutExt}`;
						} else if (file.endsWith(".ts")) {
							language = "typescript";
							id = `typescript_${nameWithoutExt}`;
						} else if (file.endsWith(".go")) {
							language = "go";
							id = `go_${nameWithoutExt}`;
						}

						const name = nameWithoutExt
							.split("_")
							.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
							.join(" ");

						return {
							id,
							name,
							language,
							description: descriptions[nameWithoutExt] || "No description available",
						};
					});

				return ctr.print({
					status: "OK",
					defaults,
				});
			} catch (err) {
				console.error("[SHSF] Error reading fill_examples directory:", err);
				return ctr.print({
					status: "OK",
					defaults: [
						{
							id: "python_default",
							name: "Default",
							language: "python",
							description: "Basic function template",
						},
					],
				});
			}
		}),
	);
