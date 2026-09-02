import { describe, expect, it } from "vitest";
import { buildComposeUpdateCommand, updateWasApplied } from "../lib/Updater";

describe("updateWasApplied", () => {
	it("accepts the image actually started by Compose, including a newer tag movement", () => {
		expect(
			updateWasApplied(
				{ updateAvailable: true, currentImageId: "sha256:previous" },
				"sha256:newer-than-the-checked-image",
			),
		).toBe(true);
	});

	it("does not treat the original running image as an applied update", () => {
		expect(
			updateWasApplied({ updateAvailable: true, currentImageId: "sha256:current" }, "sha256:current"),
		).toBe(false);
	});
});

describe("buildComposeUpdateCommand", () => {
	it("pulls the complete project before force-recreating it", () => {
		const command = buildComposeUpdateCommand({
			projectName: "shsf",
			projectDirectory: "/srv/shsf",
			configFiles: ["/srv/shsf/docker-compose.yml", "/srv/shsf/docker-compose.production.yml"],
		});

		expect(command).toBe(
			"docker compose -p 'shsf' --project-directory '/compose-project' -f '/compose-project/docker-compose.yml' -f '/compose-project/docker-compose.production.yml' pull && " +
				"docker compose -p 'shsf' --project-directory '/compose-project' -f '/compose-project/docker-compose.yml' -f '/compose-project/docker-compose.production.yml' up -d --force-recreate",
		);
	});

	it("quotes Compose project names safely", () => {
		const command = buildComposeUpdateCommand({
			projectName: "team's shsf",
			projectDirectory: "/srv/shsf",
			configFiles: ["/srv/shsf/docker-compose.yml"],
		});

		expect(command).toContain("-p 'team'\"'\"'s shsf'");
	});

	it("rejects compose files outside the mounted project", () => {
		expect(() =>
			buildComposeUpdateCommand({
				projectName: "shsf",
				projectDirectory: "/srv/shsf",
				configFiles: ["/etc/docker-compose.yml"],
			}),
		).toThrow("outside the Compose project directory");
	});
});
