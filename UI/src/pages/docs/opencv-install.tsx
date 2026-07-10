import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader } from "./_components";

export const OpencvInstallPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="OpenCV Installation">
				Enable <strong>Install OpenCV</strong> to automatically install{" "}
				<code>python3-opencv</code> inside your function's container using{" "}
				<code>apt install</code>. Because of its size, OpenCV is not included
				in the base Python images.
			</DocHeader>

			<Callout variant="note" title="Python only">
				<p>
					OpenCV installation is only supported for Python functions. It is
					automatically disabled for HTML-only (serve-only) functions.
				</p>
			</Callout>

			<h2>How the install works</h2>
			<p>
				SHSF uses a marker file to ensure the install happens only once:
			</p>
			<CodeCaption>Init script (simplified)</CodeCaption>
			<pre>
				<code>{`if [ ! -f ".already_installed_opencv" ]; then
    python3 -c "import cv2" 2>/dev/null || (apt update && apt install -y python3-opencv)
    touch /app/.already_installed_opencv
fi`}</code>
			</pre>
			<p>
				The marker file <code>/app/.already_installed_opencv</code> persists in{" "}
				<code>/app/</code> so the install is skipped on every subsequent
				invocation.
			</p>

			<h2>How to enable</h2>
			<p>
				When creating or updating a function, expand{" "}
				<strong>Advanced Settings</strong> and toggle{" "}
				<strong>Install OpenCV</strong> on.
			</p>

			<h2>Using OpenCV in your function</h2>
			<CodeCaption>Python — import and use cv2</CodeCaption>
			<pre>
				<code>{`import cv2
import numpy as np

def main(args):
    # Create a blank 100×100 RGB image
    img = np.zeros((100, 100, 3), dtype=np.uint8)

    return {
        "opencv_version": cv2.__version__,
        "image_shape":    list(img.shape)
    }`}</code>
			</pre>

			<h2>More advanced example — edge detection</h2>
			<CodeCaption>Python — Canny edge detection on an uploaded image</CodeCaption>
			<pre>
				<code>{`import cv2
import numpy as np
import base64, json

def main(args):
    data = json.loads(args.get("body", "{}"))
    image_b64 = data.get("image", "")
    if not image_b64:
        return {"_shsf": "v2", "_code": 400, "_res": {"error": "no image provided"}}

    img_bytes = base64.b64decode(image_b64)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    gray  = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 100, 200)

    _, buf = cv2.imencode(".png", edges)
    result_b64 = base64.b64encode(buf.tobytes()).decode()

    return {
        "_shsf":    "v2",
        "_code":    200,
        "_headers": {"Content-Type": "application/json"},
        "_res":     {"edges": result_b64}
    }`}</code>
			</pre>

			<h2>Triggering a reinstall</h2>
			<p>
				If the OpenCV install was interrupted or became corrupted, delete the
				marker file to force a reinstall on the next invocation:
			</p>
			<CodeCaption>Docker exec — remove the marker file</CodeCaption>
			<pre>
				<code>{`docker exec -it shsf_func_{FUNCTION_ID} rm /app/.already_installed_opencv`}</code>
			</pre>
			<p>
				You can also trigger a reinstall from the UI: open the{" "}
				<strong>Update Function</strong> modal (when OpenCV is enabled a{" "}
				<strong>Trigger Reinstall</strong> button appears) or use the{" "}
				<strong>OpenCV</strong> button on the function detail page.
			</p>

			<div className="mt-12 rounded-xl border border-primary/30 bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-6">
				<div className="mb-3 text-xl font-bold text-primary">📚 End of docs</div>
				<p className="mb-4 text-text/90">
					You've reached the last documentation page. Keep your SHSF instance
					updated to get access to new features and improvements.
				</p>
				<a
					href="/docs"
					className="inline-flex items-center gap-2 font-medium text-blue-400 transition-colors hover:text-blue-300"
				>
					← Back to docs index
					<span className="text-lg"></span>
				</a>
			</div>
		</DocsContentShell>
	);
};
