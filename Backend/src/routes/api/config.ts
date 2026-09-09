import { fileRouter } from "../..";
import { env } from "../../lib/env";
import { OpenAPITags } from "../../lib/openapi";

// Public, non-sensitive runtime configuration. The UI reads this before it
// offers the public demo credentials on the sign-in screen.
export = new fileRouter.Path("/").http("GET", "/api/config", (http) =>
	http
		.document({
			description: "Get public runtime configuration",
			tags: ["System"] as OpenAPITags[],
			operationId: "getPublicRuntimeConfig",
			responses: { 200: { description: "Public runtime configuration" } },
		})
		.onRequest(async (ctr) => ctr.print({ isDemo: env.IS_DEMO })),
);
