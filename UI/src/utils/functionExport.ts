import { BASE_URL } from "..";
import { apiFetch } from "../services/api";
import type { SHSFExport } from "../components/modals/functions/ImportFunctionModal";
import type { FunctionFile, Trigger, XFunction } from "../types/Prisma";
import { downloadBlob } from "./functionFiles";

function readEnvKeys(env: XFunction["env"] | string | undefined): string[] {
	try {
		const parsed = typeof env === "string" ? JSON.parse(env) : env;
		if (Array.isArray(parsed)) {
			return parsed
				.map((entry: { name?: string } | null) => entry?.name)
				.filter((name): name is string => Boolean(name));
		}
	} catch {
		// Unparseable env is exported without keys.
	}
	return [];
}

export function buildFunctionExport({
	functionData,
	files,
	triggers,
	version,
}: {
	functionData: XFunction;
	files: FunctionFile[];
	triggers: Trigger[];
	version: string;
}): SHSFExport {
	// Only env names are exported; values stay on the server.
	const envKeys = readEnvKeys(functionData.env);

	return {
		shsf_version: version,
		name: functionData.name,
		description: functionData.description,
		image: functionData.image,
		startup_file: functionData.startup_file,
		docker_mount: functionData.docker_mount,
		network_restricted: functionData.network_restricted,
		ffmpeg_install: functionData.ffmpeg_install,
		settings: {
			max_ram: functionData.max_ram,
			timeout: functionData.timeout,
			allow_http: functionData.allow_http,
		},
		cors_origins: functionData.cors_origins ?? undefined,
		...(envKeys.length > 0 && { env_keys: envKeys }),
		files: files.map((file) => ({ name: file.name, content: file.content })),
		triggers: triggers.map((trigger) => ({
			name: trigger.name,
			description: trigger.description,
			cron: trigger.cron,
			data: trigger.data,
			enabled: trigger.enabled,
		})),
	};
}

async function fetchServerVersion(): Promise<string> {
	try {
		const res = await apiFetch(BASE_URL + "/version");
		if (!res.ok) throw new Error("Failed to fetch version");
		const data = await res.json();
		return data.version!.raw;
	} catch {
		return "";
	}
}

export async function exportFunctionToFile(input: {
	functionData: XFunction;
	files: FunctionFile[];
	triggers: Trigger[];
}) {
	const version = await fetchServerVersion();
	const exportData = buildFunctionExport({ ...input, version });
	downloadBlob(
		new Blob([JSON.stringify(exportData, null, 2)], {
			type: "application/json",
		}),
		`${input.functionData.name}.shsf`,
	);
}
