import { fileRouter, server, VERSION } from "../..";

export = new fileRouter.Path("/").http("GET", "/api/openapi.json", (http) =>
	http.onRequest(async (ctr) => {
		let openAPI = await server.openAPI(
			"SHSF API",
			VERSION.toString(),
            {} as any
		);

		openAPI.components = {
			...openAPI.components,
			securitySchemes: {
				apikey: {
					type: "apiKey",
					in: "header",
					name: "x-access-key",
					scheme: "token",
					description: "API Key",
				},
			},
		};

		// Iterate over all openAPI.paths
		for (const path in openAPI.paths) {
			// Iterate over all methods in the path
			for (const method in openAPI.paths[path] as any) {
				const mmethod = method as any;
				// Add 429 response to all methods
				openAPI.paths[path][mmethod].responses = {
					...openAPI.paths[path][mmethod].responses,
					429: {
						description: "Rate Limit Exceeded",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										message: {
											type: "string",
											description: "Rate Limit Exceeded",
										},
										status: {
											type: "string",
											description: "Status",
											enum: ["FAILED"],
										},
										time_left: {
											type: "number",
											description: "Time Left in Seconds",
										},
										retry_after_ms: {
											type: "number",
											description: "Retry delay in milliseconds",
										},
										penalty_ms: {
											type: "number",
											description:
												"Penalty duration applied to the rate limited bucket in milliseconds",
										},
										limit: {
											type: "number",
											description: "Limit for the primary applied bucket",
										},
										remaining: {
											type: "number",
											description: "Remaining hits for the primary applied bucket",
										},
										reset_after_ms: {
											type: "number",
											description: "Milliseconds until the primary bucket resets",
										},
										policy_id: {
											type: "string",
											description: "Rate limit policy identifier",
										},
										policy_name: {
											type: "string",
											description: "Rate limit policy name",
										},
										mode: {
											type: "string",
											enum: ["enforce", "observe"],
											description: "Policy mode for the matched bucket",
										},
										would_block: {
											type: "boolean",
											description: "Whether the request would have been blocked",
										},
									},
								},
							},
						},
					},
					400: {
						description: "Bad Request",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										message: { type: "string" },
									},
								},
							},
						},
					},
					401: {
						description: "Unauthorized",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										message: { type: "string" },
									},
								},
							},
						},
					},
					403: {
						description: "Forbidden",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										message: { type: "string" },
									},
								},
							},
						},
					},
				};

				// Add Security to all methods
				openAPI.paths[path][mmethod].security = [
					{
						apikey: [],
					},
				];
			}
		}

		openAPI.security = [{ apikey: [] }];
        openAPI.servers = [];

		ctr.status(200);
		ctr.headers.set("Content-Type", "application/json");

		return ctr.print(openAPI);
	}),
);
