import { DocsContentShell } from "./DocsContentShell";
import { Callout, DocHeader } from "./_components";

export const LogAnalysisDocPage = () => (
	<DocsContentShell>
		<DocHeader title="Log Analysis (OpenRouter Decisions)">
			Optional advisory triage for execution logs. When you opt in, SHSF sends
			sanitized new logs to OpenRouter's Decisions API and stores two typed
			answers per log: how likely it shows a failure, and a 1–10 attention
			priority. It is off by default and never changes the recorded exit code.
		</DocHeader>

		<h2>Turning it on</h2>
		<ol>
			<li>Make an OpenRouter key available: either save OpenRouter as your provider under <strong>Account → AI generation</strong>, or have the admin set <code>OPENROUTER_API_KEY</code>. Keys for other providers are not used.</li>
			<li>Under <strong>Account → Log analysis</strong>, enter a model listed for OpenRouter's Decisions API and click <strong>Turn on log analysis</strong>. SHSF sends one small test request; a 401/403 means the key cannot use the Decisions API, a 404 means the model is not a Decisions model.</li>
			<li>On each function, open the <strong>Logs</strong> card and enable <strong>Analyze new logs with OpenRouter</strong>. Logging must be on.</li>
		</ol>
		<p>Analysis runs only when both the account and the function are opted in. Logs written before you opt in are never sent; there is no automatic backfill.</p>

		<h2>What leaves the server</h2>
		<p>For each new log of an opted-in function: the log text, exit code, error type, and total duration. Before sending, SHSF masks bearer/basic tokens, <code>key=value</code> secrets (passwords, tokens, API keys, cookies, authorization headers), JWTs, common provider keys, private keys, credentials in URLs, email addresses, and the values of your account and function environment variables and secure header. Logs are then trimmed to 8,000 characters, keeping the start and the end. Request payloads and function output are not sent.</p>
		<Callout variant="warning" title="Masking is best effort">
			<p>Pattern masking cannot recognize every secret or every piece of personal data. Don't opt in functions whose logs contain data you are not allowed to share with OpenRouter and the model provider.</p>
		</Callout>

		<h2>How results are processed</h2>
		<p>A background job picks up queued logs every 10 seconds, at most 5 per tick across the instance, so function responses are never delayed. Requests time out after 30 seconds. Rate-limited requests (HTTP 429) are retried up to 3 attempts with backoff. Timeouts, network errors, and upstream (5xx) errors fail without a retry, because OpenRouter may already have billed the request. Key, credit, model, and malformed-response errors also fail immediately. Queued work is stored in the database and resumes after a restart. A request that was in flight during a crash or restart is marked failed rather than resent, because it may already have been billed. Each log is analyzed at most once.</p>
		<p><strong>Failure signal</strong> is set when the returned failure probability is 0.5 or higher; the raw probability and the full typed answers are kept. <strong>Priority</strong> is the model's expected score on a 10-level scale, rounded. Both are advisory triage hints and can disagree with the exit code. Success rate on the Analytics page still uses exit codes only.</p>
		<p>Statuses: <em>queued/analyzing</em>, <em>completed</em>, <em>failed</em> (provider error), <em>unavailable</em> (no key), and <em>turned off</em> (opt-in removed before it ran). Logs with no status were never queued.</p>

		<h2>Cost</h2>
		<p>Every analyzed log is a billed OpenRouter request on the key in use. The cost reported by OpenRouter is shown per execution and summed on the Analytics page.</p>

		<h2>Turning it off</h2>
		<p>Use <strong>Turn off log analysis</strong> in account settings, or disable the toggle on a function. Queued logs that have not run yet are marked <em>turned off</em> and are not sent. Deleting a log deletes its analysis.</p>
	</DocsContentShell>
);
