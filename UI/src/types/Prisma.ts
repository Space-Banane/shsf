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
	ffmpeg_install: boolean;
	imported: boolean;

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

interface User {
	id: number;
	displayName: string;
	email: string; // Unique
	role: UserRole;

	password?: string;
	openRouterKey?: string | null;

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
	| "mcr.microsoft.com/dotnet/sdk:8.0"
	| "mcr.microsoft.com/dotnet/sdk:9.0"
	| "mcr.microsoft.com/dotnet/sdk:10.0";

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
	"mcr.microsoft.com/dotnet/sdk:8.0",
	"mcr.microsoft.com/dotnet/sdk:9.0",
	"mcr.microsoft.com/dotnet/sdk:10.0",
];
const ImagesAsArraySet = new Set(ImagesAsArray);

function getImageDisplayName(image: string): string {
	switch (image) {
		case "mcr.microsoft.com/dotnet/sdk:8.0":
			return ".NET 8";
		case "mcr.microsoft.com/dotnet/sdk:9.0":
			return ".NET 9";
		case "mcr.microsoft.com/dotnet/sdk:10.0":
			return ".NET 10";
		default:
			return image;
	}
}

function isDotnetImage(image: string): boolean {
	return image.startsWith("mcr.microsoft.com/dotnet/sdk:");
}

function getImageFamily(image: string): string {
	if (isDotnetImage(image)) {
		return "dotnet";
	}

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
	UserRole,
	Namespace,
	Image,
	Trigger,
	TriggerLog,
	Token,
};
export {
	ImagesAsArray,
	ImagesAsArraySet,
	getImageDisplayName,
	getImageFamily,
	isDotnetImage,
};
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
