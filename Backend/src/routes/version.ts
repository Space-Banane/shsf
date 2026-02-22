import { fileRouter, VERSION } from "..";
import { OpenAPITags } from "../lib/openapi";

export = new fileRouter.Path("/")
	.http("GET", "/version", (http) =>
		http
			.onRequest(async (ctr) => {
				return ctr.print({
					status: "OK",
					version: {
						type: VERSION.type,
						major: VERSION.major,
						minor: VERSION.minor,
						patch: VERSION.patch,
						toString: VERSION.toString(),
						raw: `${VERSION.major}.${VERSION.minor}.${VERSION.patch}`,
					},
				});
			})
			.document({
				description: "Get the current SHSF backend version",
				tags: ["System"] as OpenAPITags[],
				operationId: "getVersion",
				responses: {
					200: {
						description: "Version information",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										version: {
											type: "object",
											properties: {
												type: { type: "string" },
												major: { type: "number" },
												minor: { type: "number" },
												patch: { type: "number" },
												toString: { type: "string" },
												raw: { type: "string" },
											},
										},
									},
								},
							},
						},
					}
				},
			}),
	);
