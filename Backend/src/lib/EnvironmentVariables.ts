export interface EnvironmentVariableEntry {
	name: string;
	value: string;
}

function normalizeEnvironmentVariable(
	entry: unknown,
): EnvironmentVariableEntry | null {
	if (!entry || typeof entry !== "object") {
		return null;
	}

	const { name, value } = entry as {
		name?: unknown;
		value?: unknown;
	};

	if (typeof name !== "string") {
		return null;
	}

	const normalizedName = name.trim();
	if (!normalizedName) {
		return null;
	}

	return {
		name: normalizedName,
		value: typeof value === "string" ? value : String(value ?? ""),
	};
}

export function parseStoredEnvironmentVariables(
	raw: string | null | undefined,
): EnvironmentVariableEntry[] {
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.flatMap((entry) => {
			const normalized = normalizeEnvironmentVariable(entry);
			return normalized ? [normalized] : [];
		});
	} catch {
		return [];
	}
}

export function serializeEnvironmentVariables(
	entries: Array<EnvironmentVariableEntry | null | undefined> | null | undefined,
): string | undefined {
	if (entries === undefined || entries === null) {
		return undefined;
	}

	return JSON.stringify(
		entries.flatMap((entry) => {
			const normalized = normalizeEnvironmentVariable(entry);
			return normalized ? [normalized] : [];
		}),
	);
}

export function mergeEnvironmentVariables(
	...groups: EnvironmentVariableEntry[][]
): EnvironmentVariableEntry[] {
	const merged = new Map<string, string>();

	for (const group of groups) {
		for (const entry of group) {
			merged.set(entry.name, entry.value);
		}
	}

	return Array.from(merged.entries()).map(([name, value]) => ({
		name,
		value,
	}));
}

export function toDockerEnvironment(
	entries: EnvironmentVariableEntry[],
): string[] {
	return entries.map(({ name, value }) => `${name}=${value}`);
}
