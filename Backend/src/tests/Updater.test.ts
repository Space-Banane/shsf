import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	MISSING_LAYOUT_HELP,
	OVERRIDE_PATH,
	buildHelperScript,
	parseHelperOutput,
	registryAuth,
	resolveComposeLayout,
	resolveTrackedRef,
} from "../lib/UpdaterCompose";

const rows = vi.hoisted(() => ({ store: new Map<string, Record<string, unknown>>() }));
const docker = vi.hoisted(() => ({ logs: "", running: false, exitCode: 0, gone: false, removed: 0, flaky: 0, status: "exited" }));

vi.mock("../lib/db", () => {
	const matches = (row: Record<string, unknown>, where: Record<string, unknown> = {}) =>
		Object.entries(where).every(([key, want]) => {
			if (want && typeof want === "object" && "in" in want) return (want.in as unknown[]).includes(row[key]);
			if (want && typeof want === "object" && "not" in want) return row[key] !== want.not;
			return row[key] === want;
		});
	return {
		prisma: {
			updateOperation: {
				create: async ({ data }: { data: Record<string, unknown> }) => {
					const row = {
						id: `op-${rows.store.size + 1}`, status: "running", phase: "preflight", startedAt: new Date(), updatedAt: new Date(),
						finishedAt: null, helperContainerId: null, exitCode: null, error: null, log: null, helperOutput: null,
						imageRef: null, fromImageId: null, fromDigest: null, toImageId: null, toDigest: null, ...data,
					};
					rows.store.set(row.id as string, row);
					return row;
				},
				findUnique: async ({ where }: { where: { id: string } }) => rows.store.get(where.id) ?? null,
				findFirst: async ({ where }: { where: Record<string, unknown> }) =>
					[...rows.store.values()].find((row) => matches(row, where)) ?? null,
				findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
					[...rows.store.values()].filter((row) => matches(row, where)),
				updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
					const hits = [...rows.store.values()].filter((row) => matches(row, where));
					hits.forEach((row) => Object.assign(row, data));
					return { count: hits.length };
				},
			},
		},
	};
});
vi.mock("../lib/DataManager", () => ({
	getUpdateLastCheck: async () => null,
	setUpdateLastCheck: vi.fn(async () => undefined),
}));
vi.mock("dockerode", () => ({
	default: class {
		getContainer() {
			return {
				inspect: async () => {
					if (docker.gone) throw Object.assign(new Error("no such container"), { statusCode: 404 });
					if (docker.flaky > 0) {
						docker.flaky--;
						throw new Error("connect ECONNRESET");
					}
					return { State: { Running: docker.running, ExitCode: docker.exitCode, Status: docker.status } };
				},
				logs: async () => Buffer.from(docker.logs),
				remove: async () => {
					docker.removed++;
				},
			};
		}
	},
}));

import {
	cancelUpdate,
	describePullError,
	hasFailedAttempt,
	monitorOperation,
	recoverOperations,
	updateWasApplied,
	UpdateNotCancellableError,
} from "../lib/Updater";
import { prisma } from "../lib/db";

const layout = {
	projectName: "shsf",
	projectDirectory: "/srv/shsf",
	configFiles: ["/srv/shsf/docker-compose.yml"],
	envFiles: [],
	service: "backend",
};
const ID_A = `sha256:${"a".repeat(64)}`;
const ID_B = `sha256:${"b".repeat(64)}`;

describe("updateWasApplied", () => {
	it("accepts any image that differs from the one running when the update was found", () => {
		expect(updateWasApplied({ updateAvailable: true, currentImageId: "sha256:previous" }, "sha256:newer")).toBe(true);
		expect(updateWasApplied({ updateAvailable: true, currentImageId: "sha256:current" }, "sha256:current")).toBe(false);
	});
});

