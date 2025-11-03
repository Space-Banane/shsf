import { PrismaClient } from "@prisma/client";
import { Cors, Middleware, Server } from "rjweb-server";
import { Runtime } from "@rjweb/runtime-node";
import { network } from "@rjweb/utils";
import { env } from "process";
import { CronExpressionParser } from "cron-parser";
import { executeFunction } from "./lib/Runner";

export const URL = env.UI_URL!;
export const COOKIE = "shsf_session";
export const DOMAIN = env.DOMAIN!;
export const API_KEY_HEADER = "x-access-key";
export const prisma = new PrismaClient({
  log: ["info", "error", "warn"],
  errorFormat: "pretty",
  transactionOptions: { timeout: 30000, maxWait: 20000 },
});

const CORS_DOMAINS = env.CORS_URLS!.split(",");
CORS_DOMAINS.push(URL);
console.log(CORS_DOMAINS);

console.log(
  `Im reachable on ${env.PORT}; For Example: ${env.REACT_APP_API_URL}`
);
export const API_URL = env.REACT_APP_API_URL;
if (!API_URL) {
  throw new Error("REACT_APP_API_URL is not defined in environment variables");
}
CORS_DOMAINS.push(API_URL);

// Middleware Definition
export const middleware = new Middleware<{}, {}>("Custom Cors", "1.0.3")
  .load((config) => {
    console.log(`Custom Cors Locked and Loaded`);
  })
  .httpRequest(async (config, server, context, ctr, end) => {
    console.log(
      `[SHSF API] ${ctr.client.ip} [${ctr.url.method}]➡️  ${ctr.url.href}`
    );

    // Check CORS
    const origin = ctr.headers.get("origin");

    // Validate origin first, regardless of method
    if (origin && !CORS_DOMAINS.includes(origin)) {
      let allowRequest = false;
      console.log(`[CORS MIDDLEWARE] Policy (Provisional): This origin is not allowed access - ${origin}`);

      // Check if its an exec request
      if (ctr.url.path.startsWith("/api/exec/")) {
        // /api/exec/4/02df8773-1d03-48df-9dd7-fd452c5ba592
        console.log(`[CORS MIDDLEWARE] Custom CORS might change the outcome of this request. (Function Execution Detected)`);

        const execId = ctr.url.path.split("/")[4]; // UUID
        const func = await prisma.function.findFirst({
          where: { executionId: execId },
        });
        if (func && func.cors_origins) {
          console.log(`[CORS MIDDLEWARE] Policy: Allowing access for ${origin} - ${execId}`);
          CORS_DOMAINS.push(...func.cors_origins);
          allowRequest = true;
        } else {
          console.log(`[CORS MIDDLEWARE] Policy: No specific origins found for function - ${execId}`);
        }
      }

      if (!allowRequest) {
        console.log(`[CORS MIDDLEWARE] Policy (Final Decision): This origin is not allowed access - ${origin}`);
        return end(
          ctr.status(ctr.$status.FORBIDDEN).print({
            status: "FAILED",
            message: "SERVER CORS Policy: This origin is not allowed access",
          })
        );
      }
    }

    const allowedHeaders = ctr.headers.get("access-control-request-headers") || "content-type, x-*";
    const allowedMethods = "GET, POST, PUT, DELETE, OPTIONS, PATCH";
    const allowCredentials = "true";
    const controlMaxAge = "86400";

    if (origin) {
      if (ctr.url.method === "OPTIONS") {
        ctr.headers.set("Access-Control-Max-Age", controlMaxAge);
        ctr.headers.set("Content-Length", "0");
        ctr.headers.set("Access-Control-Allow-Origin", origin);
        ctr.headers.set("Access-Control-Allow-Methods", allowedMethods);
        ctr.headers.set("Vary", "Origin");
        ctr.headers.set("Access-Control-Allow-Headers", allowedHeaders);
        ctr.headers.set("Access-Control-Allow-Credentials", allowCredentials);
        console.log(`[CORS MIDDLEWARE] Preflight handled for origin: ${origin}`);
        return end(ctr.status(ctr.$status.NO_CONTENT).print(""));
      }

      ctr.headers.set("Access-Control-Allow-Origin", origin);
      ctr.headers.set("Vary", "Origin");
      ctr.headers.set("Access-Control-Allow-Methods", allowedMethods);
      ctr.headers.set("Access-Control-Allow-Headers", allowedHeaders);
      ctr.headers.set("Access-Control-Allow-Credentials", allowCredentials);
    }
  })
  .export();

