import {
	API_KEY_HEADER,
	COOKIE,
	fileRouter,
	prisma,
} from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import Docker from "dockerode";
import { createLogger } from "../../../lib/logger";

const log = createLogger("functions/reinstall");

const docker = new Docker();

async function installPackageInContainer(
	containerName: string,
	packageName: string,
	markerFile: string,
) {
	const container = docker.getContainer(containerName);

	let inspectInfo: Docker.ContainerInspectInfo;
	try {
		inspectInfo = await container.inspect();
	} catch (error: any) {
		if (error?.statusCode === 404) {
			throw new Error(`Container ${containerName} not found`);
		}
		throw error;
	}

	if (inspectInfo.State.Paused) {
		await container.unpause();
	}

	if (!inspectInfo.State.Running) {
		await container.start();
	}

	const cmd = `rm -f ${markerFile} && apt update && apt install -y ${packageName} && touch ${markerFile}`;
	const exec = await container.exec({
		Cmd: ["/bin/sh", "-c", cmd],
		AttachStdout: true,
		AttachStderr: true,
	});

	const stream = await exec.start({});

	await new Promise<void>((resolve, reject) => {
		stream.on("end", () => resolve());
		stream.on("error", (err) => reject(err));
		stream.resume();
	});

	const result = await exec.inspect();
	if (typeof result.ExitCode === "number" && result.ExitCode !== 0) {
		throw new Error(
			`Install command failed for ${packageName} with exit code ${result.ExitCode}`,
		);
	}
}

export = new fileRouter.Path("/")
	.http("POST", "/api/function/{id}/reinstall-ffmpeg", (http) =>
		http
			.document({
				description: "Reinstall ffmpeg in the function container",
				tags: ["Functions"],
				operationId: "reinstallFfmpeg",
				responses: {
					200: {
						description: "Reinstall triggered successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
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
					ctr.headers.get(API_KEY_HEADER),
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

				try {
					await installPackageInContainer(
						`shsf_func_${functionId}`,
						"ffmpeg",
						"/app/.already_installed_ffmpeg",
					);
					
					return ctr.print({
						status: "OK",
					});
				} catch (e) {
					// Log the underlying error for debugging purposes
					log.error({ err: e, functionId }, "Failed to trigger FFmpeg reinstall");

					return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
						status: 500,
						message: "Failed to trigger FFmpeg reinstall in function container",
						detail:
							e instanceof Error
								? e.message
								: "Unknown error while triggering reinstall",
					});
				}
			}),
	)
	.http("POST", "/api/function/{id}/reinstall-opencv", (http) =>
		http
			.document({
				description: "Reinstall opencv in the function container",
				tags: ["Functions"],
				operationId: "reinstallOpencv",
				responses: {
					200: {
						description: "Reinstall triggered successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
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
					ctr.headers.get(API_KEY_HEADER),
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

				try {
					await installPackageInContainer(
						`shsf_func_${functionId}`,
						"python3-opencv",
						"/app/.already_installed_opencv",
					);
					
					return ctr.print({
						status: "OK",
					});
				} catch (e) {
					// Log the underlying error for debugging purposes
					log.error({ err: e, functionId }, "Failed to trigger OpenCV reinstall");

					return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
						status: 500,
						message: "Failed to trigger OpenCV reinstall in function container",
						detail:
							e instanceof Error
								? e.message
								: "Unknown error while triggering reinstall",
					});
				}
			}),
	);