describe("resolveComposeLayout", () => {
	const labels = {
		"com.docker.compose.project": "shsf",
		"com.docker.compose.service": "backend",
		"com.docker.compose.project.working_dir": "/srv/shsf",
		"com.docker.compose.project.config_files": `/srv/shsf/docker-compose.yml,/srv/shsf/prod.yml,${OVERRIDE_PATH}`,
		"com.docker.compose.project.environment_file": "/srv/shsf/.env",
	};

	it("reads the layout from Compose labels and ignores the updater's own override file", () => {
		expect(resolveComposeLayout(labels, {})).toEqual({
			projectName: "shsf",
			projectDirectory: "/srv/shsf",
			configFiles: ["/srv/shsf/docker-compose.yml", "/srv/shsf/prod.yml"],
			envFiles: ["/srv/shsf/.env"],
			service: "backend",
		});
	});

	it("lets explicit config replace the labels (custom layout)", () => {
		const resolved = resolveComposeLayout(labels, {
			UPDATE_COMPOSE_PROJECT: "custom",
			UPDATE_COMPOSE_SERVICE: "app",
			UPDATE_COMPOSE_PROJECT_DIR: "/opt/stack",
			UPDATE_COMPOSE_FILES: "/opt/stack/compose/base.yml, /opt/stack/compose/prod.yml",
			UPDATE_COMPOSE_ENV_FILES: "/opt/stack/secrets/prod.env",
		});
		expect(resolved).toEqual({
			projectName: "custom",
			projectDirectory: "/opt/stack",
			configFiles: ["/opt/stack/compose/base.yml", "/opt/stack/compose/prod.yml"],
			envFiles: ["/opt/stack/secrets/prod.env"],
			service: "app",
		});
	});

	it("explains how to configure containers without Compose labels", () => {
		expect(() => resolveComposeLayout({}, {})).toThrow(MISSING_LAYOUT_HELP);
	});

	it("rejects files outside the mounted project directory and relative paths", () => {
		expect(() => resolveComposeLayout({ ...labels, "com.docker.compose.project.config_files": "/etc/compose.yml" }, {})).toThrow(
			"inside the Compose project directory",
		);
		expect(() => resolveComposeLayout(labels, { UPDATE_COMPOSE_FILES: "docker-compose.yml" })).toThrow("absolute path");
		expect(() => resolveComposeLayout(labels, { UPDATE_COMPOSE_ENV_FILES: "/srv/other/.env" })).toThrow("env file");
	});

	it("rejects service names that could inject shell", () => {
		expect(() => resolveComposeLayout(labels, { UPDATE_COMPOSE_SERVICE: "app; rm -rf /" })).toThrow("Invalid Compose service");
	});
});

describe("resolveTrackedRef / registryAuth", () => {
	it("prefers explicit config, then the remembered label, then the container's image", () => {
		expect(resolveTrackedRef({ UPDATE_IMAGE: "r.io/a:prod" }, { "shsf.update.ref": "r.io/a:dev" }, "sha256:x")).toBe("r.io/a:prod");
		expect(resolveTrackedRef({}, { "shsf.update.ref": "r.io/a:dev" }, ID_A)).toBe("r.io/a:dev");
		expect(resolveTrackedRef({}, {}, "r.io/a:prod")).toBe("r.io/a:prod");
	});

	it("refuses to track a bare image ID", () => {
		expect(() => resolveTrackedRef({}, {}, ID_A)).toThrow("UPDATE_IMAGE");
		expect(() => resolveTrackedRef({}, {}, "a".repeat(64))).toThrow("UPDATE_IMAGE");
	});

	it("never sends registry credentials to another registry (helper image on Docker Hub)", () => {
		const creds = { UPDATE_REGISTRY_USERNAME: "u", UPDATE_REGISTRY_PASSWORD: "p" };
		expect(registryAuth("docker:28-cli", creds, "registry.example.com/shsf/core:prod")).toBeUndefined();
		expect(registryAuth("registry.example.com/shsf/core:prod", creds, "registry.example.com/shsf/core:prod")).toBeDefined();
		expect(registryAuth("docker:28-cli", { ...creds, UPDATE_REGISTRY_SERVER: "https://index.docker.io/v1/" })?.serveraddress).toBe(
			"https://index.docker.io/v1/",
		);
	});

	it("builds registry credentials only when both halves are configured", () => {
		expect(registryAuth("registry.example.com/shsf/core:prod", { UPDATE_REGISTRY_USERNAME: "u" })).toBeUndefined();
		expect(
			registryAuth("registry.example.com/shsf/core:prod", { UPDATE_REGISTRY_USERNAME: "u", UPDATE_REGISTRY_PASSWORD: "p" }),
		).toEqual({ username: "u", password: "p", serveraddress: "registry.example.com" });
	});

	it("turns registry auth failures into an actionable error", () => {
		const err = describePullError("r.io/a:prod", new Error("unauthorized: authentication required"), false);
		expect(err.message).toContain("UPDATE_REGISTRY_USERNAME");
		expect(describePullError("r.io/a:prod", new Error("x"), true).message).toContain("timed out");
	});
});

