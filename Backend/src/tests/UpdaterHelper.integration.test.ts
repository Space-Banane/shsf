import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HELPER_EXIT_ROLLED_BACK, buildHelperScript, parseHelperOutput, resolveComposeLayout } from "../lib/UpdaterCompose";

/**
 * Runs the real helper script against real Docker + Compose with tiny busybox
 * "backend" images. Skipped when Docker or the helper image is unavailable.
 * ponytail: shells out to docker CLI instead of dockerode; this is a test-only runner.
 */
const HELPER = process.env.UPDATE_HELPER_IMAGE ?? "docker:28-cli";
const docker = (...args: string[]) => spawnSync("docker", args, { encoding: "utf-8" });
const available = docker("image", "inspect", HELPER).status === 0 && docker("image", "inspect", "busybox:1.37").status === 0;

const PROJECT = `shsfupd${process.pid}`;
const PORT = 5000;
const dir = mkdtempSync(join(tmpdir(), "shsf-update-"));
const tag = (name: string) => `shsf-update-test-${process.pid}-${name}`;

/** An image that serves /ready like the backend; `body` customises its behaviour. */
function buildImage(name: string, entry: string): string {
	const dockerfile = `FROM busybox:1.37\nCMD ["sh", "-c", ${JSON.stringify(entry)}]\n`;
	execFileSync("docker", ["build", "-q", "-t", tag(name), "-"], { input: dockerfile, encoding: "utf-8" });
	return execFileSync("docker", ["image", "inspect", tag(name), "--format", "{{.Id}}"], { encoding: "utf-8" }).trim();
}

const serve = "mkdir -p /www && echo ok > /www/ready && exec httpd -f -p 5000 -h /www";
let ids: Record<"v1" | "v2" | "broken" | "unready", string>;

function composeUp(imageId: string) {
	writeFileSync(
		join(dir, "docker-compose.yml"),
		`services:\n  backend:\n    image: ${imageId}\n    restart: "no"\n`,
	);
	execFileSync("docker", ["compose", "-p", PROJECT, "--project-directory", dir, "-f", join(dir, "docker-compose.yml"), "up", "-d", "--force-recreate"]);
}

function runHelper(oldId: string, newId: string, readinessSeconds = 25) {
	const container = docker("inspect", `${PROJECT}-backend-1`, "--format", "{{.Config.Labels}}");
	expect(container.status).toBe(0);
	const labels = JSON.parse(
		docker("inspect", `${PROJECT}-backend-1`, "--format", "{{json .Config.Labels}}").stdout,
	) as Record<string, string>;
	const script = buildHelperScript({
		layout: resolveComposeLayout(labels, {}),
		oldImageId: oldId,
		newImageId: newId,
		trackedRef: "registry.example.test/shsf/core:prod",
		network: `${PROJECT}_default`,
		port: PORT,
		composeSeconds: 60,
		readinessSeconds,
		settleSeconds: 0,
		pollSeconds: 1,
	});
	const run = docker(
		"run", "--rm", "-t", "--network", `${PROJECT}_default`,
		"-v", "/var/run/docker.sock:/var/run/docker.sock", "-v", `${dir}:${dir}:ro`,
		HELPER, "sh", "-c", script,
	);
	return { exitCode: run.status, output: `${run.stdout}${run.stderr}`, progress: parseHelperOutput(run.stdout) };
}

const runningImage = () =>
	docker("inspect", `${PROJECT}-backend-1`, "--format", "{{.Image}}").stdout.trim();

describe.skipIf(!available)("update helper against real Docker Compose", () => {
	beforeAll(() => {
		ids = {
			v1: buildImage("v1", `echo v1; ${serve}`),
			v2: buildImage("v2", `echo v2; ${serve}`),
			// Dies like a failed `prisma migrate deploy && node` would.
			broken: buildImage("broken", "echo 'migration failed: P3018'; exit 1"),
			// Container stays up but never becomes ready (HTTP 404 on /ready).
			unready: buildImage("unready", "mkdir -p /www && exec httpd -f -p 5000 -h /www"),
		};
	}, 120_000);

	afterAll(() => {
		docker("compose", "-p", PROJECT, "down", "-v", "--remove-orphans");
		for (const name of ["v1", "v2", "broken", "unready"]) docker("rmi", "-f", tag(name));
		rmSync(dir, { recursive: true, force: true });
	}, 60_000);

	it("replaces only the service, verifies readiness and completes", () => {
		composeUp(ids.v1);
		const result = runHelper(ids.v1, ids.v2);
		expect(result.output).toContain("##PHASE verification");
		expect(result.progress.result).toBe("completed");
		expect(result.exitCode).toBe(0);
		expect(runningImage()).toBe(ids.v2);
		// The tracked ref survives on the container for the next check.
		expect(docker("inspect", `${PROJECT}-backend-1`, "--format", '{{index .Config.Labels "shsf.update.ref"}}').stdout.trim()).toBe(
			"registry.example.test/shsf/core:prod",
		);
	}, 120_000);

	it("rolls back when the new image crashes during startup (migration failure)", () => {
		composeUp(ids.v1);
		const result = runHelper(ids.v1, ids.broken);
		expect(result.progress.result).toBe("rolled_back");
		expect(result.exitCode).toBe(HELPER_EXIT_ROLLED_BACK);
		expect(result.progress.reason).toContain("crashed or restarted");
		expect(result.output).toContain("migration failed: P3018");
		expect(runningImage()).toBe(ids.v1);
	}, 120_000);

	it("rolls back when the new container is up but never ready", () => {
		composeUp(ids.v1);
		const result = runHelper(ids.v1, ids.unready, 8);
		expect(result.progress.result).toBe("rolled_back");
		expect(result.progress.reason).toContain("readiness not reached");
		expect(runningImage()).toBe(ids.v1);
	}, 120_000);

	it("reports failure when the rollback target is also broken", () => {
		composeUp(ids.broken);
		const result = runHelper(ids.broken, ids.unready, 6);
		expect(result.progress.result).toBe("failed");
		expect(result.exitCode).toBe(1);
		expect(result.progress.reason).toContain("rollback to the previous image also failed");
	}, 120_000);
});
