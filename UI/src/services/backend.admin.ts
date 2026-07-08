import { BASE_URL } from "..";

export interface AdminUser {
	id: number;
	displayName: string;
	email: string;
	role: "Admin" | "User";
	allow_docker_mount: boolean;
	createdAt: string;
	updatedAt: string;
	_count: {
		functions: number;
		namespaces: number;
		sessions: number;
	};
}

export interface AdminStats {
	overview: {
		totalUsers: number;
		totalFunctions: number;
		totalNamespaces: number;
		totalExecutions: number;
		totalRamAllocatedMb: number;
	};
	executions: {
		last24h: number;
		last7d: number;
		last30d: number;
		avgDurationSeconds: number;
		successCount: number;
		failureCount: number;
	};
	topFunctions: {
		id: number;
		name: string;
		image: string;
		max_ram: number;
		executionCount: number;
	}[];
	imageBreakdown: Record<string, number>;
	recentTimings: {
		functionId: number;
		functionName: string;
		totalSeconds: number;
		exitCode: number | null;
	}[];
}

// --- Users ---

export async function adminListUsers(): Promise<{ status: "OK"; users: AdminUser[] } | { status: "FAILED"; message: string }> {
	const res = await fetch(`${BASE_URL}/api/admin/users`, { credentials: "include" });
	return res.json();
}

export async function adminCreateUser(payload: {
	displayName: string;
	email: string;
	password: string;
	role: "Admin" | "User";
	allow_docker_mount: boolean;
}): Promise<{ status: "OK"; user: AdminUser } | { status: "FAILED"; message: string }> {
	const res = await fetch(`${BASE_URL}/api/admin/users`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	return res.json();
}

export async function adminUpdateUser(
	id: number,
	payload: {
		displayName?: string;
		role?: "Admin" | "User";
		allow_docker_mount?: boolean;
		password?: string;
	},
): Promise<{ status: "OK"; user: AdminUser } | { status: "FAILED"; message: string }> {
	const res = await fetch(`${BASE_URL}/api/admin/users/${id}`, {
		method: "PATCH",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	return res.json();
}

export async function adminDeleteUser(id: number): Promise<{ status: "OK"; message: string } | { status: "FAILED"; message: string }> {
	const res = await fetch(`${BASE_URL}/api/admin/users/${id}`, {
		method: "DELETE",
		credentials: "include",
	});
	return res.json();
}

// --- Stats ---

export async function adminGetStats(): Promise<{ status: "OK"; stats: AdminStats } | { status: "FAILED"; message: string }> {
	const res = await fetch(`${BASE_URL}/api/admin/stats`, { credentials: "include" });
	return res.json();
}

// --- Guest Access ---

export async function getGuestAccessDisabled(): Promise<{ status: "OK"; disabled: boolean }> {
	const res = await fetch(`${BASE_URL}/api/global/guest-access-disabled`, { credentials: "include" });
	return res.json();
}

export async function setGuestAccessDisabled(disabled: boolean): Promise<{ status: "OK"; disabled: boolean }> {
	const res = await fetch(`${BASE_URL}/api/global/guest-access-disabled`, {
		method: "PATCH",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ disabled }),
	});
	return res.json();
}

// --- External Access ---

export async function getExternalAccessDisabled(): Promise<{ status: "OK"; disabled: boolean }> {
	const res = await fetch(`${BASE_URL}/api/global/external-access-disabled`, { credentials: "include" });
	return res.json();
}

export async function setExternalAccessDisabled(disabled: boolean): Promise<{ status: "OK"; disabled: boolean }> {
	const res = await fetch(`${BASE_URL}/api/global/external-access-disabled`, {
		method: "PATCH",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ disabled }),
	});
	return res.json();
}

// --- Disabled Images ---

export async function getDisabledImages(): Promise<{ status: "OK"; disabledImages: string[] }> {
	const res = await fetch(`${BASE_URL}/api/global/disabled-images`, { credentials: "include" });
	return res.json();
}

export async function setDisabledImages(disabledImages: string[]): Promise<{ status: "OK"; disabledImages: string[] }> {
	const res = await fetch(`${BASE_URL}/api/global/disabled-images`, {
		method: "PATCH",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ disabledImages }),
	});
	return res.json();
}

// --- Updates ---

export interface UpdateStatus {
	autoUpdateEnabled: boolean;
	phase: "idle" | "checking" | "applying";
	error: string | null;
	lastCheckedAt: string | null;
	updateAvailable: boolean | null;
	currentImageId: string | null;
	newImageId: string | null;
}

export async function getUpdateStatus(): Promise<{ status: "OK" } & UpdateStatus> {
	const res = await fetch(`${BASE_URL}/api/admin/update`, { credentials: "include" });
	return res.json();
}

export async function setAutoUpdate(autoUpdateEnabled: boolean): Promise<{ status: "OK"; autoUpdateEnabled: boolean }> {
	const res = await fetch(`${BASE_URL}/api/admin/update`, {
		method: "PATCH",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ autoUpdateEnabled }),
	});
	return res.json();
}

export async function triggerUpdateCheck(): Promise<
	{ status: "OK"; updateAvailable: boolean; currentImageId: string; newImageId: string | null } |
	{ status: "FAILED"; message: string }
> {
	const res = await fetch(`${BASE_URL}/api/admin/update/check`, {
		method: "POST",
		credentials: "include",
	});
	return res.json();
}

export async function triggerUpdateApply(): Promise<
	{ status: "OK"; method: string; message: string } |
	{ status: "FAILED"; message: string }
> {
	const res = await fetch(`${BASE_URL}/api/admin/update/apply`, {
		method: "POST",
		credentials: "include",
	});
	return res.json();
}