export const server = new Server(
  Runtime,
  {
    port: parseInt(env.PORT!),
    bind: "0.0.0.0",
    version: false,
    performance: { lastModified: false, eTag: false },
    logging: { warn: true, debug: false, error: true },
    proxy: {
      enabled: true,
      credentials: {
        authenticate: false,
      },
      ips: {
        validate: true,
        list: [new network.Subnet("192.168.32.0/24")],
      },
    },
  },
  [middleware.use({})]
);

export const fileRouter = new server.FileLoader("/")
  .load("./routes", { fileBasedRouting: false })
  .export();

server.notFound(async (ctr) => {
  return ctr.status(ctr.$status.NOT_FOUND).print({
    status: "FAILED",
    message: "The requested resource was not found",
  });
});

server
  .start()
  .then(async (port) => {
    await prisma.$connect();

    console.log(`[SHSF API] Running on ${port}`);

    setInterval(async () => {
      await processCrons();
    }, 1000); // Every second
  })
  .catch(console.error);

server.error("httpRequest", async (ctr, error) => {
  console.error(error);
  ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
    status: "ERROR",
    message: "An Unknown Server Error has occurred",
  });
});

// Crons
async function processCrons() {
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  const crons = await prisma.functionTrigger.findMany({
    where: {
      OR: [
        {
          nextRun: {
            gte: now,
            lte: fiveMinutesFromNow,
          },
        },
        {
          nextRun: null,
        },
      ],
      enabled: true,
    },
    include: {
      function: true,
    },
  });

  for (const cron of crons) {
    const interval = CronExpressionParser.parse(cron.cron!, {
      currentDate: now,
    });

    try {
      // If nextRun is null, calculate and set it
      if (cron.nextRun === null) {
        const next = interval.next().toDate();
        await prisma.functionTrigger.update({
          where: { id: cron.id },
          data: { nextRun: next },
        });
        console.log(`Cron #${cron.id} nextRun set to ${next.toISOString()}`);
        continue; // Skip further processing for this iteration
      }

      const next = interval.next();

      // Adjusted logic to ensure the cron fires correctly
      if (next.getTime() <= now.getTime() + 1000) {
        await prisma.functionTrigger.update({
          where: { id: cron.id },
          data: {
            lastRun: now,
            nextRun: interval.next().toDate(), // Update nextRun to the following occurrence
          },
        });

        console.log(`[SHSF CRONS] Cron #${cron.id} executed`);
        const files = await prisma.functionFile.findMany({
          where: { functionId: cron.functionId },
        });

        await executeFunction(
          cron.functionId,
          cron.function,
          files,
          {
            enabled: false,
          },
          JSON.stringify(cron.data)
        );

        console.log(
          `[SHSF CRONS] Function for Cron #${cron.id} executed successfully.`
        );
      } else {
        const secondsUntilNextRun = Math.round(
          (next.getTime() - now.getTime()) / 1000
        );

        if (secondsUntilNextRun <= 5) {
          console.log(
            `[SHSF CRONS] Cron #${cron.id} will run in ${secondsUntilNextRun} seconds`
          );
        }
      }
    } catch (error) {
      console.error(
        `[SHSF CRONS] Error processing cron ${cron.name} (${cron.id}):`,
        error
      );
    }
  }
}
