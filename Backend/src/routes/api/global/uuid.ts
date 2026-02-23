import { fileRouter } from "../../..";
import { getUUID } from "../../../lib/DataManager";
import { OpenAPITags } from "../../../lib/openapi";

export = new fileRouter.Path("/").http("GET", "/api/global/uuid", (http) =>
    http
        .ratelimit((limit) => limit.hits(1).window(2000).penalty(100))
        .document({
            description: "Returns the UUID of this instance.",
            tags: ["Global"] as OpenAPITags[],
            operationId: "getUUID",
            responses: {
                200: {
                    description: "Returns the UUID of this instance.",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    status: { type: "string", description: "Status of the UUID retrieval operation." },
                                    uuid: { type: "string", description: "The UUID of this instance." },
                                }
                            }
                        }
                    }
                }
            }
        })
        .onRequest(async (ctr) => {
            const uuid = await getUUID();
            if (!uuid) {
                return ctr.status(500).print({
                    status: "Error retrieving UUID",
                });
            }

            return ctr.print({
                status: "OK",
                uuid: uuid,
            });
        }),
);
