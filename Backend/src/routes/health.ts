import { fileRouter } from "..";

export = new fileRouter.Path("/").http("GET", "/health", (http) =>
    http
        .ratelimit((limit) => limit.hits(1).window(2000).penalty(100))
        .onRequest(async (ctr) => {
            return ctr.print({
                status: "OK"
            });
        })
);
