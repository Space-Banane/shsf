import { fileRouter, prisma, API_KEY_HEADER } from "../../..";
import { env } from "process";
import { checkHttpExecutionPermission } from "../../../lib/Authentication";
import {
	buildPayloadFromGET,
	buildPayloadFromPOST,
	executeFunction,
} from "../../../lib/Runner";
import {
	getPayloadHash,
	getFunctionCache,
	handleFunctionResult,
	setFunctionCache,
} from "../../../lib/Caching";

export = new fileRouter.Path("/")
	.http("GET", "/api/exec/{namespaceId}/{functionId}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(5)
					.window(parseInt(env.RATELIMIT!) || 0)
					.penalty(400)
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

				const payloadHash = getPayloadHash(payload);

				if (functionData.cache_enabled) {
					const cached = await getFunctionCache(functionData.id, payloadHash);
					if (cached) {
						return handleFunctionResult(ctr, JSON.parse(cached.result), true);
					}
				}

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

				if (result?.exit_code === 0 && functionData.cache_enabled) {
					await setFunctionCache(
						functionData.id,
						payloadHash,
						result.result,
						functionData.cache_ttl ?? 60
					);
				}

				return handleFunctionResult(ctr, result?.result, false);
			})
	)
	.http("POST", "/api/exec/{namespaceId}/{functionId}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(5)
					.window(parseInt(env.RATELIMIT!) || 0)
					.penalty(400)
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

				const payloadHash = getPayloadHash(payload);

				if (functionData.cache_enabled) {
					const cached = await getFunctionCache(functionData.id, payloadHash);
					if (cached) {
						return handleFunctionResult(ctr, JSON.parse(cached.result), true);
					}
				}

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

				if (result?.exit_code === 0 && functionData.cache_enabled) {
					await setFunctionCache(
						functionData.id,
						payloadHash,
						result.result,
						functionData.cache_ttl ?? 60
					);
				}

				return handleFunctionResult(ctr, result?.result, false);
			})
	)
	.http("GET", "/exec/{executionAlias}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(5)
					.window(parseInt(env.RATELIMIT!) || 0)
					.penalty(400)
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

				const payloadHash = getPayloadHash(payload);

				if (functionData.cache_enabled) {
					const cached = await getFunctionCache(functionData.id, payloadHash);
					if (cached) {
						return handleFunctionResult(ctr, JSON.parse(cached.result), true);
					}
				}

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

				if (result?.exit_code === 0 && functionData.cache_enabled) {
					await setFunctionCache(
						functionData.id,
						payloadHash,
						result.result,
						functionData.cache_ttl ?? 60
					);
				}

				// Return result if available from main function, otherwise output OK
				return handleFunctionResult(ctr, result?.result, false);
			})
	)
	.http("POST", "/exec/{executionAlias}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(5)
					.window(parseInt(env.RATELIMIT!) || 0)
					.penalty(400)
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

				const payloadHash = getPayloadHash(payload);

				if (functionData.cache_enabled) {
					const cached = await getFunctionCache(functionData.id, payloadHash);
					if (cached) {
						return handleFunctionResult(ctr, JSON.parse(cached.result), true);
					}
				}

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

				if (result?.exit_code === 0 && functionData.cache_enabled) {
					await setFunctionCache(
						functionData.id,
						payloadHash,
						result.result,
						functionData.cache_ttl ?? 60
					);
				}

				return handleFunctionResult(ctr, result?.result, false);
			})
	)
	.http("GET", "/api/exec/{namespaceId}/{functionId}/{route}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(5)
					.window(parseInt(env.RATELIMIT!) || 0)
					.penalty(400)
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

				return handleFunctionResult(ctr, result?.result, false);
			})
	)
	.http("POST", "/api/exec/{namespaceId}/{functionId}/{route}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(5)
					.window(parseInt(env.RATELIMIT!) || 0)
					.penalty(400)
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

				return handleFunctionResult(ctr, result?.result, false);
			})
	);
