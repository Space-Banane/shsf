import { InstanceSettingType } from "@prisma/client";
import { prisma } from "./db";
import { createLogger } from "./logger";

const log = createLogger("DataManager");

async function getSetting(type: InstanceSettingType): Promise<string | null> {
	const row = await prisma.instanceSetting.findUnique({ where: { type } });
	return row?.value ?? null;
}

async function setSetting(type: InstanceSettingType, value: string): Promise<void> {
	await prisma.instanceSetting.upsert({
		where: { type },
		create: { type, value },
		update: { value },
	});
}

export async function getUUID(): Promise<string | null> {
	const val = await getSetting("instance_uuid");
	if (val !== null) return val;

	const uuid = crypto.randomUUID();
	try {
		await setSetting("instance_uuid", uuid);
		log.info({ uuid }, "Generated new instance UUID");
		return uuid;
	} catch (err) {
		log.error({ err }, "Failed to persist instance UUID");
		return null;
	}
}

export type LinkStatus =
	| { linked: true; global_user_email: string }
	| { linked: false };

export async function getLinkStatus(): Promise<LinkStatus> {
	const val = await getSetting("link_status");
	if (val !== null) {
		try {
			return JSON.parse(val) as LinkStatus;
		} catch {
			return { linked: false };
		}
	}
	return { linked: false };
}

export async function setLinkStatus(status: LinkStatus): Promise<void> {
	await setSetting("link_status", JSON.stringify(status));
}

export async function getData() {
	const uuid = await getUUID();
	const linkStatus = await getLinkStatus();
	return { uuid, linkStatus };
}

export async function getLinkLock(): Promise<boolean> {
	const val = await getSetting("link_lock");
	if (val !== null) return val === "true";
	return false;
}

export async function setLinkLock(locked: boolean): Promise<void> {
	await setSetting("link_lock", String(locked));
}

export async function getRegistrationDisabled(): Promise<boolean> {
	const val = await getSetting("registration_disabled");
	if (val !== null) return val === "true";
	return false;
}

export async function setRegistrationDisabled(disabled: boolean): Promise<void> {
	await setSetting("registration_disabled", String(disabled));
}

export async function getGuestAccessDisabled(): Promise<boolean> {
	const val = await getSetting("guest_access_disabled");
	if (val !== null) return val === "true";
	return false;
}

export async function setGuestAccessDisabled(disabled: boolean): Promise<void> {
	await setSetting("guest_access_disabled", String(disabled));
}

export async function getExternalAccessDisabled(): Promise<boolean> {
	const val = await getSetting("external_access_disabled");
	if (val !== null) return val === "true";
	return false;
}

export async function setExternalAccessDisabled(disabled: boolean): Promise<void> {
	await setSetting("external_access_disabled", String(disabled));
}

export async function getDisabledImages(): Promise<string[]> {
	const val = await getSetting("disabled_images");
	if (val !== null) {
		try {
			const parsed = JSON.parse(val);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	return [];
}

export async function setDisabledImages(images: string[]): Promise<void> {
	await setSetting("disabled_images", JSON.stringify(images));
}

export async function getAutoUpdateEnabled(): Promise<boolean> {
	const val = await getSetting("auto_update_enabled");
	if (val !== null) return val === "true";
	return false;
}

export async function setAutoUpdateEnabled(enabled: boolean): Promise<void> {
	await setSetting("auto_update_enabled", String(enabled));
}

export type UpdateLastCheck = {
	checkedAt: string; // ISO
	updateAvailable: boolean;
	currentImageId: string;
	newImageId: string | null;
};

export async function getUpdateLastCheck(): Promise<UpdateLastCheck | null> {
	const val = await getSetting("update_last_check");
	if (val !== null) {
		try {
			return JSON.parse(val) as UpdateLastCheck;
		} catch {
			return null;
		}
	}
	return null;
}

export async function setUpdateLastCheck(check: UpdateLastCheck): Promise<void> {
	await setSetting("update_last_check", JSON.stringify(check));
}
