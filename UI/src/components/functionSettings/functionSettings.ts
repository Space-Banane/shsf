import type { Image, XFunction } from "../../types/Prisma";

/** Sections of the routed function settings page, in navigation order. */
export const FUNCTION_SETTINGS_SECTIONS = [
	{ id: "general", label: "General" },
	{ id: "runtime", label: "Runtime" },
	{ id: "network", label: "Network/CORS" },
	{ id: "caching", label: "Caching" },
	{ id: "access", label: "Access" },
	{ id: "rate-limits", label: "Rate limits" },
] as const;

export type FunctionSettingsSectionId =
	(typeof FUNCTION_SETTINGS_SECTIONS)[number]["id"];

export const DEFAULT_FUNCTION_SETTINGS_SECTION: FunctionSettingsSectionId =
	"general";

/** Reads the section from the URL, falling back to General for old links. */
export function parseFunctionSettingsSection(
	value: string | null,
): FunctionSettingsSectionId {
	const match = FUNCTION_SETTINGS_SECTIONS.find(
		(section) => section.id === value,
	);
	return match?.id ?? DEFAULT_FUNCTION_SETTINGS_SECTION;
}

/** The editable draft of a function form; sections only touch their own fields. */
export interface FunctionSettingsDraft {
	name: string;
	description: string;
	image: Image;
	startupFile: string;
	maxRam: number | undefined;
	timeout: number | undefined;
	allowHttp: boolean;
	secureHeader: string;
	dockerMount: boolean;
	networkRestricted: boolean;
	ffmpegInstall: boolean;
	opencvInstall: boolean;
	corsOrigins: string;
	executionAlias: string;
	cacheEnabled: boolean;
	cacheTtl: number;
	namespaceId: number | undefined;
}

export function draftFromFunction(
	functionData: XFunction,
): FunctionSettingsDraft {
	return {
		name: functionData.name,
		description: functionData.description || "",
		image: functionData.image as Image,
		startupFile: functionData.startup_file || "",
		maxRam: functionData.max_ram,
		timeout: functionData.timeout,
		allowHttp: functionData.allow_http || false,
		secureHeader: functionData.secure_header || "",
		dockerMount: functionData.docker_mount ?? false,
		networkRestricted: functionData.network_restricted ?? false,
		ffmpegInstall: functionData.ffmpeg_install ?? false,
		opencvInstall: functionData.opencv_install ?? false,
		corsOrigins: functionData.cors_origins || "",
		executionAlias: functionData.executionAlias || "",
		cacheEnabled: functionData.cache_enabled ?? false,
		cacheTtl: functionData.cache_ttl ?? 60,
		namespaceId: functionData.namespaceId,
	};
}

export function draftsEqual(
	left: FunctionSettingsDraft,
	right: FunctionSettingsDraft,
): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

/** CORS origins are stored as a comma-separated string. */
export function splitCorsOrigins(value: string): string[] {
	return value
		.split(",")
		.map((origin) => origin.trim())
		.filter((origin) => origin.length > 0);
}
