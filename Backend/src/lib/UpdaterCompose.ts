import { dirname, isAbsolute, relative } from "node:path";

/**
 * Pure helpers for the self-updater: Compose layout discovery, the helper
 * container's shell script, and parsing of that script's output. No I/O here,
 * so every branch is unit-testable (see Backend/src/tests/Updater*.test.ts).
 */

/** Finite bounds for every stage of an update. Documented in the README. */
export const UPDATE_TIMEOUTS = {
	/** Image pull (helper image and target image each) */
	pullMs: 10 * 60 * 1000,
	/** `docker compose up` for the one replaced service */
	composeSeconds: 180,
	/** Container start + `prisma migrate deploy` + health/HTTP checks, per attempt */
	readinessSeconds: 300,
	/** Whole operation. Pull x2 + replace + verify + rollback + verify, plus margin */
	operationMs: 45 * 60 * 1000,
	/** UI/watchers poll the operation at this interval until it is terminal */
	pollMs: 3000,
} as const;

/** Exit code of the helper when the update failed but the rollback succeeded */
export const HELPER_EXIT_ROLLED_BACK = 10;

export const OVERRIDE_PATH = "/tmp/shsf-update-override.yml";
/** Label on the running container that remembers which mutable ref is tracked */
export const TRACK_LABEL = "shsf.update.ref";

export type ComposeLayout = {
	projectName: string;
	projectDirectory: string;
	configFiles: string[];
	envFiles: string[];
	service: string;
};

export type ComposeOverrides = {
	UPDATE_COMPOSE_PROJECT?: string;
	UPDATE_COMPOSE_PROJECT_DIR?: string;
	UPDATE_COMPOSE_FILES?: string;
	UPDATE_COMPOSE_ENV_FILES?: string;
	UPDATE_COMPOSE_SERVICE?: string;
	UPDATE_IMAGE?: string;
};

const SERVICE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const IMAGE_ID_RE = /^sha256:[a-f0-9]{64}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/;

export const MISSING_LAYOUT_HELP =
	"This container is not managed by Docker Compose, or its Compose labels are missing. " +
	"Set UPDATE_COMPOSE_PROJECT, UPDATE_COMPOSE_SERVICE, UPDATE_COMPOSE_PROJECT_DIR and UPDATE_COMPOSE_FILES " +
	"(host paths, comma separated) to enable in-place updates.";

