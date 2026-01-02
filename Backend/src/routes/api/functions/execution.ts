import { fileRouter, prisma } from "../../..";
import { env } from "process";
import { checkHttpExecutionPermission } from "../../../lib/Authentication";
import {
	buildPayloadFromGET,
	buildPayloadFromPOST,
	cleanupFunctionContainer,
	executeFunction,
} from "../../../lib/Runner";

export = new fileRouter.Path("/")
	.http("GET", "/api/exec/{namespaceId}/{functionId}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(2)
					.window(parseInt(env.RATELIMIT!) || 2000)
					.penalty(1000)
			)
			.onRequest(async (ctr) => {
				const namespaceId = parseInt(ctr.params.get("namespaceId") || "");
				const functionId = ctr.params.get("functionId") || "";

				if (isNaN(namespaceId)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid namespace",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						executionId: functionId,
						namespaceId: namespaceId,
					},
					include: {
						namespace: { select: { name: true, id: true } },
						files: true,
					},
				});

				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				if (!functionData.allow_http) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "HTTP execution is not allowed for this function",
					});
				}

				// --- streamlined permission check ---
				const permissionToExecute = await checkHttpExecutionPermission(
					ctr,
					functionData,
					namespaceId,
					functionId
				);

				if (permissionToExecute.redirect) {
					return ctr
						.status(ctr.$status.TEMPORARY_REDIRECT)
						.redirect(permissionToExecute.redirect);
				}
				if (!permissionToExecute.state) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: permissionToExecute.reason,
					});
				}
				// --- end streamlined ---

				// Build the payload from GET request
				const payload = await buildPayloadFromGET(ctr);

				// Execute with run parameter instead of inject.json
				const result = await executeFunction(
					functionData.id,
					functionData,
					functionData.files,
					{ enabled: false },
					JSON.stringify({
						ran_by: "exec",
						...(typeof payload === "object" && payload !== null ? payload : {}),
					})
				);

				// we might be able to do magic here
				if (typeof result?.result === "object" && result?.result !== null) {
					const out = result.result; // quicker to write and access

					if ("_shsf" in out) {
						const version: "v2" = out._shsf; // always v2 currently
						const headers: { key: string; value: any }[] | null =
							"_headers" in out
								? Object.entries(out._headers).map(([key, value]) => ({
										key,
										value,
								  }))
								: null;
						const response_code: number | null = "_code" in out ? out._code : null;
						const response: any | null = "_res" in out ? out._res : null;

						if (response_code === 301 || response_code === 302) {
							// Handle redirects
							ctr.status(response_code);
							if (headers) {
								headers.forEach(({ key, value }) => {
									ctr.headers.set(key, value);
								});
							}
							const link = "_location" in out ? out._location : "/";
							return ctr.redirect(link);
						}

						ctr.status(response_code || 200);

						if (headers) {
							headers.forEach(({ key, value }) => {
								ctr.headers.set(key, value);
							});
						}

						if (response) {
							return ctr.print(response);
						} else {
							return ctr.print("No Function Result :(");
						}
					}
				}

				// Return result if available from main function, otherwise output OK
				return ctr.print(result?.result ?? "No Function Result :(");
			})
	)
	.http("POST", "/api/exec/{namespaceId}/{functionId}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(2)
					.window(parseInt(env.RATELIMIT!) || 2000)
					.penalty(1000)
			)
			.onRequest(async (ctr) => {
				const namespaceId = parseInt(ctr.params.get("namespaceId") || "");
				const functionId = ctr.params.get("functionId") || "";

				if (isNaN(namespaceId)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid namespace",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						executionId: functionId,
						namespaceId: namespaceId,
					},
					include: {
						namespace: { select: { name: true, id: true } },
						files: true,
					},
				});

				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				if (!functionData.allow_http) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "HTTP execution is not allowed for this function",
					});
				}

				// --- streamlined permission check ---
				const permissionToExecute = await checkHttpExecutionPermission(
					ctr,
					functionData,
					namespaceId,
					functionId
				);

				if (permissionToExecute.redirect) {
					return ctr
						.status(ctr.$status.TEMPORARY_REDIRECT)
						.redirect(permissionToExecute.redirect);
				}
				if (!permissionToExecute.state) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: permissionToExecute.reason,
					});
				}
				// --- end streamlined ---

				// Build the payload from POST request
				const payload = await buildPayloadFromPOST(ctr);

				const result = await executeFunction(
					functionData.id,
					functionData,
					functionData.files,
					{ enabled: false },
					JSON.stringify({
						ran_by: "exec",
						...(typeof payload === "object" && payload !== null ? payload : {}),
					})
				);

				// we might be able to do magic here
				if (typeof result?.result === "object" && result?.result !== null) {
					const out = result.result; // quicker to write and access

					if ("_shsf" in out) {
						const version: "v2" = out._shsf; // always v2 currently
						const headers: { key: string; value: any }[] | null =
							"_headers" in out
								? Object.entries(out._headers).map(([key, value]) => ({
										key,
										value,
								  }))
								: null;
						const response_code: number | null = "_code" in out ? out._code : null;
						const response: any | null = "_res" in out ? out._res : null;

						if (response_code === 301 || response_code === 302) {
							// Handle redirects
							ctr.status(response_code);
							if (headers) {
								headers.forEach(({ key, value }) => {
									ctr.headers.set(key, value);
								});
							}
							const link = "_location" in out ? out._location : "/";
							return ctr.redirect(link);
						}

						ctr.status(response_code || 200);

						if (headers) {
							headers.forEach(({ key, value }) => {
								ctr.headers.set(key, value);
							});
						}

						if (response) {
							return ctr.print(response);
						} else {
							return ctr.print("No Function Result :(");
						}
					}
				}

				return ctr.print(result?.result ?? "No Function Result :(");
			})
	)
	.http("GET", "/exec/{executionAlias}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(2)
					.window(parseInt(env.RATELIMIT!) || 2000)
					.penalty(1000)
			)
			.onRequest(async (ctr) => {
				const executionAlias = ctr.params.get("executionAlias") || "";

				if (!executionAlias) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid execution alias",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						executionAlias: executionAlias,
					},
					include: {
						namespace: { select: { name: true, id: true } },
						files: true,
					},
				});

				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				if (!functionData.allow_http) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "HTTP execution is not allowed for this function",
					});
				}

				// --- streamlined permission check ---
				const permissionToExecute = await checkHttpExecutionPermission(
					ctr,
					functionData,
					functionData.namespaceId,
					String(functionData.id)
				);

				if (permissionToExecute.redirect) {
					return ctr
						.status(ctr.$status.TEMPORARY_REDIRECT)
						.redirect(permissionToExecute.redirect);
				}
				if (!permissionToExecute.state) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: permissionToExecute.reason,
					});
				}
				// --- end streamlined ---

				// Build the payload from GET request
				const payload = await buildPayloadFromGET(ctr);

				// Execute with run parameter instead of inject.json
				const result = await executeFunction(
					functionData.id,
					functionData,
					functionData.files,
					{ enabled: false },
					JSON.stringify({
						ran_by: "exec",
						...(typeof payload === "object" && payload !== null ? payload : {}),
					})
				);

				// we might be able to do magic here
				if (typeof result?.result === "object" && result?.result !== null) {
					const out = result.result; // quicker to write and access

					if ("_shsf" in out) {
						const version: "v2" = out._shsf; // always v2 currently
						const headers: { key: string; value: any }[] | null =
							"_headers" in out
								? Object.entries(out._headers).map(([key, value]) => ({
										key,
										value,
								  }))
								: null;
						const response_code: number | null = "_code" in out ? out._code : null;
						const response: any | null = "_res" in out ? out._res : null;

						if (response_code === 301 || response_code === 302) {
							// Handle redirects
							ctr.status(response_code);
							if (headers) {
								headers.forEach(({ key, value }) => {
									ctr.headers.set(key, value);
								});
							}
							const link = "_location" in out ? out._location : "/";
							return ctr.redirect(link);
						}

						ctr.status(response_code || 200);

						if (headers) {
							headers.forEach(({ key, value }) => {
								ctr.headers.set(key, value);
							});
						}

						if (response) {
							return ctr.print(response);
						} else {
							return ctr.print("No Function Result :(");
						}
					}
				}

				// Return result if available from main function, otherwise output OK
				return ctr.print(result?.result ?? "No Function Result :(");
			})
	)
	.http("POST", "/exec/{executionAlias}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(2)
					.window(parseInt(env.RATELIMIT!) || 2000)
					.penalty(1000)
			)
			.onRequest(async (ctr) => {
				const executionAlias = ctr.params.get("executionAlias") || "";

				if (!executionAlias) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid execution alias",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						executionAlias: executionAlias,
					},
					include: {
						namespace: { select: { name: true, id: true } },
						files: true,
					},
				});

				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				if (!functionData.allow_http) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "HTTP execution is not allowed for this function",
					});
				}

				// --- streamlined permission check ---
				const permissionToExecute = await checkHttpExecutionPermission(
					ctr,
					functionData,
					functionData.namespaceId,
					String(functionData.id)
				);

				if (permissionToExecute.redirect) {
					return ctr
						.status(ctr.$status.TEMPORARY_REDIRECT)
						.redirect(permissionToExecute.redirect);
				}
				if (!permissionToExecute.state) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: permissionToExecute.reason,
					});
				}
				// --- end streamlined ---

				// Build the payload from POST request
				const payload = await buildPayloadFromPOST(ctr);

				const result = await executeFunction(
					functionData.id,
					functionData,
					functionData.files,
					{ enabled: false },
					JSON.stringify({
						ran_by: "exec",
						...(typeof payload === "object" && payload !== null ? payload : {}),
					})
				);

				// we might be able to do magic here
				if (typeof result?.result === "object" && result?.result !== null) {
					const out = result.result; // quicker to write and access

					if ("_shsf" in out) {
						const version: "v2" = out._shsf; // always v2 currently
						const headers: { key: string; value: any }[] | null =
							"_headers" in out
								? Object.entries(out._headers).map(([key, value]) => ({
										key,
										value,
								  }))
								: null;
						const response_code: number | null = "_code" in out ? out._code : null;
						const response: any | null = "_res" in out ? out._res : null;

						if (response_code === 301 || response_code === 302) {
							// Handle redirects
							ctr.status(response_code);
							if (headers) {
								headers.forEach(({ key, value }) => {
									ctr.headers.set(key, value);
								});
							}
							const link = "_location" in out ? out._location : "/";
							return ctr.redirect(link);
						}

						ctr.status(response_code || 200);

						if (headers) {
							headers.forEach(({ key, value }) => {
								ctr.headers.set(key, value);
							});
						}

						if (response) {
							return ctr.print(response);
						} else {
							return ctr.print("No Function Result :(");
						}
					}
				}

				return ctr.print(result?.result ?? "No Function Result :(");
			})
	)
	.http("GET", "/api/exec/{namespaceId}/{functionId}/{route}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(2)
					.window(parseInt(env.RATELIMIT!) || 2000)
					.penalty(1000)
			)
			.onRequest(async (ctr) => {
				const namespaceId = parseInt(ctr.params.get("namespaceId") || "");
				const functionId = ctr.params.get("functionId") || "";

				if (isNaN(namespaceId)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid namespace",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						executionId: functionId,
						namespaceId: namespaceId,
					},
					include: {
						namespace: { select: { name: true, id: true } },
						files: true,
					},
				});

				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				if (!functionData.allow_http) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "HTTP execution is not allowed for this function",
					});
				}

				// --- streamlined permission check ---
				const permissionToExecute = await checkHttpExecutionPermission(
					ctr,
					functionData,
					namespaceId,
					functionId
				);

				if (permissionToExecute.redirect) {
					return ctr
						.status(ctr.$status.TEMPORARY_REDIRECT)
						.redirect(permissionToExecute.redirect);
				}
				if (!permissionToExecute.state) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: permissionToExecute.reason,
					});
				}
				// --- end streamlined ---

				// Build the payload from GET request
				const payload = await buildPayloadFromGET(ctr);

				// Execute with run parameter instead of inject.json
				const result = await executeFunction(
					functionData.id,
					functionData,
					functionData.files,
					{ enabled: false },
					JSON.stringify({
						ran_by: "exec",
						...(typeof payload === "object" && payload !== null ? payload : {}),
					})
				);

				// we might be able to do magic here
				if (typeof result?.result === "object" && result?.result !== null) {
					const out = result.result; // quicker to write and access

					if ("_shsf" in out) {
						const version: "v2" = out._shsf; // always v2 currently
						const headers: { key: string; value: any }[] | null =
							"_headers" in out
								? Object.entries(out._headers).map(([key, value]) => ({
										key,
										value,
								  }))
								: null;
						const response_code: number | null = "_code" in out ? out._code : null;
						const response: any | null = "_res" in out ? out._res : null;

						if (response_code === 301 || response_code === 302) {
							// Handle redirects
							ctr.status(response_code);
							if (headers) {
								headers.forEach(({ key, value }) => {
									ctr.headers.set(key, value);
								});
							}
							const link = "_location" in out ? out._location : "/";
							return ctr.redirect(link);
						}

						ctr.status(response_code || 200);

						if (headers) {
							headers.forEach(({ key, value }) => {
								ctr.headers.set(key, value);
							});
						}

						if (response) {
							return ctr.print(response);
						} else {
							return ctr.print("No Function Result :(");
						}
					}
				}

				// Return result if available from main function, otherwise output OK
				return ctr.print(result?.result ?? "No Function Result :(");
			})
	)
	.http("POST", "/api/exec/{namespaceId}/{functionId}/{route}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(2)
					.window(parseInt(env.RATELIMIT!) || 2000)
					.penalty(1000)
			)
			.onRequest(async (ctr) => {
				const namespaceId = parseInt(ctr.params.get("namespaceId") || "");
				const functionId = ctr.params.get("functionId") || "";

				if (isNaN(namespaceId)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid namespace",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						executionId: functionId,
						namespaceId: namespaceId,
					},
					include: {
						namespace: { select: { name: true, id: true } },
						files: true,
					},
				});

				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				if (!functionData.allow_http) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "HTTP execution is not allowed for this function",
					});
				}

				// --- streamlined permission check ---
				const permissionToExecute = await checkHttpExecutionPermission(
					ctr,
					functionData,
					namespaceId,
					functionId
				);

				if (permissionToExecute.redirect) {
					return ctr
						.status(ctr.$status.TEMPORARY_REDIRECT)
						.redirect(permissionToExecute.redirect);
				}
				if (!permissionToExecute.state) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: permissionToExecute.reason,
					});
				}
				// --- end streamlined ---

				// Build the payload from POST request
				const payload = await buildPayloadFromPOST(ctr);

				const result = await executeFunction(
					functionData.id,
					functionData,
					functionData.files,
					{ enabled: false },
					JSON.stringify({
						ran_by: "exec",
						...(typeof payload === "object" && payload !== null ? payload : {}),
					})
				);

				// we might be able to do magic here
				if (typeof result?.result === "object" && result?.result !== null) {
					const out = result.result; // quicker to write and access

					if ("_shsf" in out) {
						const version: "v2" = out._shsf; // always v2 currently
						const headers: { key: string; value: any }[] | null =
							"_headers" in out
								? Object.entries(out._headers).map(([key, value]) => ({
										key,
										value,
								  }))
								: null;
						const response_code: number | null = "_code" in out ? out._code : null;
						const response: any | null = "_res" in out ? out._res : null;

						if (response_code === 301 || response_code === 302) {
							// Handle redirects
							ctr.status(response_code);
							if (headers) {
								headers.forEach(({ key, value }) => {
									ctr.headers.set(key, value);
								});
							}
							const link = "_location" in out ? out._location : "/";
							return ctr.redirect(link);
						}

						ctr.status(response_code || 200);

						if (headers) {
							headers.forEach(({ key, value }) => {
								ctr.headers.set(key, value);
							});
						}

						if (response) {
							return ctr.print(response);
						} else {
							return ctr.print("No Function Result :(");
						}
					}
				}

				return ctr.print(result?.result ?? "No Function Result :(");
			})
	);