describe("buildHelperScript", () => {
	const base = {
		layout,
		oldImageId: ID_A,
		newImageId: ID_B,
		trackedRef: "registry.example.com/shsf/core:prod",
		network: "shsf_default",
		port: 5000,
		composeSeconds: 180,
		readinessSeconds: 300,
	};

	it("replaces only the one service, pinned to the image ID, with finite timeouts", () => {
		const script = buildHelperScript(base);
		expect(script).toContain('--no-deps --no-build --pull never --force-recreate "$SERVICE"');
		expect(script).toContain("SERVICE='backend'");
		expect(script).toContain(`NEW_ID='${ID_B}'`);
		expect(script).toContain("UP_T=180");
		expect(script).toContain("READY_T=300");
		expect(script).toContain("--project-directory '/srv/shsf' -f '/srv/shsf/docker-compose.yml'");
		expect(script).not.toMatch(/ pull( |&|$)/m);
	});

	it("passes env files and custom layouts through", () => {
		const script = buildHelperScript({
			...base,
			layout: { ...layout, configFiles: ["/srv/shsf/a.yml", "/srv/shsf/b.yml"], envFiles: ["/srv/shsf/prod.env"] },
		});
		expect(script).toContain("-f '/srv/shsf/a.yml' -f '/srv/shsf/b.yml' --env-file '/srv/shsf/prod.env'");
	});

	it("writes a multi-line Compose override with real line breaks", () => {
		const dir = mkdtempSync(join(tmpdir(), "shsf-override-"));
		try {
			const script = buildHelperScript(base);
			const fn = /^write_override\(\) \{\n[\s\S]*?\n\}$/m.exec(script)?.[0];
			expect(fn).toBeDefined();
			const out = join(dir, "override.yml");
			const harness = [
				`SERVICE='backend'`,
				`REF='registry.example.com/shsf/core:prod'`,
				`OVERRIDE='${out}'`,
				fn,
				`write_override '${ID_B}'`,
			].join("\n");
			execFileSync("sh", ["-c", harness]);
			expect(readFileSync(out, "utf8")).toBe(
				`services:\n  backend:\n    image: ${ID_B}\n    labels:\n      shsf.update.ref: "registry.example.com/shsf/core:prod"\n`,
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("quotes values and rejects unsafe ones", () => {
		expect(buildHelperScript({ ...base, layout: { ...layout, projectName: "team's shsf" } })).toContain(`-p 'team'"'"'s shsf'`);
		expect(() => buildHelperScript({ ...base, oldImageId: "latest" })).toThrow("sha256");
		expect(() => buildHelperScript({ ...base, trackedRef: "x; reboot" })).toThrow("Invalid image reference");
		expect(() => buildHelperScript({ ...base, network: "a b" })).toThrow("Invalid network");
	});
});

describe("parseHelperOutput", () => {
	it("reads phases, the combined reasons and the result from TTY output", () => {
		const parsed = parseHelperOutput(
			"##PHASE replacement\r\nnoise\r\n##PHASE migration\r\n##REASON container crashed\r\n##PHASE rollback\r\n##REASON still bad\r\n##RESULT rolled_back\r\n",
		);
		expect(parsed).toEqual({ phase: "rollback", reason: "container crashed -> still bad", result: "rolled_back" });
	});

	it("finds markers behind terminal escape sequences", () => {
		const parsed = parseHelperOutput("\x1b[?25l\x1b[2K##PHASE verification\r\n\x1b[?25h##RESULT completed\r\n");
		expect(parsed).toEqual({ phase: "verification", reason: null, result: "completed" });
	});

	it("ignores unknown markers and plain output", () => {
		expect(parseHelperOutput("hello\n##PHASE bogus\n##RESULT maybe\n")).toEqual({ phase: null, reason: null, result: null });
	});
});

describe("operation lifecycle", () => {
	beforeEach(() => {
		rows.store.clear();
		Object.assign(docker, { logs: "", running: false, exitCode: 0, gone: false, removed: 0, flaky: 0, status: "exited" });
	});

	const running = async (extra: Record<string, unknown> = {}) =>
		prisma.updateOperation.create({
			data: { trigger: "manual", deadlineAt: new Date(Date.now() + 60_000), helperContainerId: "helper1", toImageId: ID_B, ...extra },
		});
	const status = (id: string) => rows.store.get(id)?.status;

	it("completes only when the helper reports readiness passed", async () => {
		const op = await running();
		docker.logs = "##PHASE replacement\r\n##PHASE verification\r\n##PHASE completion\r\n##RESULT completed\r\n";
		await monitorOperation(op.id);
		expect(status(op.id)).toBe("completed");
		expect(rows.store.get(op.id)?.helperOutput).toContain("##RESULT completed");
		expect(docker.removed).toBe(1);
	});

	it("does not claim success when the helper exits 0 without the completed marker", async () => {
		const op = await running();
		docker.logs = "##PHASE replacement\r\n";
		await monitorOperation(op.id);
		expect(status(op.id)).toBe("failed");
	});

	it("records a rollback with the cause", async () => {
		const op = await running();
		docker.exitCode = 10;
		docker.logs = "##PHASE migration\r\n##REASON container crashed or restarted\r\n##PHASE rollback\r\n##RESULT rolled_back\r\n";
		await monitorOperation(op.id);
		expect(status(op.id)).toBe("rolled_back");
		expect(rows.store.get(op.id)?.error).toContain("previous version was restored");
		expect(rows.store.get(op.id)?.exitCode).toBe(10);
	});

	it("records helper failure with its exit code and reason", async () => {
		const op = await running();
		docker.exitCode = 1;
		docker.logs = "##REASON Compose configuration is invalid\r\n##RESULT failed\r\n";
		await monitorOperation(op.id);
		expect(status(op.id)).toBe("failed");
		expect(rows.store.get(op.id)?.error).toBe("Compose configuration is invalid");
		expect(rows.store.get(op.id)?.exitCode).toBe(1);
	});

	it("fails an operation whose helper disappeared", async () => {
		const op = await running();
		docker.gone = true;
		await monitorOperation(op.id);
		expect(status(op.id)).toBe("failed");
		expect(rows.store.get(op.id)?.error).toContain("helper container is gone");
	});

	it("keeps monitoring through transient Docker errors instead of failing the update", async () => {
		const op = await running();
		docker.flaky = 2;
		docker.logs = "##RESULT completed\r\n";
		await monitorOperation(op.id);
		expect(status(op.id)).toBe("completed");
	}, 15_000);

	it("fails immediately and removes a helper that was created but never started (crash window)", async () => {
		const op = await running();
		docker.status = "created";
		await monitorOperation(op.id);
		expect(status(op.id)).toBe("failed");
		expect(rows.store.get(op.id)?.error).toContain("before the update helper was started");
		await vi.waitFor(() => expect(docker.removed).toBe(1));
	});

	it("recovery after a restart fails an operation whose helper was created but not started", async () => {
		const op = await running();
		docker.status = "created";
		await recoverOperations();
		await vi.waitFor(() => expect(status(op.id)).toBe("failed"));
		expect(rows.store.get(op.id)?.error).toContain("before the update helper was started");
	});

	it("fails a still-running helper once the operation deadline passed (timeout)", async () => {
		const op = await running({ deadlineAt: new Date(Date.now() - 1000) });
		docker.running = true;
		await monitorOperation(op.id);
		expect(status(op.id)).toBe("failed");
		expect(rows.store.get(op.id)?.error).toContain("minute limit");
	});

	it("never overwrites a terminal state", async () => {
		const op = await running();
		rows.store.get(op.id)!.status = "cancelled";
		docker.logs = "##RESULT completed\r\n";
		await monitorOperation(op.id);
		expect(status(op.id)).toBe("cancelled");
	});

	it("recovers after a restart: resumes with a helper, fails without one", async () => {
		const withHelper = await running();
		const withoutHelper = await running({ helperContainerId: null });
		docker.logs = "##RESULT completed\r\n";
		await recoverOperations();
		await vi.waitFor(() => expect(status(withHelper.id)).toBe("completed"));
		expect(status(withoutHelper.id)).toBe("failed");
		expect(rows.store.get(withoutHelper.id)?.error).toContain("restart");
	});

	it("tells auto-update which images already failed", async () => {
		const op = await running({ toImageId: ID_B });
		expect(await hasFailedAttempt(ID_B)).toBe(false);
		rows.store.get(op.id)!.status = "rolled_back";
		expect(await hasFailedAttempt(ID_B)).toBe(true);
		expect(await hasFailedAttempt(ID_A)).toBe(false);
		const neverReplaced = await running({ toImageId: ID_A, helperContainerId: null });
		rows.store.get(neverReplaced.id)!.status = "failed";
		expect(await hasFailedAttempt(ID_A)).toBe(false); // failed before the replacement: retry is fine
	});

	it("rejects cancelling once the replacement started or the operation finished", async () => {
		const op = await running();
		await expect(cancelUpdate(op.id)).rejects.toBeInstanceOf(UpdateNotCancellableError);
		await expect(cancelUpdate("missing")).rejects.toThrow("not found");
	});
});
