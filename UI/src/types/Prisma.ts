type UserRole = "Admin" | "User";

interface Session {
    id:number;
    hash:string;

    userId:number;

    createdAt:Date;
    updatedAt:Date;
}

interface XFunction {
    id: number;
    name: string;
    description: string;
    image: string;
    executionId: string;

    userId: number;

    max_ram: number;
    timeout: number;
    allow_http: boolean;
    env?: Record<string, any>;
    secure_header?: string;

    retry_on_failure: boolean;
    max_retries: number;

    priority: number;
    tags?: string; // comma-separated tags
    startup_file?: string;

    createdAt: Date;
    updatedAt: Date;
    lastRun?: Date;

    namespaceId: number;

    files?: FunctionFile[];
};

interface FunctionFile {
    id: number;
    name: string;
    content: string;

    functionId: number;

    createdAt: Date;
    updatedAt: Date;
}

interface User {
    id:number;
    displayName:string;
    email:string; // Unique
    role:UserRole;
    avatar_url?:string;

    password?:string;

    createdAt?:Date;
    updatedAt?:Date;

    sessions?:Session[];
    functions?:XFunction[];
    namespaces?:Namespace[];
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
    | "python:2.9"
    | "python:3.0"
    | "python:3.1"
    | "python:3.2"
    | "python:3.3"
    | "python:3.4"
    | "python:3.5"
    | "python:3.6"
    | "python:3.7"
    | "python:3.8"
    | "python:3.9"
    | "python:3.10"
    | "python:3.11"
    | "python:3.12"
    | "node:16"
    | "node:17"
    | "node:18"
    | "node:19"
    | "node:20"
    | "node:21"
    | "node:22";

const ImagesAsArray: Image[] = [
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
    "node:16",
    "node:17",
    "node:18",
    "node:19",
    "node:20",
    "node:21",
    "node:22",
];
const ImagesAsArraySet = new Set(ImagesAsArray);

export type {
    User,
    Session,
    XFunction,
    FunctionFile,
    UserRole,
    Namespace,
    Image,
    Trigger,
    TriggerLog
};
export { ImagesAsArray, ImagesAsArraySet };