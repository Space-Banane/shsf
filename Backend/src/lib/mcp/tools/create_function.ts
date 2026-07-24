import { randomUUID } from "crypto";
import { prisma } from "../../..";
import { getFirstFileByLanguage } from "../../LangOps";
import { getDisabledImages } from "../../DataManager";
import {
	McpToolDef,
	json,
	errResult,
	VALID_IMAGES,
	imageFamily,
} from "./shared";

const tool: McpToolDef = {
	name: "create_function",
	description:
		"Create a new serverless function. The function is created with a default starter file. Returns the new function's id and execution_id.",
	inputSchema: {
		type: "object",
		required: ["name", "description", "image", "namespace"],
		properties: {
			name: { type: "string", description: "Function name (1–128 chars)" },
			description: { type: "string", description: "Short description (3–128 chars)" },
			image: {
				type: "string",
				description: `Runtime image. Valid values: ${VALID_IMAGES.join(", ")}`,
				enum: VALID_IMAGES,
			},
			namespace: { type: "string", description: "Namespace name to create the function in" },
			startup_file: {
				type: "string",
				description:
					"Entry-point filename (e.g. 'main.py', 'main.go'). Required.",
			},
			execution_alias: {
				type: "string",
				description:
					"Optional human-readable alias for public execution URL (alphanumeric, hyphens, underscores; 8–128 chars)",
			},
			timeout: { type: "integer", description: "Execution timeout in seconds (1–300, default 15)" },
			max_ram: { type: "integer", description: "Max RAM in MB (128–1024, default 512)" },
		},
	},
	async handler(args, { userId }) {
		const name = args.name as string | undefined;
		const description = args.description as string | undefined;
		const image = args.image as string | undefined;
		const namespaceName = args.namespace as string | undefined;
		const startupFile = (args.startup_file as string | undefined) ?? "";
		const alias = args.execution_alias as string | undefined;
		const timeout = typeof args.timeout === "number" ? args.timeout : 15;
		const maxRam = typeof args.max_ram === "number" ? args.max_ram : 512;

		if (!name || name.length < 1 || name.length > 128)
			return errResult("name must be 1–128 characters");
		if (!description || description.length < 3 || description.length > 128)
			return errResult("description must be 3–128 characters");
		if (!image || !VALID_IMAGES.includes(image))
			return errResult(`image must be one of: ${VALID_IMAGES.join(", ")}`);
		if (!namespaceName) return errResult("namespace is required");

		const disabledImages = await getDisabledImages();
		if (disabledImages.includes(image))
			return errResult(`Image ${image} has been disabled by the administrator`);

		if (!startupFile.trim())
			return errResult("startup_file is required");

		const ns = await prisma.namespace.findFirst({
			where: { name: namespaceName, userId },
		});
		if (!ns) return errResult(`Namespace "${namespaceName}" not found`);

		const existing = await prisma.function.findFirst({
			where: { name, namespaceId: ns.id, userId },
		});
		if (existing) return errResult(`Function "${name}" already exists in namespace "${namespaceName}"`);

		if (alias) {
			const aliasConflict = await prisma.function.findFirst({ where: { executionAlias: alias } });
			if (aliasConflict) return errResult(`Execution alias "${alias}" is already in use`);
		}

		const normalizedStartupFile = startupFile.trim();
		const executionId = randomUUID();

		const created = await prisma.function.create({
			data: {
				name,
				description,
				image,
				startup_file: normalizedStartupFile,
				namespaceId: ns.id,
				userId,
				executionId,
				executionAlias: alias ?? null,
				timeout,
				max_ram: maxRam,
				...(normalizedStartupFile
					? {
							files: {
								create: {
									name: normalizedStartupFile,
									content:
										(await getFirstFileByLanguage(
											imageFamily(image),
											normalizedStartupFile,
										)) ?? "",
								},
							},
						}
					: {}),
			},
		});

		return json({
			id: created.id,
			execution_id: created.executionId,
			execution_alias: created.executionAlias,
			name: created.name,
			namespace: namespaceName,
		});
	},
};

export default tool;
