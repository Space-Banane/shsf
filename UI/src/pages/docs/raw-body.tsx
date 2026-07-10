import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const RawBodyPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Raw Body Handling">
				<code>args["raw_body"]</code> gives you the unmodified request body as
				a binary string (Latin-1 encoding). Use it whenever you need to process
				binary data — file uploads, images, audio, or any non-JSON payload.
			</DocHeader>

			<Callout variant="note" title="raw_body vs body">
				<p>
					<code>args["body"]</code> is the UTF-8 decoded string — fine for JSON
					and text. <code>args["raw_body"]</code> is the same bytes read back
					as Latin-1, preserving every byte value. Use <code>raw_body</code>{" "}
					when byte-exact handling matters (e.g. images, binary protocols).
				</p>
			</Callout>

			<h2>Converting raw_body to bytes (Python)</h2>
			<p>
				In Python, encode the Latin-1 string back to <code>bytes</code> to get
				the original binary data:
			</p>
			<CodeCaption>Python — decode raw_body to bytes</CodeCaption>
			<pre>
				<code>{`def main(args):
    raw = args.get("raw_body")
    if raw is None:
        return {"_shsf": "v2", "_code": 400, "_res": {"error": "no body"}}

    body_bytes = raw.encode("latin-1")    # recovers the original bytes
    return {"_shsf": "v2", "_code": 200, "_res": {"size": len(body_bytes)}}`}</code>
			</pre>

			<h2>Saving an uploaded file</h2>
			<CodeCaption>Python — write upload to /app/</CodeCaption>
			<pre>
				<code>{`def main(args):
    raw = args.get("raw_body")
    if not raw:
        return {"_shsf": "v2", "_code": 400, "_res": {"error": "no file uploaded"}}

    body_bytes = raw.encode("latin-1")
    with open("/app/upload.bin", "wb") as f:
        f.write(body_bytes)

    return {"_shsf": "v2", "_code": 200, "_res": {"saved": len(body_bytes)}}`}</code>
			</pre>

			<h2>Decoding a base64-encoded payload</h2>
			<p>
				If callers send binary data encoded as base64 in a JSON body, decode
				it from the regular <code>body</code> field instead:
			</p>
			<CodeCaption>Python — decode base64 from JSON body</CodeCaption>
			<pre>
				<code>{`import json, base64

def main(args):
    data = json.loads(args.get("body", "{}"))
    encoded = data.get("file_data", "")
    raw_bytes = base64.b64decode(encoded)

    with open("/app/upload.png", "wb") as f:
        f.write(raw_bytes)
    return {"saved": len(raw_bytes)}`}</code>
			</pre>

			<h2>Parsing multipart form data</h2>
			<CodeCaption>Python — multipart upload with the cgi module</CodeCaption>
			<pre>
				<code>{`import cgi, io

def main(args):
    raw = args.get("raw_body", "").encode("latin-1")
    headers = args.get("headers", {})
    content_type = headers.get("content-type", "")

    environ = {"REQUEST_METHOD": "POST", "CONTENT_TYPE": content_type,
               "CONTENT_LENGTH": str(len(raw))}
    form = cgi.FieldStorage(fp=io.BytesIO(raw), environ=environ)

    if "file" in form:
        file_item = form["file"]
        with open(f"/app/{file_item.filename}", "wb") as f:
            f.write(file_item.file.read())
        return {"uploaded": file_item.filename}
    return {"_shsf": "v2", "_code": 400, "_res": {"error": "no file field"}}`}</code>
			</pre>

			<h2>Use cases</h2>
			<ul>
				<li>File uploads (images, PDFs, audio clips)</li>
				<li>Binary protocol parsing</li>
				<li>Webhook payloads with non-JSON content types</li>
				<li>Receiving raw bytes from IoT devices or sensors</li>
			</ul>

			<NextStep href="/docs/user-interfaces" label="#9 User Interfaces">
				Next: serve full HTML pages from your functions — dashboards, forms,
				and static sites.
			</NextStep>
		</DocsContentShell>
	);
};
