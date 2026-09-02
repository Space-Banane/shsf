type UserRole = "Admin" | "User";

interface Session {
	id: number;
	hash: string;

	userId: number;

	createdAt: Date;
	updatedAt: Date;
}

interface XFunction {
	id: number;
	name: string;
	description: string;
	image: string;
	executionId: string;
	executionAlias?: string;

	userId: number;

	max_ram: number;
	timeout: number;
	allow_http: boolean;
	env?: Record<string, any>;
	secure_header?: string;
	cors_origins?: string;

	retry_on_failure: boolean;
	max_retries: number;

	tags?: string; // comma-separated tags
	startup_file: string;
	docker_mount: boolean;
	network_restricted: boolean;
	ffmpeg_install: boolean;
	imported: boolean;
	ai_kicked_off: boolean;

	// Caching
	cache_enabled: boolean;
	cache_ttl: number;

	// Git Version Control
	git_url?: string | null;
	git_username?: string | null;
	git_periodic_pull: boolean;
	git_pull_interval: number;

	createdAt: Date;
	updatedAt: Date;
	lastRun?: Date;

	namespaceId: number;

	opencv_install?: boolean;

	files?: FunctionFile[];
}

interface FunctionFile {
	id: number;
	name: string;
	content: string;

	functionId: number;

	createdAt: Date;
	updatedAt: Date;
}

interface FunctionFolder {
	id: number;
	name: string;
	functionId: number;

	createdAt: Date;
	updatedAt: Date;
}

interface User {
	id: number;
	displayName: string;
	email: string; // Unique
	role: UserRole;

	password?: string;
	apiKeyConfigured?: boolean;

	createdAt?: Date;
	updatedAt?: Date;

	sessions?: Session[];
	functions?: XFunction[];
	namespaces?: Namespace[];
}

interface Namespace {
	id: number;
	name: string;

	userId: number;

	createdAt: Date;
	updatedAt: Date;

	functions?: XFunction[];
}

interface Trigger {
	id: number;
	name: string;
	description: string;
	cron: string;
	data: string;
	enabled: boolean;
	functionId: number;
	createdAt: string;
	updatedAt: string;
	nextRun: string | null;
	lastRun: string | null;
	lastRunSuccessful: boolean | null;
}

interface TriggerLog {
	id: number;
	functionId: number;
	result: string | null;
	logs: string | null;

	createdAt: Date;
	updatedAt: Date;
}

type Image =
	| "python:3.9"
	| "python:3.10"
	| "python:3.11"
	| "python:3.12"
	| "python:3.13"
	| "python:3.14"
	| "python:3.15"
	| "golang:1.20"
	| "golang:1.21"
	| "golang:1.22"
	| "golang:1.23"
	| "node:20"
	| "node:22"
	| "node:24";

const ImagesAsArray: Image[] = [
	"python:3.9",
	"python:3.10",
	"python:3.11",
	"python:3.12",
	"python:3.13",
	"python:3.14",
	"python:3.15",
	"golang:1.20",
	"golang:1.21",
	"golang:1.22",
	"golang:1.23",
	"node:20",
	"node:22",
	"node:24",
];
const ImagesAsArraySet = new Set(ImagesAsArray);

function getImageDisplayName(image: string): string {
	if (image.startsWith("node:")) {
		return `Node.js ${image.split(":")[1]}`;
	}
	if (image.startsWith("python:")) {
		return `Python ${image.split(":")[1]}`;
	}
	if (image.startsWith("golang:")) {
		return `Go ${image.split(":")[1]}`;
	}
	return image;
}

function getImageFamily(image: string): string {
	return image.split(":")[0];
}

type Token = {
	id: number;
	name: string;
	purpose?: string;
	expiresAt?: string | null;
	createdAt: string;
	expired: boolean;
	hidden: boolean;
	tokenMasked: string;
};

export type {
	User,
	Session,
	XFunction,
	FunctionFile,
	FunctionFolder,
	UserRole,
	Namespace,
	Image,
	Trigger,
	TriggerLog,
	Token,
};
export { ImagesAsArray, ImagesAsArraySet, getImageDisplayName, getImageFamily };
interface FunctionStorage {
	id: number;
	name: string;
	purpose: string;

	user: number;

	createdAt: Date;
	updatedAt: Date;

	items?: FunctionStorageItem[];
}

interface FunctionStorageItem {
	id: number;
	key: string;
	value: string;

	storageId: number;

	expiresAt?: Date | null;

	createdAt: Date;
	updatedAt: Date;
}

export type { FunctionStorage, FunctionStorageItem };
