import { describe, expect, it, vi } from "vitest";
import {
	getRuntimeImageStatus,
	type RuntimeImagePuller,
} from "../lib/RunnerImagePulls";

function createPuller(images: unknown[] = []): RuntimeImagePuller & {
	images: unknown[];
	pullImage: ReturnType<typeof vi.fn>;
} {
	const state = { images };
	return {
		images: state.images,
		listImages: vi.fn(async () => state.images),
		pullImage: vi.fn(async () => undefined),
	};
}

describe("getRuntimeImageStatus", () => {
	it("uses an already-pulled image without starting a pull", async () => {
		const puller = createPuller([{ Id: "sha256:available" }]);

		await expect(getRuntimeImageStatus("python:3.12", puller)).resolves.toBe(
			"available",
		);
		expect(puller.pullImage).not.toHaveBeenCalled();
	});

	it("starts exactly one background pull for concurrent requests", async () => {
		let finishPull: (() => void) | undefined;
		const puller: RuntimeImagePuller = {
			listImages: vi.fn(async () => []),
			pullImage: vi.fn(
				() =>
					new Promise<void>((resolve) => {
						finishPull = resolve;
					}),
			),
		};

		await expect(getRuntimeImageStatus("node:24", puller)).resolves.toBe("pulling");
		await expect(getRuntimeImageStatus("node:24", puller)).resolves.toBe("pulling");
		expect(puller.pullImage).toHaveBeenCalledTimes(1);

		finishPull?.();
	});

	it("allows a later request to retry when a background pull fails", async () => {
		let rejectPull: ((reason?: unknown) => void) | undefined;
		const puller: RuntimeImagePuller = {
			listImages: vi.fn(async () => []),
			pullImage: vi.fn(
				() =>
					new Promise<void>((_resolve, reject) => {
						rejectPull = reject;
					}),
			),
		};

		await expect(getRuntimeImageStatus("golang:1.23", puller)).resolves.toBe("pulling");
		rejectPull?.(new Error("registry unavailable"));
		await vi.waitFor(() => expect(puller.pullImage).toHaveBeenCalledTimes(1));
		await vi.waitFor(async () => {
			await getRuntimeImageStatus("golang:1.23", puller);
			expect(puller.pullImage).toHaveBeenCalledTimes(2);
		});
	});
});
