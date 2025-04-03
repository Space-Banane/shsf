import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../..";
import { checkAuthentication } from "../../lib/Authentication";
import Docker from "dockerode";
import * as fs from "fs";
import * as path from "path";

export = new fileRouter.Path("/")
    .http("POST", "/api/function", (http) =>
        http
            .ratelimit((limit) => limit.hits(3).window(900).penalty(0))
            .onRequest(async (ctr) => {
                const [data, error] = await ctr.bindBody((z) =>
                    z.object({
                        name: z.string().min(1).max(128),
                        description: z.string().min(12).max(256),
                        image: z.enum([
                            // Python versions
                            "python:2.9",
                            "python:3.0",
                            "python:3.1",
                            "python:3.2",
                            "python:3.3",
                            "python:3.4",
                            "python:3.5",
                            "python:3.6",
                            "python:3.7",
                            "python:3.8",
                            "python:3.9",
                            "python:3.10",
                            "python:3.11",
                            "python:3.12",
                            // Node.js versions
                            "node:16",
                            "node:17",
                            "node:18",
                            "node:19",
                            "node:20",
                            "node:21",
                            "node:22",
                        ]),
                        startup_file: z.string().min(1).max(256).optional(),
                        settings: z
                            .object({
                                max_ram: z.number().min(128).max(1024).optional(),
                                timeout: z.number().positive().min(1).max(60).optional(),
                                allow_http: z.boolean().optional(),
                                secure_header: z.string().min(1).max(256).optional(),
                                priority: z.number().min(1).max(10).positive().optional(),
                                tags: z.array(z.string().min(1).max(32)).optional(),
                                retry_on_failure: z.boolean().optional(),
                                retry_count: z.number().min(1).max(10).positive().optional(),
                            })
                            .optional(),
                        environment: z
                            .array(
                                z
                                    .object({
                                        name: z.string().min(1).max(128),
                                        value: z.string().min(1).max(256),
                                    })
                                    .optional()
                            )
                            .optional(),
                        namespaceId: z.number(),
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
                        id: data.namespaceId,
                        userId: authCheck.user.id,
                    },
                });
                if (!namespace) {
                    return ctr.status(ctr.$status.NOT_FOUND).print("Namespace not found");
                }

                const existingFunction = await prisma.function.findFirst({
                    where: {
                        name: data.name,
                        namespaceId: data.namespaceId,
                        userId: authCheck.user.id,
                    },
                });
                if (existingFunction) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print(
                            "Function with the same name already exists in the namespace"
                        );
                }

                const out = await prisma.function.create({
                    data: {
                        description: data.description,
                        namespaceId: data.namespaceId,
                        name: data.name,
                        image: data.image,
                        startup_file: data.startup_file,
                        tags: data.settings?.tags?.join(",") || "",
                        allow_http: data.settings?.allow_http,
                        max_ram: data.settings?.max_ram,
                        timeout: data.settings?.timeout,
                        secure_header: data.settings?.secure_header,
                        priority: data.settings?.priority,
                        retry_on_failure: data.settings?.retry_on_failure,
                        max_retries: data.settings?.retry_count,
                        env: data.environment
                            ? JSON.stringify(
                                    data.environment.map((env) => ({
                                        name: env!.name,
                                        value: env!.value,
                                    }))
                              )
                            : undefined,
                        userId: authCheck.user.id,
                    },
                });

                return ctr.print({
                    status: "OK",
                    data: {
                        id: out.id,
                    },
                });
            })
    )
    .http("DELETE", "/api/function/{id}", (http) =>
        http
            .ratelimit((limit) => limit.hits(3).window(900).penalty(0))
            .onRequest(async (ctr) => {
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
                        .print("Missing function id");
                }
                const functionId = parseInt(id);
                if (isNaN(functionId)) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print("Invalid function id");
                }

                const functionData = await prisma.function.findFirst({
                    where: {
                        id: functionId,
                        userId: authCheck.user.id,
                    },
                });
                if (!functionData) {
                    return ctr.status(ctr.$status.NOT_FOUND).print("Function not found");
                }

                await prisma.function.delete({
                    where: {
                        id: functionData.id,
                    },
                });
                return ctr.print({
                    status: "OK",
                    message: "Function deleted",
                });
            })
    )
    .http("GET", "/api/functions", (http) =>
        http
            .ratelimit((limit) => limit.hits(3).window(900).penalty(0))
            .onRequest(async (ctr) => {
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

                const functions = await prisma.function.findMany({
                    where: {
                        userId: authCheck.user.id,
                    },
                    select: {
                        namespace: {
                            select: {
                                name: true,
                                id: true,
                            },
                        },
                    },
                });

                return ctr.print({
                    status: "OK",
                    data: functions,
                });
            })
    )
    .http("GET", "/api/function/{id}", (http) =>
        http
            .ratelimit((limit) => limit.hits(3).window(900).penalty(0))
            .onRequest(async (ctr) => {
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
                        .print("Missing function id");
                }
                const functionId = parseInt(id);
                if (isNaN(functionId)) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print("Invalid function id");
                }

                const functionData = await prisma.function.findFirst({
                    where: {
                        id: functionId,
                        userId: authCheck.user.id,
                    },
                    include: {
                        namespace: {
                            select: {
                                name: true,
                                id: true,
                            },
                        },
                    },
                });
                if (!functionData) {
                    return ctr.status(ctr.$status.NOT_FOUND).print("Function not found");
                }

                return ctr.print({
                    status: "OK",
                    data: functionData,
                });
            })
    )
    .http("PATCH", "/api/function/{id}", (http) =>
        http
            .ratelimit((limit) => limit.hits(3).window(900).penalty(0))
            .onRequest(async (ctr) => {
                const id = ctr.params.get("id");
                if (!id) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print("Missing function id");
                }
                const functionId = parseInt(id);
                if (isNaN(functionId)) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print("Invalid function id");
                }

                const [data, error] = await ctr.bindBody((z) =>
                    z.object({
                        name: z.string().min(1).max(128).optional(),
                        description: z.string().min(12).max(256).optional(),
                        image: z
                            .enum([
                                // Python versions
                                "python:2.9",
                                "python:3.0",
                                "python:3.1",
                                "python:3.2",
                                "python:3.3",
                                "python:3.4",
                                "python:3.5",
                                "python:3.6",
                                "python:3.7",
                                "python:3.8",
                                "python:3.9",
                                "python:3.10",
                                "python:3.11",
                                "python:3.12",
                                // Node.js versions
                                "node:16",
                                "node:17",
                                "node:18",
                                "node:19",
                                "node:20",
                                "node:21",
                                "node:22",
                            ])
                            .optional(),
                        startup_file: z.string().min(1).max(256).optional(),
                        settings: z
                            .object({
                                max_ram: z.number().min(128).max(1024).optional(),
                                timeout: z.number().positive().min(1).max(60).optional(),
                                allow_http: z.boolean().optional(),
                                secure_header: z.string().min(1).max(256).optional(),
                                priority: z.number().min(1).max(10).positive().optional(),
                                tags: z.array(z.string().min(1).max(32)).optional(),
                                retry_on_failure: z.boolean().optional(),
                                retry_count: z.number().min(1).max(10).positive().optional(),
                            })
                            .optional(),
                        environment: z
                            .array(
                                z
                                    .object({
                                        name: z.string().min(1).max(128),
                                        value: z.string().min(1).max(256),
                                    })
                                    .optional()
                            )
                            .optional(),
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

                const existingFunction = await prisma.function.findFirst({
                    where: {
                        id: functionId,
                        userId: authCheck.user.id,
                    },
                });

                if (!existingFunction) {
                    return ctr.status(ctr.$status.NOT_FOUND).print("Function not found");
                }

                const updatedData: any = {
                    ...(data.name && { name: data.name }),
                    ...(data.description && { description: data.description }),
                    ...(data.image && { image: data.image }),
                    ...(data.startup_file && { startup_file: data.startup_file }),
                    ...(data.settings?.tags && {
                        tags: data.settings.tags.join(","),
                    }),
                    ...(data.settings?.allow_http !== undefined && {
                        allow_http: data.settings.allow_http,
                    }),
                    ...(data.settings?.max_ram && { max_ram: data.settings.max_ram }),
                    ...(data.settings?.timeout && { timeout: data.settings.timeout }),
                    ...(data.settings?.secure_header && {
                        secure_header: data.settings.secure_header,
                    }),
                    ...(data.settings?.priority && {
                        priority: data.settings.priority,
                    }),
                    ...(data.settings?.retry_on_failure !== undefined && {
                        retry_on_failure: data.settings.retry_on_failure,
                    }),
                    ...(data.settings?.retry_count && {
                        max_retries: data.settings.retry_count,
                    }),
                    ...(data.environment && {
                        env: JSON.stringify(
                            data.environment.map((env) => ({
                                name: env!.name,
                                value: env!.value,
                            }))
                        ),
                    }),
                };

                const updatedFunction = await prisma.function.update({
                    where: {
                        id: functionId,
                    },
                    data: updatedData,
                });

                return ctr.print({
                    status: "OK",
                    data: updatedFunction,
                });
            })
    )
    .http("PUT", "/api/function/{id}/file", (http) =>
        http
            .ratelimit((limit) => limit.hits(3).window(900).penalty(0))
            .onRequest(async (ctr) => {
                const [data, error] = await ctr.bindBody((z) =>
                    z.object({
                        filename: z.string().min(1).max(256),
                        code: z.string(),
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

                const id = ctr.params.get("id");
                if (!id) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print("Missing function id");
                }
                const functionId = parseInt(id);
                if (isNaN(functionId)) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print("Invalid function id");
                }

                const functionData = await prisma.function.findFirst({
                    where: {
                        id: functionId,
                        userId: authCheck.user.id,
                    },
                });
                if (!functionData) {
                    return ctr.status(ctr.$status.NOT_FOUND).print("Function not found");
                }

                const existingFile = await prisma.functionFile.findFirst({
                    where: {
                        functionId: functionId,
                        name: data.filename,
                    },
                });

                let out;
                if (existingFile) {
                    out = await prisma.functionFile.update({
                        where: {
                            id: existingFile.id,
                        },
                        data: {
                            content: data.code,
                        },
                    });
                } else {
                    out = await prisma.functionFile.create({
                        data: {
                            name: data.filename,
                            content: data.code,
                            functionId: functionData.id,
                        },
                    });
                }

                if (!out) {
                    return ctr
                        .status(ctr.$status.INTERNAL_SERVER_ERROR)
                        .print("Failed to update function file");
                }

                return ctr.print({
                    status: "OK",
                    data: {
                        id: out.id,
                    },
                });
            })
    )
    .http("POST", "/api/function/{id}/execute", (http) =>
        http
            .ratelimit((limit) => limit.hits(3).window(900).penalty(0))
            .onRequest(async (ctr) => {
                const id = ctr.params.get("id");
                if (!id) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print("Missing function id");
                }
                const functionId = parseInt(id);
                if (isNaN(functionId)) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print("Invalid function id");
                }

                const functionData = await prisma.function.findFirst({
                    where: {
                        id: functionId,
                    },
                });
                if (!functionData) {
                    return ctr.status(ctr.$status.NOT_FOUND).print("Function not found");
                }

                const authCheck = await checkAuthentication(
                    ctr.cookies.get(COOKIE),
                    ctr.headers.get(API_KEY_HEADER)
                );

                if (!authCheck.success && !functionData.allow_http) {
                    return ctr.print({
                        status: 401,
                        message: "Unauthorized",
                    });
                }

                const files = await prisma.functionFile.findMany({
                    where: {
                        functionId: functionData.id,
                    },
                });
                if (!files || files.length === 0) {
                    return ctr.status(ctr.$status.NOT_FOUND).print("No files found");
                }

                try {
                    const docker = new Docker();
                    const containerName = `code_runner_${functionData.id}_${Date.now()}`;
                    const tempDir = `/tmp/${containerName}`;
                    fs.mkdirSync(tempDir, { recursive: true });

                    const runtimeType = functionData.image.startsWith("python")
                        ? "python"
                        : "node";

                    let defaultStartupFile = "main.py";
                    if (runtimeType === "node") {
                        defaultStartupFile = "index.js";
                    }

                    const startupFile = "/app/"+functionData.startup_file || defaultStartupFile;

                    for (const file of files) {
                        const filePath = path.join(tempDir, file.name);
                        fs.writeFileSync(filePath, file.content);
                    }

                    if (runtimeType === "node") {
                        if (!files.some((file) => file.name === "package.json")) {
                            let dependencies = {};
                            try {
                                const packageJsonPath = path.join(tempDir, "package.json");
                                if (fs.existsSync(packageJsonPath)) {
                                    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf-8");
                                    const packageJson = JSON.parse(packageJsonContent);
                                    dependencies = packageJson.dependencies || {};
                                }
                            } catch (e) {
                                console.error("Failed to read dependencies from package.json", e);
                            }
                            const packageJson = JSON.stringify(
                                {
                                    name: functionData.name,
                                    version: "1.0.0",
                                    private: true,
                                    dependencies: dependencies,
                                    scripts: {
                                        start: `node /app/${startupFile}`,
                                    },
                                },
                                null,
                                2
                            );
                            fs.writeFileSync(path.join(tempDir, "package.json"), packageJson);
                        }

                        const initScript = `#!/bin/sh
if [ -f "package.json" ]; then
  echo "Installing dependencies with pnpm..."
  pnpm install --frozen-lockfile --prefer-offline
fi
node ${startupFile}
`;
                        fs.writeFileSync(path.join(tempDir, "init.sh"), initScript);
                        fs.chmodSync(path.join(tempDir, "init.sh"), "755");
                    }

                    let CMD: string[] = [];
                    if (runtimeType === "python") {
                        const pythonCommand = functionData.image.startsWith("python:2")
                            ? "python"
                            : "python3";
                        CMD = [pythonCommand, `/app/${startupFile}`];
                    } else {
                        CMD = ["/bin/sh", "/app/init.sh"];
                    }

                    const container = await docker.createContainer({
                        Image: functionData.image,
                        name: containerName,
                        Cmd: CMD,
                        HostConfig: {
                            AutoRemove: true,
                            Binds: [`${tempDir}:/app`],
                        },
                    });

                    const tar = require("tar");
                    const tarStream = tar.c(
                        {
                            gzip: true,
                            cwd: tempDir,
                        },
                        fs.readdirSync(tempDir)
                    );
                    await container.putArchive(tarStream, { path: "/app" });

                    await container.start();

                    const timeout = functionData.timeout || 30;
                    const result = await Promise.race([
                        container.wait(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error("Timeout")), timeout * 1000)
                        ),
                    ]);

                    const logs = await container.logs({
                        stdout: true,
                        stderr: true,
                    });

                    const sanitizedLogs = logs
                        .toString()
                        .replace(/[^\x20-\x7E\n\r\t]/g, "");

                    return ctr.print({
                        status: "OK",
                        data: {
                            output: sanitizedLogs,
                            exitCode: (result as any).StatusCode,
                        },
                    });
                } catch (error: any) {
                    if (error.message === "Timeout") {
                        return ctr.status(ctr.$status.REQUEST_TIMEOUT).print({
                            error: "Code execution timed out",
                        });
                    }
                    return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
                        error: error.message,
                    });
                }
            })
    )
    .http("GET", "/api/function/{id}/files", (http) =>
        http
            .ratelimit((limit) => limit.hits(3).window(900).penalty(0))
            .onRequest(async (ctr) => {
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
                        .print("Missing function id");
                }
                const functionId = parseInt(id);
                if (isNaN(functionId)) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print("Invalid function id");
                }

                const functionData = await prisma.function.findFirst({
                    where: {
                        id: functionId,
                        userId: authCheck.user.id,
                    },
                });
                if (!functionData) {
                    return ctr.status(ctr.$status.NOT_FOUND).print("Function not found");
                }

                const files = await prisma.functionFile.findMany({
                    where: {
                        functionId: functionId,
                    },
                });

                return ctr.print({
                    status: "OK",
                    data: files,
                });
            })
    )
    .http("DELETE", "/api/function/{id}/file/{filename}", (http) =>
        http
            .ratelimit((limit) => limit.hits(3).window(900).penalty(0))
            .onRequest(async (ctr) => {
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
                const filename = ctr.params.get("filename");

                if (!id || !filename) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print("Missing function id or filename");
                }

                const functionId = parseInt(id);
                if (isNaN(functionId)) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print("Invalid function id");
                }

                try {
                    const functionData = await prisma.function.findFirst({
                        where: {
                            id: functionId,
                            userId: authCheck.user.id,
                        },
                    });

                    if (!functionData) {
                        return ctr
                            .status(ctr.$status.NOT_FOUND)
                            .print("Function not found");
                    }

                    const fileToDelete = await prisma.functionFile.findFirst({
                        where: {
                            functionId: functionId,
                            name: filename,
                        },
                    });

                    if (!fileToDelete) {
                        return ctr.status(ctr.$status.NOT_FOUND).print("File not found");
                    }

                    const totalFiles = await prisma.functionFile.count({
                        where: {
                            functionId: functionId,
                        },
                    });

                    if (totalFiles <= 1) {
                        return ctr
                            .status(ctr.$status.BAD_REQUEST)
                            .print("Cannot delete the only file in the function");
                    }

                    await prisma.functionFile.delete({
                        where: {
                            id: fileToDelete.id,
                        },
                    });

                    return ctr.print({
                        status: "OK",
                        message: "File deleted successfully",
                    });
                } catch (error) {
                    console.error("Error deleting file:", error);
                    return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
                        error: "Failed to delete file",
                    });
                }
            })
    )
    .http("PATCH", "/api/function/{id}/file/{filename}/rename", (http) =>
        http
            .ratelimit((limit) => limit.hits(3).window(900).penalty(0))
            .onRequest(async (ctr) => {
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
                const oldFilename = ctr.params.get("filename");

                if (!id || !oldFilename) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print("Missing function id or filename");
                }

                const [data, error] = await ctr.bindBody((z) =>
                    z.object({
                        newFilename: z.string().min(1).max(256),
                    })
                );

                if (!data) {
                    return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());
                }

                const functionId = parseInt(id);
                if (isNaN(functionId)) {
                    return ctr
                        .status(ctr.$status.BAD_REQUEST)
                        .print("Invalid function id");
                }

                const functionData = await prisma.function.findFirst({
                    where: {
                        id: functionId,
                        userId: authCheck.user.id,
                    },
                });

                if (!functionData) {
                    return ctr.status(ctr.$status.NOT_FOUND).print("Function not found");
                }

                const fileToRename = await prisma.functionFile.findFirst({
                    where: {
                        function: {
                            id: functionId,
                            userId: authCheck.user.id,
                        },
                        name: oldFilename,
                    },
                });

                if (!fileToRename) {
                    return ctr.status(ctr.$status.NOT_FOUND).print("File not found");
                }

                await prisma.functionFile.update({
                    where: {
                        id: fileToRename.id,
                    },
                    data: {
                        name: data.newFilename,
                    },
                });

                return ctr.print({
                    status: "OK",
                    message: "File renamed successfully",
                });
            })
    );
