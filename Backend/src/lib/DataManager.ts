// Manages the .data directory, which contains config and info files for cross platform communication
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createLogger } from "./logger";

const log = createLogger("DataManager");

/* Files and what they contain:

- .uuid: A unique identifier for this instance. Generated on the first run and stored in the .data directory.
- .linked: A JSON file indicating whether this instance is linked to a global user account.
*/

// We are always in the Backend/dist directory, so we need to go up two levels to get to the .data directory
// But when we are in a container, we cant really
// export const prevDirectory = env.CI ? "../" : "../../";
export const prevDirectory = "../../"; // For now, as we should just mount the containers .data directory to the host's /app/.data directory
async function ensureDataDirectory() {
    try {
        if (!existsSync(prevDirectory + ".data")) {
            mkdirSync(prevDirectory + ".data");
        }
    } catch (err) {
        log.error({ err }, "Error ensuring .data directory exists");
		throw new Error("Failed to ensure .data directory exists");
    }
}


async function setupUUID() {
	await ensureDataDirectory();

	if (existsSync(prevDirectory + ".data/.uuid")) {
		return { error: "UUID already exists" };
	}

	const newUUID = crypto.randomUUID();
	try {
		writeFileSync(prevDirectory + ".data/.uuid", newUUID, "utf-8");
		return { uuid: newUUID };
	} catch (err) {
		log.error({ err }, "Error writing .uuid file");
		return { error: "Failed to create UUID" };
	}
}

export async function getUUID() {
	await ensureDataDirectory();

	try {
		const uuid = readFileSync(prevDirectory + ".data/.uuid", "utf-8");
		return uuid;
	} catch (err) {
		log.warn({ err }, "Could not read .uuid file, attempting to create one");
		const setupResult = await setupUUID();
		if (setupResult.error) {
			log.error({ error: setupResult.error }, "Error setting up UUID");
			return null;
		}
		log.info({ uuid: setupResult.uuid }, "Successfully created new UUID");
		return setupResult.uuid;
	}
}

type LinkStatusLinked = { linked: true; global_user_email: string };
type LinkStatusUnlinked = { linked: false };
export type LinkStatus = LinkStatusLinked | LinkStatusUnlinked;

export async function getLinkStatus(): Promise<LinkStatus> {
	await ensureDataDirectory();

	try {
		const raw = readFileSync(prevDirectory + ".data/.linked", "utf-8");
		const parsed = JSON.parse(raw) as LinkStatus;
		return parsed;
	} catch {
		return { linked: false };
	}
}

export async function setLinkStatus(status: LinkStatus): Promise<void> {
	await ensureDataDirectory();

	try {
		writeFileSync(prevDirectory + ".data/.linked", JSON.stringify(status), "utf-8");
	} catch (err) {
		log.error({ err }, "Error writing .linked file");
		throw new Error("Failed to write link status");
	}
}

export async function getData() {
	await ensureDataDirectory();

	const uuid = await getUUID();
	const linkStatus = await getLinkStatus();

	return {
		uuid: uuid,
		linkStatus: linkStatus,
	};
}

export async function getLinkLock(): Promise<boolean> {
	await ensureDataDirectory();

	try {
		const raw = readFileSync(prevDirectory + ".data/.linkLock", "utf-8");
		return JSON.parse(raw) === true;
	} catch {
		return false;
	}
}

export async function setLinkLock(locked: boolean): Promise<void> {
	await ensureDataDirectory();

	try {
		writeFileSync(prevDirectory + ".data/.linkLock", JSON.stringify(locked), "utf-8");
	} catch (err) {
		log.error({ err }, "Error writing .linkLock file");
		throw new Error("Failed to write link lock status");
	}
}

export async function getRegistrationDisabled(): Promise<boolean> {
	await ensureDataDirectory();

	try {
		const raw = readFileSync(prevDirectory + ".data/.registrationDisabled", "utf-8");
		return JSON.parse(raw) === true;
	} catch {
		return false;
	}
}

export async function setRegistrationDisabled(disabled: boolean): Promise<void> {
	await ensureDataDirectory();

	try {
		writeFileSync(prevDirectory + ".data/.registrationDisabled", JSON.stringify(disabled), "utf-8");
	} catch (err) {
		log.error({ err }, "Error writing .registrationDisabled file");
		throw new Error("Failed to write registration disabled status");
	}
}

export async function getGuestAccessDisabled(): Promise<boolean> {
	await ensureDataDirectory();
	try {
		const raw = readFileSync(prevDirectory + ".data/.guestAccessDisabled", "utf-8");
		return JSON.parse(raw) === true;
	} catch {
		return false;
	}
}

export async function setGuestAccessDisabled(disabled: boolean): Promise<void> {
	await ensureDataDirectory();
	try {
		writeFileSync(prevDirectory + ".data/.guestAccessDisabled", JSON.stringify(disabled), "utf-8");
	} catch (err) {
		log.error({ err }, "Error writing .guestAccessDisabled file");
		throw new Error("Failed to write guest access disabled status");
	}
}

export async function getExternalAccessDisabled(): Promise<boolean> {
	await ensureDataDirectory();
	try {
		const raw = readFileSync(prevDirectory + ".data/.externalAccessDisabled", "utf-8");
		return JSON.parse(raw) === true;
	} catch {
		return false;
	}
}

export async function setExternalAccessDisabled(disabled: boolean): Promise<void> {
	await ensureDataDirectory();
	try {
		writeFileSync(prevDirectory + ".data/.externalAccessDisabled", JSON.stringify(disabled), "utf-8");
	} catch (err) {
		log.error({ err }, "Error writing .externalAccessDisabled file");
		throw new Error("Failed to write external access disabled status");
	}
}

export async function getDisabledImages(): Promise<string[]> {
	await ensureDataDirectory();
	try {
		const raw = readFileSync(prevDirectory + ".data/.disabledImages", "utf-8");
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export async function setDisabledImages(images: string[]): Promise<void> {
	await ensureDataDirectory();
	try {
		writeFileSync(prevDirectory + ".data/.disabledImages", JSON.stringify(images), "utf-8");
	} catch (err) {
		log.error({ err }, "Error writing .disabledImages file");
		throw new Error("Failed to write disabled images list");
	}
}
