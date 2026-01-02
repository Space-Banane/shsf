import {
	API_KEY_HEADER,
	COOKIE,
	fileRouter,
	prisma,
	REACT_APP_API_URL,
	UI_URL,
} from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { installDependencies } from "../../../lib/Runner";

export = new fileRouter.Path("/").http(
	"POST",
	"/api/function/{id}/pip-install",
	(http) =>
		http.onRequest(async (ctr) => {
			const id = ctr.params.get("id");
			if (!id) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Missing function id",
				});
			}
			const functionId = parseInt(id);
			if (isNaN(functionId)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Invalid function id",
				});
			}

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

			const functionData = await prisma.function.findFirst({
				where: {
					id: functionId,
					userId: authCheck.user.id,
				},
			});
			if (!functionData) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function not found",
				});
			}

			// Is this even a Python function?
			if (!functionData.image.startsWith("python")) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Pip install is only available for Python functions",
				});
			}

			const files = await prisma.functionFile.findMany({
				where: {
					functionId: functionData.id,
				},
			});
			if (!files || files.length === 0) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function has no files",
				});
			}

			// Does the function have a requirements.txt file?
			const hasRequirements = files.find(
				(file) =>
					file.name.toLowerCase() === "requirements.txt" ||
					file.name.toLowerCase().endsWith("/requirements.txt")
			);
			if (!hasRequirements) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function has no requirements.txt file",
				});
			}

			// Try to install dependencies
			try {
				const result = await installDependencies(functionId, functionData, files);

				if (result === 404) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message:
							"Function has not been executed yet. Run it first and it will install dependencies automatically on its first ever run! After that, use Pip Install to update dependencies, if you have modified the requirements.txt file.",
					});
				} else if (result === false) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Could not install dependencies or find requirements.txt!",
					});
				}

				return ctr.print({
					status: "OK",
				});
			} catch (error: any) {
				if (error.message === "Timeout") {
					return ctr.status(ctr.$status.REQUEST_TIMEOUT).print({
						status: 408,
						message: "Pip install timed out",
					});
				}
				return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
					status: 500,
					message: "Failed to install dependencies",
					error: error.message,
				});
			}
		})
);
