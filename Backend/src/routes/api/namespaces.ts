import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../..";
import { checkAuthentication } from "../../lib/Authentication";
import { cleanupFunctionContainer } from "../../lib/Runner";

export = new fileRouter.Path("/")
	.http("POST", "/api/namespace", (http) =>
		http.onRequest(async (ctr) => {
			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					name: z.string().min(1).max(128),
				})
			);

			if (!data)
				return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER)
			);

			if (!authCheck.success) {
				return ctr.print({
					status: 401,
					message: authCheck.message,
				});
			}

			const namespace = await prisma.namespace.create({
				data: {
					name: data.name,
					userId: authCheck.user.id,
				},
			});

			return ctr.print({
				status: "OK",
				data: {
					id: namespace.id,
				},
			});
		})
	)
	.http("GET", "/api/namespaces", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER)
			);

			if (!authCheck.success) {
				return ctr.print({
					status: 401,
					message: authCheck.message,
				});
			}

			const includeFunctions = ctr.queries.get("include_functions") === "true";

			const namespaces = await prisma.namespace.findMany({
				where: {
					userId: authCheck.user.id,
				},
				include: includeFunctions ? { functions: true } : undefined,
			});

			return ctr.print({
				status: "OK",
				data: namespaces,
			});
		})
	)
	.http("GET", "/api/namespace/{id}", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER)
			);

			if (!authCheck.success) {
				return ctr.print({
					status: 401,
					message: authCheck.message,
				});
			}

			const id = ctr.params.get("id");
			if (!id) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print("Missing namespace id");
			}
			const namespaceId = parseInt(id);
			if (isNaN(namespaceId)) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print("Invalid namespace id");
			}

			const namespace = await prisma.namespace.findFirst({
				where: {
					id: namespaceId,
					userId: authCheck.user.id,
				},
			});

			if (!namespace) {
				return ctr.status(ctr.$status.NOT_FOUND).print("Namespace not found");
			}

			return ctr.print({
				status: "OK",
				data: namespace,
			});
		})
	)
	.http("PATCH", "/api/namespace/{id}", (http) =>
		http.onRequest(async (ctr) => {
			const id = ctr.params.get("id");
			if (!id) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print("Missing namespace id");
			}
			const namespaceId = parseInt(id);
			if (isNaN(namespaceId)) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print("Invalid namespace id");
			}

			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					name: z.string().min(1).max(128).optional(),
				})
			);

			if (!data)
				return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER)
			);

			if (!authCheck.success) {
				return ctr.print({
					status: 401,
					message: authCheck.message,
				});
			}

			const namespace = await prisma.namespace.findFirst({
				where: {
					id: namespaceId,
					userId: authCheck.user.id,
				},
			});

			if (!namespace) {
				return ctr.status(ctr.$status.NOT_FOUND).print("Namespace not found");
			}

			const updatedNamespace = await prisma.namespace.update({
				where: {
					id: namespaceId,
				},
				data: {
					...(data.name && { name: data.name }),
				},
			});

			return ctr.print({
				status: "OK",
				data: updatedNamespace,
			});
		})
	)
	.http("DELETE", "/api/namespace/{id}", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER)
			);

			if (!authCheck.success) {
				return ctr.print({
					status: 401,
					message: authCheck.message,
				});
			}

			const id = ctr.params.get("id");
			if (!id) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print("Missing namespace id");
			}
			const namespaceId = parseInt(id);
			if (isNaN(namespaceId)) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print("Invalid namespace id");
			}

			const namespace = await prisma.namespace.findFirst({
				where: {
					id: namespaceId,
					userId: authCheck.user.id,
				},
			});

			if (!namespace) {
				return ctr.status(ctr.$status.NOT_FOUND).print("Namespace not found");
			}

			// Nuke all functions
			const ids = await prisma.function.findMany({
				where: {
					namespaceId: namespaceId,
				},
			});

			for (const func of ids) {
				await cleanupFunctionContainer(func.id);
			}

			// Delete namespace (cascade deletes functions)
			await prisma.namespace.delete({
				where: {
					id: namespaceId,
				},
				include: { functions: true }
			});

			return ctr.print({
				status: "OK",
				message: "Namespace deleted successfully",
			});
		})
	);
