import { fileRouter, VERSION } from "..";

export = new fileRouter.Path("/").http("GET", "/version", (http) =>
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
		}),
);
