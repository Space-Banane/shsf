import { useEffect, useMemo, useRef, useState } from "react";

type ParseResult = {
	mode: "guided" | "raw";
	route: string;
	payloadJson: string;
	rawJson: string;
	error: string | null;
	warning: string | null;
};

interface TriggerPayloadEditorProps {
	value: string;
	onChange: (value: string) => void;
	onValidityChange?: (isValid: boolean) => void;
	disabled?: boolean;
	inputIdPrefix?: string;
}

function formatJson(value: Record<string, unknown>) {
	return JSON.stringify(value, null, 2);
}

function validateRoute(route: unknown) {
	if (route === undefined || route === null || route === "") return null;
	if (typeof route !== "string") return "`route` must be a string.";
	if (route.includes("/")) return "Route must be a single segment without slashes.";
	return null;
}

function normalizeObject(value: unknown) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {
			value: null,
			error: "Payload must be a JSON object.",
		};
	}

	return {
		value: value as Record<string, unknown>,
		error: null,
	};
}

function parseGuidedPayload(payloadValue: string): ParseResult {
	const rawJson = payloadValue?.trim() ? payloadValue : "{}";

	try {
		const parsed = JSON.parse(rawJson);
		const normalized = normalizeObject(parsed);
		if (!normalized.value) {
			return {
				mode: "raw",
				route: "",
				payloadJson: "{}",
				rawJson,
				error: normalized.error,
				warning: "Switching to raw mode because the stored payload is not an object.",
			};
		}

		const routeError = validateRoute(normalized.value.route);
		const { route, ...rest } = normalized.value;

		return {
			mode: routeError ? "raw" : "guided",
			route: typeof route === "string" ? route : "",
			payloadJson: formatJson(rest),
			rawJson: formatJson(normalized.value),
			error: routeError,
			warning: routeError
				? "Switching to raw mode because the stored route is invalid."
				: null,
		};
	} catch {
		return {
			mode: "raw",
			route: "",
			payloadJson: "{}",
			rawJson,
			error: "Payload must be valid JSON.",
			warning: "Switching to raw mode because the stored payload could not be parsed.",
		};
	}
}

function buildGuidedPayload(route: string, payloadJson: string) {
	let parsedPayload: unknown;

	try {
		parsedPayload = JSON.parse(payloadJson || "{}");
	} catch {
		return {
			value: null,
			error: "Payload data must be valid JSON.",
		};
	}

	const normalized = normalizeObject(parsedPayload);
	if (!normalized.value) {
		return {
			value: null,
			error: normalized.error,
		};
	}

	const trimmedRoute = route.trim();
	const routeError = validateRoute(trimmedRoute);
	if (routeError) {
		return {
			value: null,
			error: routeError,
		};
	}

	const nextPayload = trimmedRoute
		? { route: trimmedRoute, ...normalized.value }
		: normalized.value;

	return {
		value: JSON.stringify(nextPayload),
		error: null,
	};
}

function buildRawPayload(rawJson: string) {
	let parsedPayload: unknown;

	try {
		parsedPayload = JSON.parse(rawJson || "{}");
	} catch {
		return {
			value: null,
			error: "Payload must be valid JSON.",
		};
	}

	const normalized = normalizeObject(parsedPayload);
	if (!normalized.value) {
		return {
			value: null,
			error: normalized.error,
		};
	}

	const routeError = validateRoute(normalized.value.route);
	if (routeError) {
		return {
			value: null,
			error: routeError,
		};
	}

	return {
		value: JSON.stringify(normalized.value),
		error: null,
	};
}

