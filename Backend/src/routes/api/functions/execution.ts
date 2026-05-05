import { fileRouter, prisma } from "../../..";
import { executeLoadedHttpFunction } from "../../../lib/HttpExecution";

type ExecutionLookupMode = "executionId" | "executionAlias";

async function findFunctionForExecution(
	mode: ExecutionLookupMode,
	value: string,
) {
	return prisma.function.findFirst({
		where:
			mode === "executionAlias"
				? { executionAlias: value }
				: { executionId: value },
		include: {
			namespace: { select: { name: true, id: true } },
			files: true,
		},
	});
}

function createExecutionHandler(options: {
	method: "GET" | "POST";
	lookupMode: ExecutionLookupMode;
	valueParam: "functionId" | "executionAlias";
	useCache: boolean;
	resolvePermissionFunctionId: (functionData: { id: number; executionId: string }) => string;
	resolveExecutionAliasOrId: (value: string, functionData: { executionId: string }) => string;
}) {
	return async (ctr: any) => {
		const lookupValue = ctr.params.get(options.valueParam) || "";

		if (options.lookupMode === "executionAlias" && !lookupValue) {
			return ctr.status(ctr.$status.BAD_REQUEST).print({
				status: 400,
				message: "Invalid execution alias",
			});
		}

		const functionData = await findFunctionForExecution(
			options.lookupMode,
			lookupValue,
		);

		if (!functionData) {
			return ctr.status(ctr.$status.NOT_FOUND).print({
				status: 404,
				message: "Function not found",
			});
		}

		return executeLoadedHttpFunction({
			ctr,
			functionData,
			method: options.method,
			namespaceId: functionData.namespaceId,
			permissionFunctionId: options.resolvePermissionFunctionId(functionData),
			executionAliasOrId: options.resolveExecutionAliasOrId(
				lookupValue,
				functionData,
			),
			useCache: options.useCache,
		});
	};
}

// Execution routes intentionally do not use the framework-level route `.ratelimit(...)`.
// Per-function limits are enforced after function lookup and permission checks so the
// applied bucket is driven by function-owned config instead of a coarse shared route limit.
export = new fileRouter.Path("/")
	.http("GET", "/api/exec/{namespaceId}/{functionId}", (http) =>
		http.onRequest(
			createExecutionHandler({
				method: "GET",
				lookupMode: "executionId",
				valueParam: "functionId",
				useCache: true,
				resolvePermissionFunctionId: (functionData) => functionData.executionId,
				resolveExecutionAliasOrId: (value, functionData) =>
					value || functionData.executionId,
			}),
		),
	)
	.http("POST", "/api/exec/{namespaceId}/{functionId}", (http) =>
		http.onRequest(
			createExecutionHandler({
				method: "POST",
				lookupMode: "executionId",
				valueParam: "functionId",
				useCache: true,
				resolvePermissionFunctionId: (functionData) => functionData.executionId,
				resolveExecutionAliasOrId: (value, functionData) =>
					value || functionData.executionId,
			}),
		),
	)
	.http("GET", "/exec/{executionAlias}", (http) =>
		http.onRequest(
			createExecutionHandler({
				method: "GET",
				lookupMode: "executionAlias",
				valueParam: "executionAlias",
				useCache: true,
				resolvePermissionFunctionId: (functionData) => String(functionData.id),
				resolveExecutionAliasOrId: (value, functionData) =>
					value || functionData.executionId,
			}),
		),
	)
	.http("POST", "/exec/{executionAlias}", (http) =>
		http.onRequest(
			createExecutionHandler({
				method: "POST",
				lookupMode: "executionAlias",
				valueParam: "executionAlias",
				useCache: true,
				resolvePermissionFunctionId: (functionData) => String(functionData.id),
				resolveExecutionAliasOrId: (value, functionData) =>
					value || functionData.executionId,
			}),
		),
	)
	.http("GET", "/api/exec/{namespaceId}/{functionId}/{route}", (http) =>
		http.onRequest(
			createExecutionHandler({
				method: "GET",
				lookupMode: "executionId",
				valueParam: "functionId",
				useCache: false,
				resolvePermissionFunctionId: (functionData) => functionData.executionId,
				resolveExecutionAliasOrId: (value, functionData) =>
					value || functionData.executionId,
			}),
		),
	)
	.http("POST", "/api/exec/{namespaceId}/{functionId}/{route}", (http) =>
		http.onRequest(
			createExecutionHandler({
				method: "POST",
				lookupMode: "executionId",
				valueParam: "functionId",
				useCache: false,
				resolvePermissionFunctionId: (functionData) => functionData.executionId,
				resolveExecutionAliasOrId: (value, functionData) =>
					value || functionData.executionId,
			}),
		),
	);
