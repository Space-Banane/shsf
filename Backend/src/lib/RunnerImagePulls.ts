import { createLogger } from "./logger";

const log = createLogger("RunnerImagePulls");

export interface RuntimeImagePuller {
	listImages(image: string): Promise<unknown[]>;
	pullImage(image: string): Promise<void>;
}

export type RuntimeImageStatus = "available" | "pulling";

// A pull is shared by all executions on this server so repeated requests do not
// start competing downloads for the same image.
const activeImagePulls = new Map<string, Promise<void>>();

/**
 * Checks whether a runtime image can be used now. If it is absent, starts one
 * background pull and reports that execution should be retried later.
 */
export async function getRuntimeImageStatus(
	image: string,
	puller: RuntimeImagePuller,
): Promise<RuntimeImageStatus> {
	const images = await puller.listImages(image);
	if (images.length > 0) {
		return "available";
	}

	if (!activeImagePulls.has(image)) {
		const pull = puller
			.pullImage(image)
			.then(() => {
				log.info({ image }, "Runtime image pull completed");
			})
			.catch((err: unknown) => {
				log.error({ err, image }, "Runtime image pull failed");
			})
			.finally(() => {
				if (activeImagePulls.get(image) === pull) {
					activeImagePulls.delete(image);
				}
			});
		activeImagePulls.set(image, pull);
		log.info({ image }, "Runtime image is unavailable; started background pull");
	}

	return "pulling";
}