export function shellQuote(value: string): string {
	return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

function splitList(value: string | undefined): string[] {
	return (value ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function assertInside(directory: string, file: string, what: string): void {
	const rel = relative(directory, file);
	if (!isAbsolute(file) || rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
		throw new Error(
			`${what} ${file} must be an absolute path inside the Compose project directory ${directory}. ` +
				"The update helper only mounts that directory; set UPDATE_COMPOSE_PROJECT_DIR to a parent directory if needed.",
		);
	}
}

/** Explicit UPDATE_COMPOSE_* config wins over the labels Compose put on the container. */
export function resolveComposeLayout(labels: Record<string, string>, cfg: ComposeOverrides): ComposeLayout {
	const projectName = cfg.UPDATE_COMPOSE_PROJECT || labels["com.docker.compose.project"];
	const service = cfg.UPDATE_COMPOSE_SERVICE || labels["com.docker.compose.service"];
	const labelFiles = splitList(labels["com.docker.compose.project.config_files"]).filter((f) => f !== OVERRIDE_PATH);
	const configFiles = cfg.UPDATE_COMPOSE_FILES ? splitList(cfg.UPDATE_COMPOSE_FILES) : labelFiles;
	if (!projectName || !service || configFiles.length === 0) throw new Error(MISSING_LAYOUT_HELP);

	if (!SERVICE_RE.test(service)) throw new Error(`Invalid Compose service name: ${service}`);

	// Compose v2 sets working_dir; older releases did not.
	const projectDirectory =
		cfg.UPDATE_COMPOSE_PROJECT_DIR || labels["com.docker.compose.project.working_dir"] || dirname(configFiles[0]);
	const envFiles = cfg.UPDATE_COMPOSE_ENV_FILES
		? splitList(cfg.UPDATE_COMPOSE_ENV_FILES)
		: splitList(labels["com.docker.compose.project.environment_file"]);

	if (!isAbsolute(projectDirectory)) throw new Error(`Compose project directory must be absolute: ${projectDirectory}`);
	for (const file of configFiles) assertInside(projectDirectory, file, "Compose file");
	for (const file of envFiles) assertInside(projectDirectory, file, "Compose env file");

	return { projectName, projectDirectory, configFiles, envFiles, service };
}

/**
 * The mutable ref (tag) the instance follows. The running container may have
 * been created from a pinned image ID, so remember the ref in a label.
 */
export function resolveTrackedRef(
	cfg: Pick<ComposeOverrides, "UPDATE_IMAGE">,
	labels: Record<string, string>,
	configImage: string,
): string {
	const ref = cfg.UPDATE_IMAGE || labels[TRACK_LABEL] || configImage;
	if (!ref || IMAGE_ID_RE.test(ref) || /^[a-f0-9]{64}$/.test(ref) || !REF_RE.test(ref)) {
		throw new Error(
			"Cannot determine which image to track for updates (the container runs a bare image ID). " +
				"Set UPDATE_IMAGE to the image reference to follow, e.g. registry.example.com/shsf/core:prod.",
		);
	}
	return ref;
}

/** Registry host of an image reference; Docker Hub when the first segment is not a host name. */
export function registryHost(ref: string): string {
	const parts = ref.split("/");
	const first = parts[0];
	return parts.length > 1 && (first.includes(".") || first.includes(":") || first === "localhost") ? first : "docker.io";
}

const normalizeHost = (host: string) => host.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^index\.docker\.io$/, "docker.io");

/**
 * Registry auth for dockerode (the daemon does not read the client's ~/.docker/config.json).
 * Credentials are only attached to images on the registry they belong to: the configured
 * UPDATE_REGISTRY_SERVER, or the tracked image's registry. Never to e.g. the Docker Hub helper image.
 */
export function registryAuth(
	ref: string,
	cfg: { UPDATE_REGISTRY_USERNAME?: string; UPDATE_REGISTRY_PASSWORD?: string; UPDATE_REGISTRY_SERVER?: string },
	trackedRef: string = ref,
): { username: string; password: string; serveraddress: string } | undefined {
	if (!cfg.UPDATE_REGISTRY_USERNAME || !cfg.UPDATE_REGISTRY_PASSWORD) return undefined;
	const host = registryHost(ref);
	const credentialHost = cfg.UPDATE_REGISTRY_SERVER ? normalizeHost(cfg.UPDATE_REGISTRY_SERVER) : registryHost(trackedRef);
	if (host !== credentialHost) return undefined;
	return {
		username: cfg.UPDATE_REGISTRY_USERNAME,
		password: cfg.UPDATE_REGISTRY_PASSWORD,
		serveraddress: cfg.UPDATE_REGISTRY_SERVER || (host === "docker.io" ? "https://index.docker.io/v1/" : host),
	};
}

export type HelperScriptOptions = {
	layout: ComposeLayout;
	oldImageId: string;
	newImageId: string;
	trackedRef: string;
	/** Docker network the old container is on, or "host" */
	network: string;
	port: number;
	composeSeconds: number;
	readinessSeconds: number;
	/** Delay before touching the running service so the API response is delivered */
	settleSeconds?: number;
	pollSeconds?: number;
};

/**
 * Script run inside the short-lived helper container. Only the updater-managed
 * service is replaced (`--no-deps --force-recreate <service>`), pinned to an
 * immutable image ID through a generated override file. The new container must
 * stay running, never restart, report healthy (when a healthcheck exists) and
 * answer GET /ready (which pings the database, after `prisma migrate deploy`
 * ran in the container's CMD) three polls in a row. Otherwise the previous
 * image ID is re-applied the same way.
 *
 * Output contract (parsed by parseHelperOutput): `##PHASE <name>`,
 * `##REASON <text>`, `##RESULT completed|rolled_back|failed`.
 */
export function buildHelperScript(opts: HelperScriptOptions): string {
	if (!IMAGE_ID_RE.test(opts.oldImageId) || !IMAGE_ID_RE.test(opts.newImageId)) {
		throw new Error("Image IDs must be sha256 digests");
	}
	if (!REF_RE.test(opts.trackedRef)) throw new Error(`Invalid image reference: ${opts.trackedRef}`);
	if (!SERVICE_RE.test(opts.layout.service)) throw new Error(`Invalid Compose service name: ${opts.layout.service}`);
	if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(opts.network)) throw new Error(`Invalid network name: ${opts.network}`);

	const { layout } = opts;
	const compose = [
		// Plain output: the helper has a TTY, and progress animation would garble the ##markers.
		"docker compose --ansi never --progress plain",
		`-p ${shellQuote(layout.projectName)}`,
		`--project-directory ${shellQuote(layout.projectDirectory)}`,
		...layout.configFiles.map((file) => `-f ${shellQuote(file)}`),
		...layout.envFiles.map((file) => `--env-file ${shellQuote(file)}`),
	].join(" ");

	return `set -u
PROJECT=${shellQuote(layout.projectName)}
SERVICE=${shellQuote(layout.service)}
OLD_ID=${shellQuote(opts.oldImageId)}
NEW_ID=${shellQuote(opts.newImageId)}
REF=${shellQuote(opts.trackedRef)}
NET=${shellQuote(opts.network)}
PORT=${Number(opts.port)}
UP_T=${Number(opts.composeSeconds)}
READY_T=${Number(opts.readinessSeconds)}
POLL=${Number(opts.pollSeconds ?? 3)}
OVERRIDE=${OVERRIDE_PATH}
ROLLING=0
say() { echo "##$*"; }
phase() { [ "$ROLLING" = 1 ] || say "PHASE $1"; }
write_override() {
  printf 'services:\\n  %s:\\n    image: %s\\n    labels:\\n      ${TRACK_LABEL}: "%s"\\n' "$SERVICE" "$1" "$REF" > "$OVERRIDE"
}
container_id() {
  docker ps -aq --filter "label=com.docker.compose.project=$PROJECT" --filter "label=com.docker.compose.service=$SERVICE" | head -n1
}
deploy() {
  write_override "$1" || { say "REASON could not write the Compose override file"; return 1; }
  timeout "$UP_T" ${compose} -f "$OVERRIDE" up -d --no-deps --no-build --pull never --force-recreate "$SERVICE" \\
    || { say "REASON docker compose up failed or exceeded \${UP_T}s"; return 1; }
}
wait_ready() {
  end=$(( $(date +%s) + READY_T )); good=0; cid=""
  phase migration
  while [ "$(date +%s)" -lt "$end" ]; do
    cid=$(container_id)
    if [ -z "$cid" ]; then say "REASON replacement container not found"; return 1; fi
    insp() { docker inspect -f "$1" "$cid"; }
    st=$(insp '{{.State.Status}}'); rc=$(insp '{{.RestartCount}}')
    if [ "$rc" != 0 ] || [ "$st" = exited ] || [ "$st" = dead ]; then
      say "REASON container crashed or restarted (status=$st restarts=$rc exit=$(insp '{{.State.ExitCode}}')); a failed migration or startup error is the usual cause"
      docker logs --tail 40 "$cid" 2>&1
      return 1
    fi
    hs=$(insp '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}')
    if [ "$hs" = unhealthy ]; then say "REASON container healthcheck reports unhealthy"; docker logs --tail 40 "$cid" 2>&1; return 1; fi
    if [ "$NET" = host ]; then host=127.0.0.1; else host=$(insp "{{with index .NetworkSettings.Networks \\"$NET\\"}}{{.IPAddress}}{{end}}"); fi
    if [ -n "$host" ] && [ "$st" = running ] && { [ "$hs" = none ] || [ "$hs" = healthy ]; } \\
       && wget -q -T 3 -O /dev/null "http://$host:$PORT/ready"; then
      good=$((good + 1)); [ "$good" = 1 ] && phase verification
      [ "$good" -ge 3 ] && return 0
    else
      good=0
    fi
    sleep "$POLL"
  done
  say "REASON readiness not reached within \${READY_T}s"
  [ -n "$cid" ] && docker logs --tail 40 "$cid" 2>&1
  return 1
}

phase replacement
write_override "$NEW_ID"
if ! timeout 60 ${compose} -f "$OVERRIDE" config -q; then
  say "REASON Compose configuration is invalid; check the Compose files and env files (UPDATE_COMPOSE_*)"
  say "RESULT failed"; exit 1
fi
sleep ${Number(opts.settleSeconds ?? 2)}
if deploy "$NEW_ID" && wait_ready; then
  phase completion; say "RESULT completed"; exit 0
fi
echo "Update failed, rolling back to $OLD_ID"
ROLLING=1; say "PHASE rollback"
if deploy "$OLD_ID" && wait_ready; then
  say "RESULT rolled_back"; exit ${HELPER_EXIT_ROLLED_BACK}
fi
say "REASON rollback to the previous image also failed; manual intervention required"
say "RESULT failed"; exit 1
`;
}

export type HelperProgress = {
	phase: "replacement" | "migration" | "verification" | "completion" | "rollback" | null;
	reason: string | null;
	result: "completed" | "rolled_back" | "failed" | null;
};

const HELPER_PHASES = new Set(["replacement", "migration", "verification", "completion", "rollback"]);

/** Reads the marker lines from (TTY, so \r\n) helper output. The last PHASE wins; all REASONs are joined, oldest first. */
export function parseHelperOutput(output: string): HelperProgress {
	const progress: HelperProgress = { phase: null, reason: null, result: null };
	const reasons: string[] = [];
	for (const raw of output.split("\n")) {
		// eslint-disable-next-line no-control-regex -- strips terminal escape sequences
		const line = raw.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").replace(/\r/g, "");
		const [, kind, rest] = /^\s*##(PHASE|REASON|RESULT)\s?(.*)$/.exec(line) ?? [];
		if (!kind) continue;
		if (kind === "PHASE" && HELPER_PHASES.has(rest)) progress.phase = rest as HelperProgress["phase"];
		else if (kind === "REASON") reasons.push(rest);
		else if (kind === "RESULT" && (rest === "completed" || rest === "rolled_back" || rest === "failed")) progress.result = rest;
	}
	progress.reason = reasons.length ? reasons.join(" -> ") : null;
	return progress;
}
