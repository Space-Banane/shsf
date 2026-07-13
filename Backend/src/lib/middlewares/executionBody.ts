export async function readRawRequestBodyFromMiddleware(ctr: any): Promise<Buffer> {
	if (ctr.url.method === "GET" || ctr.url.method === "HEAD") {
		return Buffer.alloc(0);
	}

	const requestContext = ctr.context;
	if (requestContext.body.awaiting) {
		return new Promise((resolve) => requestContext.body.callbacks.push(resolve));
	}
	if (requestContext.body.raw) {
		return requestContext.body.raw;
	}

	// rjweb-server only concatenates body chunks through awaitBody() once a matched route exists.
	// This middleware runs before route matching, so we need to collect the raw body ourselves.
	requestContext.body.awaiting = true;
	try {
		await ctr.rawContext.onBodyChunk((chunk: ArrayBuffer | Uint8Array, isLast: boolean) => {
			requestContext.body.chunks.push(Buffer.from(chunk));
			if (!isLast) {
				return;
			}

			const rawBody = Buffer.concat(requestContext.body.chunks);
			requestContext.body.raw = rawBody;
			requestContext.body.chunks.length = 0;
			for (const callback of requestContext.body.callbacks) {
				callback(rawBody);
			}
			requestContext.body.callbacks.length = 0;
		});
	} finally {
		requestContext.body.awaiting = false;
	}

	return requestContext.body.raw ?? Buffer.alloc(0);
}
