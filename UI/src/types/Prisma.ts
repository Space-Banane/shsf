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
  docker_mount: boolean;

  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;

  namespaceId: number;

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
  avatar_url?: string;

  password?: string;

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
  | "python:3.13";

const ImagesAsArray: Image[] = [
  "python:3.9",
  "python:3.10",
  "python:3.11",
  "python:3.12",
  "python:3.13",
];
const ImagesAsArraySet = new Set(ImagesAsArray);

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
export { ImagesAsArray, ImagesAsArraySet };
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