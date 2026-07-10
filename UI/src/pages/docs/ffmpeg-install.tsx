import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const FfmpegInstallPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="FFmpeg Installation">
				Enable <strong>Install FFmpeg</strong> to automatically install FFmpeg
				the first time your function's container initialises. Subsequent
				invocations skip the install step — it's a one-time cost, cached
				via a marker file.
			</DocHeader>

			<h2>How the install works</h2>
			<p>
				When FFmpeg installation is enabled, SHSF runs the following logic
				during container initialisation:
			</p>
			<CodeCaption>Init script (simplified)</CodeCaption>
			<pre>
				<code>{`if [ ! -f ".already_installed_ffmpeg" ]; then
    command -v ffmpeg >/dev/null 2>&1 || (apt update && apt-get install -y ffmpeg)
    touch /app/.already_installed_ffmpeg
fi`}</code>
			</pre>
			<p>
				The marker file <code>/app/.already_installed_ffmpeg</code> prevents
				reinstalling on every invocation. Because it lives in{" "}
				<code>/app/</code>, it persists across container restarts.
			</p>
			<Callout variant="note" title="First run is slower">
				<p>
					The very first invocation after enabling FFmpeg will take longer while
					the package installs. All subsequent runs start at full speed.
				</p>
			</Callout>

			<h2>How to enable</h2>
			<p>
				When creating or updating a function, expand{" "}
				<strong>Advanced Settings</strong> and toggle{" "}
				<strong>Install FFmpeg</strong> on.
			</p>

			<h2>Example — convert video to WebM</h2>
			<CodeCaption>Python</CodeCaption>
			<pre>
				<code>{`import subprocess, base64

def main(args):
    import json
    data = json.loads(args.get("body", "{}"))
    video_b64 = data.get("video", "")

    with open("/app/input.mp4", "wb") as f:
        f.write(base64.b64decode(video_b64))

    result = subprocess.run(
        ["ffmpeg", "-i", "/app/input.mp4",
         "-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0",
         "/app/output.webm"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        return {"_shsf": "v2", "_code": 500, "_res": {"error": result.stderr}}

    with open("/app/output.webm", "rb") as f:
        out_b64 = base64.b64encode(f.read()).decode()

    return {"_shsf": "v2", "_code": 200, "_res": {"video": out_b64, "format": "webm"}}`}</code>
			</pre>

			<h2>Example — generate a video thumbnail</h2>
			<CodeCaption>Python</CodeCaption>
			<pre>
				<code>{`import subprocess, base64

def main(args):
    video_url = args.get("queries", {}).get("url", "")
    if not video_url:
        return {"_shsf": "v2", "_code": 400, "_res": {"error": "url query param required"}}

    result = subprocess.run(
        ["ffmpeg", "-i", video_url, "-ss", "00:00:05",
         "-vframes", "1", "-vf", "scale=320:180", "/app/thumb.jpg"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        return {"_shsf": "v2", "_code": 500, "_res": {"error": result.stderr}}

    with open("/app/thumb.jpg", "rb") as f:
        thumb_b64 = base64.b64encode(f.read()).decode()

    return {
        "_shsf": "v2",
        "_code": 200,
        "_headers": {"Content-Type": "application/json"},
        "_res": {"thumbnail": thumb_b64, "at": "5s"}
    }`}</code>
			</pre>

			<h2>Forcing a reinstall</h2>
			<p>
				If the FFmpeg install was interrupted or you need to reinstall, delete
				the marker file from the running container:
			</p>
			<CodeCaption>Docker exec — remove the marker file</CodeCaption>
			<pre>
				<code>{`docker exec -it shsf_func_{FUNCTION_ID} rm /app/.already_installed_ffmpeg`}</code>
			</pre>
			<p>
				Replace <code>{`{FUNCTION_ID}`}</code> with your function's numeric ID
				(visible in the URL). The next invocation will re-run the install.
			</p>

			<h2>Performance tips</h2>
			<ul>
				<li>
					FFmpeg operations are CPU-intensive. If your function times out, raise
					the timeout in function settings.
				</li>
				<li>
					Write intermediate files to <code>/app/</code> rather than{" "}
					<code>/tmp/</code> so they survive between invocations (useful for
					multi-step pipelines).
				</li>
				<li>
					For large media files, consider streaming or chunking rather than
					loading everything into memory at once.
				</li>
			</ul>

			<NextStep href="/docs/go-runtime" label="#20 Go Runtime">
				Next: build high-performance functions in Go — compiled, cached, and
				running in the same SHSF environment.
			</NextStep>
		</DocsContentShell>
	);
};