function TriggerPayloadEditor({
	value,
	onChange,
	onValidityChange,
	disabled,
	inputIdPrefix = "trigger-payload",
}: TriggerPayloadEditorProps) {
	const [mode, setMode] = useState<"guided" | "raw">("guided");
	const [route, setRoute] = useState("");
	const [payloadJson, setPayloadJson] = useState("{}");
	const [rawJson, setRawJson] = useState("{}");
	const [warning, setWarning] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const lastEmittedValueRef = useRef<string | null>(null);
	const [showRawEditor, setShowRawEditor] = useState(false);

	useEffect(() => {
		if (value === lastEmittedValueRef.current) {
			lastEmittedValueRef.current = null;
			return;
		}

		const parsed = parseGuidedPayload(value || "{}");
		setMode(parsed.mode);
		setRoute(parsed.route);
		setPayloadJson(parsed.payloadJson);
		setRawJson(parsed.rawJson);
		setWarning(parsed.warning);
		setError(parsed.error);
		onValidityChange?.(!parsed.error);
	}, [value, onValidityChange]);

	const guidedPreview = useMemo(() => {
		const result = buildGuidedPayload(route, payloadJson);
		return result.value ? JSON.stringify(JSON.parse(result.value), null, 2) : null;
	}, [payloadJson, route]);

	const updateGuided = (nextRoute: string, nextPayloadJson: string) => {
		setRoute(nextRoute);
		setPayloadJson(nextPayloadJson);
		setWarning(null);

		const result = buildGuidedPayload(nextRoute, nextPayloadJson);
		setError(result.error);
		onValidityChange?.(!result.error);
		if (result.value) {
			lastEmittedValueRef.current = result.value;
			setRawJson(JSON.stringify(JSON.parse(result.value), null, 2));
			onChange(result.value);
		}
	};

	const updateRaw = (nextRawJson: string) => {
		setRawJson(nextRawJson);
		setWarning(null);

		const result = buildRawPayload(nextRawJson);
		setError(result.error);
		onValidityChange?.(!result.error);
		if (result.value) {
			lastEmittedValueRef.current = result.value;
			const parsed = JSON.parse(result.value) as Record<string, unknown>;
			const { route: nextRoute, ...rest } = parsed;
			setRoute(typeof nextRoute === "string" ? nextRoute : "");
			setPayloadJson(formatJson(rest));
			onChange(result.value);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<div>
					<label className="flex items-center gap-2 text-sm font-medium text-gray-300">
						<span className="text-lg">📊</span>
						Payload
					</label>
					<p className="text-xs text-gray-400 mt-1">
						Cron payloads are sent as top-level JSON keys on <code>args</code>.
					</p>
				</div>
				<div className="inline-flex rounded-lg border border-gray-700/60 bg-gray-900/40 p-1">
					<button
						type="button"
						onClick={() => {
							setMode("guided");
							setShowRawEditor(false);
						}}
						disabled={disabled}
						className={`px-3 py-1.5 text-xs rounded-md transition-all ${
							mode === "guided"
								? "bg-primary/20 text-primary"
								: "text-gray-400 hover:text-white"
						}`}
					>
						Guided
					</button>
					<button
						type="button"
						onClick={() => {
							setMode("raw");
							setShowRawEditor(true);
						}}
						disabled={disabled}
						className={`px-3 py-1.5 text-xs rounded-md transition-all ${
							mode === "raw"
								? "bg-primary/20 text-primary"
								: "text-gray-400 hover:text-white"
						}`}
					>
						Raw JSON
					</button>
				</div>
			</div>

			{warning && (
				<div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
					{warning}
				</div>
			)}

			{mode === "guided" ? (
				<div className="space-y-4">
					<div className="space-y-2">
						<label
							htmlFor={`${inputIdPrefix}-route`}
							className="flex items-center gap-2 text-sm font-medium text-gray-300"
						>
							<span className="text-lg">🛣️</span>
							Route
						</label>
						<input
							id={`${inputIdPrefix}-route`}
							type="text"
							placeholder="default, register, nightly-sync"
							value={route}
							onChange={(e) => updateGuided(e.target.value, payloadJson)}
							className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 font-mono"
							disabled={disabled}
						/>
						<p className="text-xs text-gray-400">
							Optional. Maps to <code>args.route</code>. Use a single segment without
							slashes.
						</p>
					</div>

					<div className="space-y-2">
						<label
							htmlFor={`${inputIdPrefix}-data`}
							className="flex items-center gap-2 text-sm font-medium text-gray-300"
						>
							<span className="text-lg">🧩</span>
							Payload Data (JSON)
						</label>
						<textarea
							id={`${inputIdPrefix}-data`}
							placeholder='{"key": "value"}'
							value={payloadJson}
							onChange={(e) => updateGuided(route, e.target.value)}
							className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 font-mono resize-none"
							rows={6}
							disabled={disabled}
						/>
						<p className="text-xs text-gray-400">
							Enter top-level keys other than <code>route</code>.
						</p>
					</div>

					<details className="rounded-lg border border-gray-700/50 bg-gray-900/30 p-3">
						<summary className="cursor-pointer text-xs font-semibold text-primary">
							Preview final payload
						</summary>
						<pre className="mt-2 whitespace-pre-wrap break-all text-xs text-gray-300 font-mono">
							{guidedPreview ?? "Invalid payload"}
						</pre>
					</details>
				</div>
			) : (
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<label
							htmlFor={`${inputIdPrefix}-raw`}
							className="flex items-center gap-2 text-sm font-medium text-gray-300"
						>
							<span className="text-lg">{"{}"}</span>
							Raw Payload JSON
						</label>
						<button
							type="button"
							onClick={() => setShowRawEditor((prev) => !prev)}
							className="text-xs text-primary/80 transition-colors hover:text-white"
							disabled={disabled}
						>
							{showRawEditor ? "Hide raw JSON" : "Show raw JSON"}
						</button>
					</div>
					{showRawEditor && (
						<textarea
							id={`${inputIdPrefix}-raw`}
							placeholder='{"route": "register", "key": "value"}'
							value={rawJson}
							onChange={(e) => updateRaw(e.target.value)}
							className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 font-mono resize-none"
							rows={8}
							disabled={disabled}
						/>
					)}
					<p className="text-xs text-gray-400">
						Advanced mode. Payload must be a JSON object and any <code>route</code>{" "}
						value must be a single segment.
					</p>
				</div>
			)}

			{error && (
				<div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
					{error}
				</div>
			)}
		</div>
	);
}

export default TriggerPayloadEditor;
export { buildGuidedPayload, buildRawPayload, parseGuidedPayload };
