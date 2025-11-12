import { Cookie } from "rjweb-server";
import {
  API_KEY_HEADER,
  COOKIE,
  DOMAIN,
  fileRouter,
  prisma,
  REACT_APP_API_URL,
  UI_URL,
} from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import * as bcrypt from "bcrypt";

export = new fileRouter.Path("/")
  // Create a new guest user
  .http("POST", "/api/account/guest/create", (http) =>
    http.onRequest(async (ctr) => {
      const [data, error] = await ctr.bindBody((z) =>
        z.object({
          displayName: z.string().min(2).max(128),
          email: z.string().email(),
          password: z.string().min(8).max(256),
        })
      );
      if (!data)
        return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

      const authCheck = await checkAuthentication(
        ctr.cookies.get(COOKIE),
        ctr.headers.get(API_KEY_HEADER)
      );
      if (!authCheck.success) {
        return ctr.status(ctr.$status.UNAUTHORIZED).print({
          status: "FAILED",
          message: authCheck.message,
        });
      }

      // Check if a regular user with this email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingUser) {
        return ctr.status(ctr.$status.CONFLICT).print({
          status: "FAILED",
          message: "A regular user with this email already exists",
        });
      }

      // Check for existing guest with same email for this owner
      const existing = await prisma.guestUser.findFirst({
        where: { email: data.email, guestOwnerId: authCheck.user.id },
      });
      if (existing) {
        return ctr.status(ctr.$status.CONFLICT).print({
          status: "FAILED",
          message: "A guest user with this email already exists",
        });
      }

      const password_hash = await bcrypt.hash(data.password, 10);

      const created = await prisma.guestUser.create({
        data: {
          displayName: data.displayName,
          email: data.email,
          password_hash: password_hash,
          guestOwnerId: authCheck.user.id,
          permittedFunctions: [],
        },
      });

      return ctr.print({
        status: "OK",
        guest: {
          id: created.id,
          displayName: created.displayName,
          email: created.email,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
      });
    })
  )
  // List all guest users for the authenticated owner
  .http("GET", "/api/account/guest/list", (http) =>
    http.onRequest(async (ctr) => {
      const authCheck = await checkAuthentication(
        ctr.cookies.get(COOKIE),
        ctr.headers.get(API_KEY_HEADER)
      );
      if (!authCheck.success) {
        return ctr.status(ctr.$status.UNAUTHORIZED).print({
          status: "FAILED",
          message: authCheck.message,
        });
      }

      const guests = await prisma.guestUser.findMany({
        where: { guestOwnerId: authCheck.user.id },
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              sessions: { where: { expiresAt: { gt: new Date() } } },
            },
          },
        },
      });

      return ctr.print({
        status: "OK",
        guests: guests.map((g) => ({
          id: g.id,
          displayName: g.displayName,
          email: g.email,
          permittedFunctions: g.permittedFunctions,
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
          activeSessions: g._count.sessions,
          _count: undefined, // Remove _count from response
        })),
      });
    })
  )
  // Update a guest user (displayName, permittedFunctions, password)
  .http("PATCH", "/api/account/guest/update", (http) =>
    http.onRequest(async (ctr) => {
      const [data, error] = await ctr.bindBody((z) =>
        z.object({
          id: z.number().int(),
          displayName: z.string().min(2).max(128).optional(),
          password: z.string().min(8).max(256).optional(),
        })
      );
      if (!data)
        return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

      const authCheck = await checkAuthentication(
        ctr.cookies.get(COOKIE),
        ctr.headers.get(API_KEY_HEADER)
      );
      if (!authCheck.success) {
        return ctr.status(ctr.$status.UNAUTHORIZED).print({
          status: "FAILED",
          message: authCheck.message,
        });
      }

      const guest = await prisma.guestUser.findUnique({
        where: { id: data.id },
      });
      if (!guest || guest.guestOwnerId !== authCheck.user.id) {
        return ctr.status(ctr.$status.NOT_FOUND).print({
          status: "FAILED",
          message: "Guest user not found",
        });
      }

      const updated = await prisma.guestUser.update({
        where: { id: data.id },
        data: {
          displayName: data.displayName ?? guest.displayName,
          password_hash: data.password
            ? await bcrypt.hash(data.password, 10)
            : guest.password_hash,
        },
      });

      return ctr.print({
        status: "OK",
        guest: {
          id: updated.id,
          displayName: updated.displayName,
          email: updated.email,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      });
    })
  )
  // Delete a guest user
  .http("DELETE", "/api/account/guest/delete", (http) =>
    http.onRequest(async (ctr) => {
      const [data, error] = await ctr.bindBody((z) =>
        z.object({
          id: z.number().int(),
        })
      );
      if (!data)
        return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

      const authCheck = await checkAuthentication(
        ctr.cookies.get(COOKIE),
        ctr.headers.get(API_KEY_HEADER)
      );
      if (!authCheck.success) {
        return ctr.status(ctr.$status.UNAUTHORIZED).print({
          status: "FAILED",
          message: authCheck.message,
        });
      }

      const guest = await prisma.guestUser.findUnique({
        where: { id: data.id },
      });
      if (!guest || guest.guestOwnerId !== authCheck.user.id) {
        // Verify ownership & Existence
        return ctr.status(ctr.$status.NOT_FOUND).print({
          status: "FAILED",
          message: "Guest user not found",
        });
      }

      await prisma.guestUser.delete({
        where: { id: data.id },
      });

      return ctr.print({
        status: "OK",
        message: "Guest user deleted",
      });
    })
  )
  // Assign a function to a guest user
  .http("POST", "/api/account/guest/assign-function", (http) =>
    http.onRequest(async (ctr) => {
      const [data, error] = await ctr.bindBody((z) =>
        z.object({
          guestId: z.number().int(),
          functionId: z.number().int(),
        })
      );
      if (!data)
        return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

      const authCheck = await checkAuthentication(
        ctr.cookies.get(COOKIE),
        ctr.headers.get(API_KEY_HEADER)
      );
      if (!authCheck.success) {
        return ctr.status(ctr.$status.UNAUTHORIZED).print({
          status: "FAILED",
          message: authCheck.message,
        });
      }

      const guest = await prisma.guestUser.findUnique({
        where: { id: data.guestId },
      });
      if (!guest) {
        return ctr.status(ctr.$status.NOT_FOUND).print({
          status: "FAILED",
          message: "Guest user not found",
        });
      }
      if (guest.guestOwnerId !== authCheck.user.id) {
        return ctr.status(ctr.$status.UNAUTHORIZED).print({
          status: "FAILED",
          message: "You do not own this guest user",
        });
      }

      const permitted = Array.isArray(guest.permittedFunctions)
        ? guest.permittedFunctions
        : [];
      if (!permitted.includes(data.functionId)) {
        permitted.push(data.functionId);
      }

      await prisma.guestUser.update({
        where: { id: data.guestId },
        data: { permittedFunctions: permitted },
      });

      return ctr.print({
        status: "OK",
        message: "Function assigned to guest user",
      });
    })
  )
  // Unassign a function from a guest user
  .http("POST", "/api/account/guest/unassign-function", (http) =>
    http.onRequest(async (ctr) => {
      const [data, error] = await ctr.bindBody((z) =>
        z.object({
          guestId: z.number().int(),
          functionId: z.number().int(),
        })
      );
      if (!data)
        return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

      const authCheck = await checkAuthentication(
        ctr.cookies.get(COOKIE),
        ctr.headers.get(API_KEY_HEADER)
      );
      if (!authCheck.success) {
        return ctr.status(ctr.$status.UNAUTHORIZED).print({
          status: "FAILED",
          message: authCheck.message,
        });
      }

      const guest = await prisma.guestUser.findUnique({
        where: { id: data.guestId },
      });
      if (!guest || guest.guestOwnerId !== authCheck.user.id) {
        return ctr.status(ctr.$status.NOT_FOUND).print({
          status: "FAILED",
          message: "Guest user not found",
        });
      }

      const permitted = Array.isArray(guest.permittedFunctions)
        ? guest.permittedFunctions
            .filter((fid): fid is number => typeof fid === "number")
            .filter((fid) => fid !== data.functionId)
        : [];

      await prisma.guestUser.update({
        where: { id: data.guestId },
        data: { permittedFunctions: permitted },
      });

      return ctr.print({
        status: "OK",
        message: "Function unassigned from guest user",
      });
    })
  )
  // Get function names by execution ids
  .http("POST", "/api/account/guest/function-names", (http) =>
    http.onRequest(async (ctr) => {
      const [data, error] = await ctr.bindBody((z) =>
        z.object({
          functionIds: z.array(z.number().int()),
        })
      );
      if (!data)
        return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

      const authCheck = await checkAuthentication(
        ctr.cookies.get(COOKIE),
        ctr.headers.get(API_KEY_HEADER)
      );
      if (!authCheck.success) {
        return ctr.status(ctr.$status.UNAUTHORIZED).print({
          status: "FAILED",
          message: authCheck.message,
        });
      }

      const functions = await prisma.function.findMany({
        where: { id: { in: data.functionIds }, userId: authCheck.user.id },
      });

      return ctr.print({
        status: "OK",
        data: functions.map((fn) => fn.name),
      });
    })
  )
  // list guests from a function's perspective
  .http("GET", "/api/account/guest/function/{functionId}", (http) =>
    http.onRequest(async (ctr) => {
      const functionId = Number(ctr.params.get("functionId"));
      if (isNaN(functionId)) {
        return ctr.status(ctr.$status.BAD_REQUEST).print({
          status: "FAILED",
          message: "Invalid function ID",
        });
      }

      const authCheck = await checkAuthentication(
        ctr.cookies.get(COOKIE),
        ctr.headers.get(API_KEY_HEADER)
      );
      if (!authCheck.success) {
        return ctr.status(ctr.$status.UNAUTHORIZED).print({
          status: "FAILED",
          message: authCheck.message,
        });
      }

      const guests = await prisma.guestUser.findMany({
        where: { guestOwnerId: authCheck.user.id },
      });

      const filteredGuests = guests.filter(
        (g) =>
          Array.isArray(g.permittedFunctions) &&
          g.permittedFunctions.includes(functionId)
      );

      return ctr.print({
        status: "OK",
        data: filteredGuests,
      });
    })
  )
  // Auth Check, email and password, does this user exist and who is it (id)
  .http("POST", "/api/account/guest/auth-check", (http) =>
    http.onRequest(async (ctr) => {
      const [data, error] = await ctr.bindBody((z) =>
        z.object({
          email: z.string().email(),
          password: z.string().min(8).max(256),
        })
      );
      if (!data)
        return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

      const guest = await prisma.guestUser.findUnique({
        where: { email: data.email },
      });
      if (!guest) {
        return ctr.status(ctr.$status.NOT_FOUND).print({
          status: "FAILED",
          message: "Guest user not found",
        });
      }

      const passwordMatch = await bcrypt.compare(
        data.password,
        guest.password_hash
      );
      if (!passwordMatch) {
        return ctr.status(ctr.$status.UNAUTHORIZED).print({
          status: "FAILED",
          message: "Incorrect password",
        });
      }

      return ctr.print({
        status: "OK",
        guest: {
          id: guest.id,
          displayName: guest.displayName,
          email: guest.email,
          createdAt: guest.createdAt,
          updatedAt: guest.updatedAt,
        },
      });
    })
  )
  // Authenticate a guest user, return a session cookie
  .http("POST", "/api/account/guest/authenticate", (http) =>
    http.onRequest(async (ctr) => {
      const [data, error] = await ctr.bindBody((z) =>
        z.object({
          email: z.string().email(),
          password: z.string().min(8).max(256),
          namespaceId: z.number().int(),
          functionExecId: z.string().uuid(),
        })
      );
      if (!data)
        return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

      const guest = await prisma.guestUser.findUnique({
        where: { email: data.email },
      });
      if (!guest) {
        return ctr.status(ctr.$status.NOT_FOUND).print({
          status: "FAILED",
          message: "Guest user not found",
        });
      }

      const passwordMatch = await bcrypt.compare(
        data.password,
        guest.password_hash
      );
      if (!passwordMatch) {
        return ctr.status(ctr.$status.UNAUTHORIZED).print({
          status: "FAILED",
          message: "Incorrect password",
        });
      }

      // Does this guest have access to this function?
      const functionData = await prisma.function.findUnique({
        where: { executionId: data.functionExecId },
      });
      if (
        !functionData ||
        !Array.isArray(guest.permittedFunctions) ||
        !guest.permittedFunctions.includes(functionData.id)
      ) {
        return ctr.status(ctr.$status.FORBIDDEN).print({
          status: "FAILED",
          message: "Guest user does not have access to this function",
        });
      }

      // Helper to generate a random hex string
      function randomHex(length = 16) {
        return Array.from(crypto.getRandomValues(new Uint8Array(length)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }

      const sessionToken = await prisma.guestSession.create({
        data: {
          guestUserId: guest.id,
          hash: crypto.randomUUID() + randomHex(),
          expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
        },
      });

      let newdomain = REACT_APP_API_URL.replace("https://", "")
        .replace("http://", "")
        .replace("/", "");
      console.log(`[GUEST AUTH] Setting cookie for domain: ${newdomain}`);

      ctr.cookies.set(
        `shsf_guest_${data.namespaceId}_${data.functionExecId}`,
        new Cookie(sessionToken.hash, {
          domain: newdomain,
          expires: new Date(Date.now() + 1000 * 60 * 60 * 6), // 6 hours
        })
      );

      return ctr.print({
        status: "OK",
        message: "Guest authenticated",
      });
    })
  )
  // Clear all sessions for a guest user
  .http("POST", "/api/account/guest/clear-sessions", (http) =>
    http.onRequest(async (ctr) => {
      const [data, error] = await ctr.bindBody((z) =>
        z.object({
          guestId: z.number().int(),
        })
      );
      if (!data)
        return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

      const authCheck = await checkAuthentication(
        ctr.cookies.get(COOKIE),
        ctr.headers.get(API_KEY_HEADER)
      );
      if (!authCheck.success) {
        return ctr.status(ctr.$status.UNAUTHORIZED).print({
          status: "FAILED",
          message: authCheck.message,
        });
      }

      const guest = await prisma.guestUser.findUnique({
        where: { id: data.guestId },
      });
      if (!guest || guest.guestOwnerId !== authCheck.user.id) {
        return ctr.status(ctr.$status.NOT_FOUND).print({
          status: "FAILED",
          message: "Guest user not found",
        });
      }

      await prisma.guestSession.deleteMany({
        where: { guestUserId: data.guestId },
      });

      return ctr.print({
        status: "OK",
        message: "All sessions cleared for guest user",
      });
    })
  );
