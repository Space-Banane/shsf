import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass } from "../Modal";
import {
	ExecutionRateLimitIdentity,
	getRateLimitConfig,
	RateLimitConfig,
	RateLimitPolicy,
	updateRateLimitConfig,
} from "../../../services/backend.function.ratelimit";

const IDENTITY_OPTIONS: {
	value: ExecutionRateLimitIdentity;
	label: string;
	description: string;
}[] = [
	{ value: "ip", label: "IP Address", description: "Client source IP" },
	{ value: "method", label: "Method", description: "HTTP method like GET or POST" },
	{ value: "route", label: "Route", description: "Execution route segment" },
	{ value: "origin", label: "Origin", description: "Browser Origin header" },
	{
		value: "access_key",
		label: "Access Key",
		description: "Provided x-access-key header",
	},
	{
		value: "secure_header",
		label: "Secure Header",
		description: "Provided x-secure-header value",
	},
	{
		value: "guest_session",
		label: "Guest Session",
		description: "Guest session cookie value",
	},
	{
		value: "execution_alias_or_id",
		label: "Alias or ID",
		description: "Execution alias or execution ID",
	},
];

type RuleFieldState = {
	hits: string;
	windowMs: string;
	penaltyMs: string;
};

type SampleState = {
	method: string;
	route: string;
	origin: string;
};

type PolicyDraft = {
	id: string;
	name: string;
	scope: "global" | "identity";
	enabled: boolean;
	mode: "enforce" | "observe";
	rule: RuleFieldState;
	identities: ExecutionRateLimitIdentity[];
	methods: string;
	routes: string;
	origins: string;
};

function createPolicyId() {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}

	return `policy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ruleToState(rule?: {
	hits: number;
	window_ms: number;
	penalty_ms?: number;
}): RuleFieldState {
	return {
		hits: rule ? String(rule.hits) : "",
		windowMs: rule ? String(rule.window_ms) : "",
		penaltyMs: rule?.penalty_ms !== undefined ? String(rule.penalty_ms) : "",
	};
}

function isPositiveInteger(value: string) {
	return /^[1-9]\d*$/.test(value.trim());
}

function isNonNegativeInteger(value: string) {
	return /^(0|[1-9]\d*)$/.test(value.trim());
}

function parseRuleState(
	rule: RuleFieldState,
): { hits: number; window_ms: number; penalty_ms?: number } | null {
	if (!isPositiveInteger(rule.hits) || !isPositiveInteger(rule.windowMs)) {
		return null;
	}

	if (rule.penaltyMs.trim() !== "" && !isNonNegativeInteger(rule.penaltyMs)) {
		return null;
	}

	return {
		hits: parseInt(rule.hits, 10),
		window_ms: parseInt(rule.windowMs, 10),
		...(rule.penaltyMs.trim() !== ""
			? { penalty_ms: parseInt(rule.penaltyMs, 10) }
			: {}),
	};
}

function normalizeListField(value: string) {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function serializeListField(value: string[] | undefined) {
	return value?.join(", ") ?? "";
}

function formatWindow(windowMs: string) {
	if (!isPositiveInteger(windowMs)) {
		return "Invalid window";
	}

	const value = parseInt(windowMs, 10);
	if (value % 60000 === 0) {
		const minutes = value / 60000;
		return `${minutes}m window`;
	}
	if (value % 1000 === 0) {
		return `${value / 1000}s window`;
	}
	return `${value}ms window`;
}

function rateLimitSummary(policy: PolicyDraft) {
	const rule = parseRuleState(policy.rule);
	const parts = [
		policy.scope === "global" ? "Global" : "Identity",
		rule ? `${rule.hits} hits` : "Incomplete rule",
		rule ? formatWindow(policy.rule.windowMs) : null,
		policy.mode === "observe" ? "Observe only" : "Blocks requests",
	]
		.filter(Boolean)
		.join(" • ");

	return parts;
}

function matchPattern(value: string, pattern: string): boolean {
	if (pattern === "*") {
		return true;
	}
	if (pattern.startsWith("*") && pattern.endsWith("*") && pattern.length > 2) {
		return value.includes(pattern.slice(1, -1));
	}
	if (pattern.startsWith("*")) {
		return value.endsWith(pattern.slice(1));
	}
	if (pattern.endsWith("*")) {
		return value.startsWith(pattern.slice(0, -1));
	}
	return value === pattern;
}

function matchAny(value: string, patterns: string[]) {
	if (patterns.length === 0) {
		return true;
	}
	return patterns.some((pattern) => matchPattern(value, pattern));
}

function matchesPolicy(policy: PolicyDraft, sample: SampleState) {
	return (
		matchAny(sample.method.toUpperCase(), normalizeListField(policy.methods)) &&
		matchAny(sample.route, normalizeListField(policy.routes)) &&
		matchAny(sample.origin, normalizeListField(policy.origins))
	);
}

function policyToDraft(policy: RateLimitPolicy): PolicyDraft {
	return {
		id: policy.id || createPolicyId(),
		name: policy.name || "Policy",
		scope: policy.scope,
		enabled: policy.enabled !== false,
		mode: policy.mode === "observe" ? "observe" : "enforce",
		rule: ruleToState(policy.rule),
		identities: policy.identities ?? [],
		methods: serializeListField(policy.match?.methods),
		routes: serializeListField(policy.match?.routes),
		origins: serializeListField(policy.match?.origins),
	};
}

function draftToPolicy(policy: PolicyDraft): RateLimitPolicy | null {
	const rule = parseRuleState(policy.rule);
	if (!rule) {
		return null;
	}

	if (policy.scope === "identity" && policy.identities.length === 0) {
		return null;
	}

	return {
		id: policy.id,
		name: policy.name.trim() || "Policy",
		scope: policy.scope,
		enabled: policy.enabled,
		mode: policy.mode,
		rule,
		...(policy.scope === "identity" ? { identities: policy.identities } : {}),
		...((policy.methods || policy.routes || policy.origins)
			? {
					match: {
						...(policy.methods
							? { methods: normalizeListField(policy.methods) }
							: {}),
						...(policy.routes
							? { routes: normalizeListField(policy.routes) }
							: {}),
						...(policy.origins
							? { origins: normalizeListField(policy.origins) }
							: {}),
					},
				}
			: {}),
	};
}

function createLegacyPolicies(config: RateLimitConfig): PolicyDraft[] {
	const policies: PolicyDraft[] = [];

	if (config.global) {
		policies.push({
			id: createPolicyId(),
			name: "Global bucket",
			scope: "global",
			enabled: true,
			mode: "enforce",
			rule: ruleToState(config.global),
			identities: [],
			methods: "",
			routes: "",
			origins: "",
		});
	}

	if (config.identity_limit) {
		policies.push({
			id: createPolicyId(),
			name: "Identity bucket",
			scope: "identity",
			enabled: true,
			mode: "enforce",
			rule: ruleToState(config.identity_limit),
			identities: config.identities ?? ["ip", "route"],
			methods: "",
			routes: "",
			origins: "",
		});
	}

	if (policies.length === 0 && config.enabled) {
		policies.push({
			id: createPolicyId(),
			name: "Global bucket",
			scope: "global",
			enabled: true,
			mode: "enforce",
			rule: { hits: "10", windowMs: "60000", penaltyMs: "" },
			identities: [],
			methods: "",
			routes: "",
			origins: "",
		});
	}

	return policies;
}

function createDraftPolicy(scope: "global" | "identity"): PolicyDraft {
	return {
		id: createPolicyId(),
		name: scope === "global" ? "Global bucket" : "Identity bucket",
		scope,
		enabled: true,
		mode: "enforce",
		rule:
			scope === "global"
				? { hits: "10", windowMs: "60000", penaltyMs: "" }
				: { hits: "5", windowMs: "60000", penaltyMs: "" },
		identities: scope === "identity" ? ["ip", "route"] : [],
		methods: "",
		routes: "",
		origins: "",
	};
}

function TonePill({
	label,
	tone,
}: {
	label: string;
	tone?: "default" | "success" | "warn";
}) {
	const toneClass =
		tone === "success"
			? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
			: tone === "warn"
				? "border-amber-400/20 bg-amber-500/10 text-amber-300"
				: "border-primary/20 bg-primary/10 text-primary";

	return (
		<span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
			{label}
		</span>
	);
}

interface RateLimitConfigModalProps {
	isOpen: boolean;
	onClose: () => void;
	functionId: number;
	onSaved?: () => void | Promise<void>;
}

function RateLimitConfigModal({
	isOpen,
	onClose,
	functionId,
	onSaved,
}: RateLimitConfigModalProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [enabled, setEnabled] = useState(false);
	const [policies, setPolicies] = useState<PolicyDraft[]>([]);
	const [activePolicyId, setActivePolicyId] = useState("");
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [sample, setSample] = useState<SampleState>({
		method: "GET",
		route: "default",
		origin: "",
	});
	const [rawJson, setRawJson] = useState("");

	const activePolicy = useMemo(
		() => policies.find((policy) => policy.id === activePolicyId) ?? null,
		[policies, activePolicyId],
	);

	const loadConfig = (config: RateLimitConfig) => {
		setEnabled(config.enabled);
		const nextPolicies =
			config.policies && config.policies.length > 0
				? config.policies.map(policyToDraft)
				: config.enabled
					? createLegacyPolicies(config)
					: [];
		setPolicies(nextPolicies);
		setActivePolicyId((current) =>
			nextPolicies.some((policy) => policy.id === current)
				? current
				: nextPolicies[0]?.id ?? "",
		);
		setRawJson(JSON.stringify(config, null, 2));
	};

	useEffect(() => {
		if (!isOpen || !functionId) {
			return;
		}

		let mounted = true;
		setIsLoading(true);

		void (async () => {
			try {
				const res = await getRateLimitConfig(functionId);
				if (!mounted) {
					return;
				}

				if (res.status === "OK") {
					loadConfig(res.data);
				} else {
					toast.error("Failed to load rate limits: " + res.message);
				}
			} catch (error: any) {
				if (mounted) {
					toast.error(
						"Failed to load rate limits: " +
							(error?.message ?? "Unknown error"),
					);
				}
			} finally {
				if (mounted) {
					setIsLoading(false);
				}
			}
		})();

		return () => {
			mounted = false;
		};
	}, [isOpen, functionId]);

	const validationError = useMemo(() => {
		if (!enabled) {
			return null;
		}

		if (policies.length === 0) {
			return "Add at least one policy or disable rate limiting.";
		}

		for (const policy of policies) {
			if (!policy.enabled) {
				continue;
			}

			if (!parseRuleState(policy.rule)) {
				return `Policy "${policy.name}" needs positive hits and window values.`;
			}

			if (policy.scope === "identity" && policy.identities.length === 0) {
				return `Policy "${policy.name}" needs at least one identity.`;
			}
		}

		return null;
	}, [enabled, policies]);

	const savePayload = useMemo(() => {
		if (!enabled) {
			return { enabled: false as const };
		}

		return {
			enabled: true as const,
			global: null,
			identities: [],
			identity_limit: null,
			policies: policies
				.map(draftToPolicy)
				.filter((policy): policy is RateLimitPolicy => Boolean(policy)),
		};
	}, [enabled, policies]);

	const preview = useMemo(() => {
		const matchedPolicies = policies.filter(
			(policy) => policy.enabled && matchesPolicy(policy, sample),
		);

		return {
			matches: matchedPolicies.length,
			blocks: matchedPolicies.filter((policy) => policy.mode === "enforce").length,
		};
	}, [policies, sample]);

	const activeCount = policies.filter((policy) => policy.enabled).length;
	const observeCount = policies.filter(
		(policy) => policy.enabled && policy.mode === "observe",
	).length;
	const identityCount = policies.filter(
		(policy) => policy.enabled && policy.scope === "identity",
	).length;

	const updatePolicy = (
		id: string,
		updater: (policy: PolicyDraft) => PolicyDraft,
	) => {
		setPolicies((current) =>
			current.map((policy) => (policy.id === id ? updater(policy) : policy)),
		);
	};

	const addPolicy = (scope: "global" | "identity") => {
		const next = createDraftPolicy(scope);
		setPolicies((current) => [...current, next]);
		setActivePolicyId(next.id);
	};

	const removePolicy = (id: string) => {
		setPolicies((current) => {
			const remaining = current.filter((policy) => policy.id !== id);
			setActivePolicyId((active) =>
				active === id ? remaining[0]?.id ?? "" : active,
			);
			return remaining;
		});
	};

	const movePolicy = (id: string, direction: -1 | 1) => {
		setPolicies((current) => {
			const index = current.findIndex((policy) => policy.id === id);
			const nextIndex = index + direction;
			if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
				return current;
			}

			const next = [...current];
			const [item] = next.splice(index, 1);
			next.splice(nextIndex, 0, item);
			return next;
		});
	};

	const duplicatePolicy = (policy: PolicyDraft) => {
		const next = {
			...policy,
			id: createPolicyId(),
			name: `${policy.name} copy`,
		};
		setPolicies((current) => [...current, next]);
		setActivePolicyId(next.id);
	};

	const handleToggleEnabled = (nextEnabled: boolean) => {
		setEnabled(nextEnabled);
		if (nextEnabled && policies.length === 0) {
			const nextPolicy = createDraftPolicy("global");
			setPolicies([nextPolicy]);
			setActivePolicyId(nextPolicy.id);
		}
	};

	const handleImportJson = () => {
		try {
			loadConfig(JSON.parse(rawJson) as RateLimitConfig);
			toast.success("Rate limit JSON loaded");
		} catch (error: any) {
			toast.error("Invalid JSON: " + (error?.message ?? "Unknown error"));
		}
	};

	const handleCopyJson = async () => {
		try {
			await navigator.clipboard.writeText(JSON.stringify(savePayload, null, 2));
			toast.success("Rate limit JSON copied");
		} catch {
			toast.error("Failed to copy JSON");
		}
	};

	const handleSave = async () => {
		if (!functionId || isSaving) {
			return;
		}
		if (validationError) {
			toast.error(validationError);
			return;
		}

		setIsSaving(true);
		try {
			const res = await updateRateLimitConfig(functionId, savePayload);
			if (res.status === "OK") {
				if (res.data) {
					loadConfig(res.data);
				}
				toast.success("Rate limit settings saved");
				await onSaved?.();
				onClose();
			} else {
				toast.error("Failed to save rate limits: " + res.message);
			}
		} catch (error: any) {
			toast.error(
				"Failed to save rate limits: " + (error?.message ?? "Unknown error"),
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Rate Limits"
			maxWidth="xl"
			isLoading={isLoading || isSaving}
		>
			<div className="space-y-6">
				<div className="flex flex-col gap-4 rounded-xl border border-primary/15 bg-background/20 p-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<TonePill
								label={enabled ? "Enabled" : "Disabled"}
								tone={enabled ? "success" : "default"}
							/>
							<TonePill label={`${activeCount} active`} />
							<TonePill label={`${observeCount} observe`} tone="warn" />
							<TonePill label={`${identityCount} identity`} />
						</div>
						<p className="text-sm text-text/75">
							Use ordered policies to rate-limit the function globally or by request
							identity. Earlier policies evaluate first.
						</p>
					</div>
					<label className="flex items-center gap-3 rounded-lg border border-primary/10 bg-background/30 px-3 py-2 text-sm text-text">
						<span>Rate limiting</span>
						<input
							type="checkbox"
							checked={enabled}
							onChange={(event) => handleToggleEnabled(event.target.checked)}
						/>
					</label>
				</div>

				<div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
					<div className="space-y-4">
						<div className="rounded-xl border border-primary/15 bg-background/20 p-4">
							<div className="flex items-center justify-between mb-3">
								<h3 className="text-sm font-semibold text-primary">Policy Order</h3>
								<span className="text-xs text-text/45">
									{policies.length} total
								</span>
							</div>

							<div className="space-y-2">
								{policies.length === 0 ? (
									<div className="rounded-lg border border-dashed border-primary/15 px-4 py-6 text-center text-sm text-text/55">
										No policies yet
									</div>
								) : (
									policies.map((policy, index) => (
										<button
											key={policy.id}
											type="button"
											onClick={() => setActivePolicyId(policy.id)}
											className={`w-full rounded-lg border px-3 py-3 text-left transition-all ${
												policy.id === activePolicyId
													? "border-primary/40 bg-primary/10"
													: "border-primary/10 bg-background/20 hover:border-primary/25"
											}`}
										>
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<p className="text-sm font-semibold text-text truncate">
														{index + 1}. {policy.name}
													</p>
													<p className="mt-1 text-xs text-text/55">
														{rateLimitSummary(policy)}
													</p>
												</div>
												<TonePill
													label={policy.enabled ? policy.mode : "Off"}
													tone={
														!policy.enabled
															? "default"
															: policy.mode === "observe"
																? "warn"
																: "success"
													}
												/>
											</div>
										</button>
									))
								)}
							</div>

							<div className="grid grid-cols-2 gap-2 mt-4">
								<button
									type="button"
									onClick={() => addPolicy("global")}
									className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15 transition-all"
								>
									+ Global
								</button>
								<button
									type="button"
									onClick={() => addPolicy("identity")}
									className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15 transition-all"
								>
									+ Identity
								</button>
							</div>
						</div>

						<div className="rounded-xl border border-primary/15 bg-background/20 p-4">
							<h3 className="text-sm font-semibold text-primary mb-3">
								Match Preview
							</h3>
							<div className="space-y-3">
								<select
									value={sample.method}
									onChange={(event) =>
										setSample((current) => ({
											...current,
											method: event.target.value,
										}))
									}
									className="w-full rounded-lg border border-primary/15 bg-background/40 px-3 py-2 text-sm text-white focus:border-primary/35 focus:outline-none"
								>
									<option value="GET">GET</option>
									<option value="POST">POST</option>
									<option value="PUT">PUT</option>
									<option value="PATCH">PATCH</option>
									<option value="DELETE">DELETE</option>
								</select>
								<input
									type="text"
									value={sample.route}
									onChange={(event) =>
										setSample((current) => ({
											...current,
											route: event.target.value,
										}))
									}
									placeholder="Route, e.g. default or images/*"
									className="w-full rounded-lg border border-primary/15 bg-background/40 px-3 py-2 text-sm text-white focus:border-primary/35 focus:outline-none"
								/>
								<input
									type="text"
									value={sample.origin}
									onChange={(event) =>
										setSample((current) => ({
											...current,
											origin: event.target.value,
										}))
									}
									placeholder="Origin, e.g. https://app.example.com"
									className="w-full rounded-lg border border-primary/15 bg-background/40 px-3 py-2 text-sm text-white focus:border-primary/35 focus:outline-none"
								/>
							</div>
							<div className="mt-4 rounded-lg border border-primary/10 bg-background/30 p-3">
								<p className="text-xs text-text/55">Matched policies</p>
								<p className="mt-1 text-sm font-semibold text-text">
									{preview.matches}
								</p>
								<p className="mt-2 text-xs text-text/55">Would block</p>
								<p className="mt-1 text-sm font-semibold text-text">
									{preview.blocks}
								</p>
							</div>
						</div>
					</div>

					<div className="space-y-4">
						{activePolicy ? (
							<div className="rounded-xl border border-primary/15 bg-background/20 p-5 space-y-5">
								<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
									<div className="min-w-0">
										<p className="text-xs uppercase tracking-[0.18em] text-text/45">
											Policy Editor
										</p>
										<h3 className="text-lg font-semibold text-primary mt-1">
											{activePolicy.name || "Policy"}
										</h3>
										<p className="text-sm text-text/60 mt-1">
											Edit scope, matching rules, and enforcement behavior.
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<button
											type="button"
											onClick={() => duplicatePolicy(activePolicy)}
											className="rounded-lg border border-primary/15 bg-background/30 px-3 py-2 text-sm text-text hover:border-primary/30"
										>
											Duplicate
										</button>
										<button
											type="button"
											onClick={() => movePolicy(activePolicy.id, -1)}
											className="rounded-lg border border-primary/15 bg-background/30 px-3 py-2 text-sm text-text hover:border-primary/30"
										>
											Move Up
										</button>
										<button
											type="button"
											onClick={() => movePolicy(activePolicy.id, 1)}
											className="rounded-lg border border-primary/15 bg-background/30 px-3 py-2 text-sm text-text hover:border-primary/30"
										>
											Move Down
										</button>
										<button
											type="button"
											onClick={() => removePolicy(activePolicy.id)}
											className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/15"
										>
											Remove
										</button>
									</div>
								</div>

								<div className="grid gap-4 md:grid-cols-2">
									<div>
										<label className="block text-xs uppercase tracking-wide text-text/45 mb-2">
											Name
										</label>
										<input
											type="text"
											value={activePolicy.name}
											onChange={(event) =>
												updatePolicy(activePolicy.id, (policy) => ({
													...policy,
													name: event.target.value,
												}))
											}
											className="w-full rounded-lg border border-primary/15 bg-background/40 px-3 py-2 text-sm text-white focus:border-primary/35 focus:outline-none"
										/>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="block text-xs uppercase tracking-wide text-text/45 mb-2">
												Scope
											</label>
											<select
												value={activePolicy.scope}
												onChange={(event) =>
													updatePolicy(activePolicy.id, (policy) => ({
														...policy,
														scope: event.target.value as "global" | "identity",
														identities:
															event.target.value === "identity"
																? policy.identities.length
																	? policy.identities
																	: ["ip", "route"]
																: [],
													}))
												}
												className="w-full rounded-lg border border-primary/15 bg-background/40 px-3 py-2 text-sm text-white focus:border-primary/35 focus:outline-none"
											>
												<option value="global">Global</option>
												<option value="identity">Identity</option>
											</select>
										</div>
										<div>
											<label className="block text-xs uppercase tracking-wide text-text/45 mb-2">
												Mode
											</label>
											<select
												value={activePolicy.mode}
												onChange={(event) =>
													updatePolicy(activePolicy.id, (policy) => ({
														...policy,
														mode: event.target.value as "enforce" | "observe",
													}))
												}
												className="w-full rounded-lg border border-primary/15 bg-background/40 px-3 py-2 text-sm text-white focus:border-primary/35 focus:outline-none"
											>
												<option value="enforce">Enforce</option>
												<option value="observe">Observe</option>
											</select>
										</div>
									</div>
								</div>

								<div className="grid gap-4 md:grid-cols-3">
									<div>
										<label className="block text-xs uppercase tracking-wide text-text/45 mb-2">
											Hits
										</label>
										<input
											type="text"
											value={activePolicy.rule.hits}
											onChange={(event) =>
												updatePolicy(activePolicy.id, (policy) => ({
													...policy,
													rule: { ...policy.rule, hits: event.target.value },
												}))
											}
											className="w-full rounded-lg border border-primary/15 bg-background/40 px-3 py-2 text-sm text-white focus:border-primary/35 focus:outline-none"
										/>
									</div>
									<div>
										<label className="block text-xs uppercase tracking-wide text-text/45 mb-2">
											Window (ms)
										</label>
										<input
											type="text"
											value={activePolicy.rule.windowMs}
											onChange={(event) =>
												updatePolicy(activePolicy.id, (policy) => ({
													...policy,
													rule: { ...policy.rule, windowMs: event.target.value },
												}))
											}
											className="w-full rounded-lg border border-primary/15 bg-background/40 px-3 py-2 text-sm text-white focus:border-primary/35 focus:outline-none"
										/>
									</div>
									<div>
										<label className="block text-xs uppercase tracking-wide text-text/45 mb-2">
											Penalty (ms)
										</label>
										<input
											type="text"
											value={activePolicy.rule.penaltyMs}
											onChange={(event) =>
												updatePolicy(activePolicy.id, (policy) => ({
													...policy,
													rule: { ...policy.rule, penaltyMs: event.target.value },
												}))
											}
											placeholder="Optional"
											className="w-full rounded-lg border border-primary/15 bg-background/40 px-3 py-2 text-sm text-white focus:border-primary/35 focus:outline-none"
										/>
									</div>
								</div>

								<div className="rounded-lg border border-primary/10 bg-background/25 p-4">
									<div className="flex items-center justify-between gap-3">
										<div>
											<h4 className="text-sm font-semibold text-text">
												Policy enabled
											</h4>
											<p className="text-xs text-text/55 mt-1">
												Disabled policies stay saved but do not evaluate.
											</p>
										</div>
										<input
											type="checkbox"
											checked={activePolicy.enabled}
											onChange={(event) =>
												updatePolicy(activePolicy.id, (policy) => ({
													...policy,
													enabled: event.target.checked,
												}))
											}
										/>
									</div>
								</div>

								{activePolicy.scope === "identity" && (
									<div>
										<label className="block text-xs uppercase tracking-wide text-text/45 mb-2">
											Identity Keys
										</label>
										<div className="grid gap-2 md:grid-cols-2">
											{IDENTITY_OPTIONS.map((option) => {
												const selected = activePolicy.identities.includes(option.value);
												return (
													<label
														key={option.value}
														className={`rounded-lg border px-3 py-3 cursor-pointer transition-all ${
															selected
																? "border-primary/35 bg-primary/10"
																: "border-primary/10 bg-background/25 hover:border-primary/25"
														}`}
													>
														<div className="flex items-start gap-3">
															<input
																type="checkbox"
																checked={selected}
																onChange={(event) =>
																	updatePolicy(activePolicy.id, (policy) => ({
																		...policy,
																		identities: event.target.checked
																			? [...policy.identities, option.value]
																			: policy.identities.filter(
																					(value) => value !== option.value,
																				),
																	}))
																}
															/>
															<div>
																<p className="text-sm font-medium text-text">
																	{option.label}
																</p>
																<p className="text-xs text-text/55 mt-1">
																	{option.description}
																</p>
															</div>
														</div>
													</label>
												);
											})}
										</div>
									</div>
								)}

								<div className="grid gap-4 md:grid-cols-3">
									<div>
										<label className="block text-xs uppercase tracking-wide text-text/45 mb-2">
											Methods
										</label>
										<input
											type="text"
											value={activePolicy.methods}
											onChange={(event) =>
												updatePolicy(activePolicy.id, (policy) => ({
													...policy,
													methods: event.target.value,
												}))
											}
											placeholder="GET, POST"
											className="w-full rounded-lg border border-primary/15 bg-background/40 px-3 py-2 text-sm text-white focus:border-primary/35 focus:outline-none"
										/>
									</div>
									<div>
										<label className="block text-xs uppercase tracking-wide text-text/45 mb-2">
											Routes
										</label>
										<input
											type="text"
											value={activePolicy.routes}
											onChange={(event) =>
												updatePolicy(activePolicy.id, (policy) => ({
													...policy,
													routes: event.target.value,
												}))
											}
											placeholder="default, images/*"
											className="w-full rounded-lg border border-primary/15 bg-background/40 px-3 py-2 text-sm text-white focus:border-primary/35 focus:outline-none"
										/>
									</div>
									<div>
										<label className="block text-xs uppercase tracking-wide text-text/45 mb-2">
											Origins
										</label>
										<input
											type="text"
											value={activePolicy.origins}
											onChange={(event) =>
												updatePolicy(activePolicy.id, (policy) => ({
													...policy,
													origins: event.target.value,
												}))
											}
											placeholder="https://app.example.com"
											className="w-full rounded-lg border border-primary/15 bg-background/40 px-3 py-2 text-sm text-white focus:border-primary/35 focus:outline-none"
										/>
									</div>
								</div>
							</div>
						) : (
							<div className="rounded-xl border border-dashed border-primary/15 bg-background/20 px-6 py-10 text-center text-sm text-text/55">
								Select a policy to edit it.
							</div>
						)}

						<div className="rounded-xl border border-primary/15 bg-background/20 p-4">
							<button
								type="button"
								onClick={() => setShowAdvanced((current) => !current)}
								className="flex w-full items-center justify-between text-left"
							>
								<div>
									<h3 className="text-sm font-semibold text-primary">
										Advanced JSON
									</h3>
									<p className="text-xs text-text/55 mt-1">
										Import or export the raw rate-limit config.
									</p>
								</div>
								<span className="text-primary text-sm">
									{showAdvanced ? "Hide" : "Show"}
								</span>
							</button>

							{showAdvanced && (
								<div className="mt-4 space-y-3">
									<textarea
										value={rawJson}
										onChange={(event) => setRawJson(event.target.value)}
										className="min-h-[220px] w-full rounded-lg border border-primary/15 bg-background/40 px-3 py-3 text-xs text-white focus:border-primary/35 focus:outline-none font-mono"
									/>
									<div className="flex flex-wrap gap-2">
										<button
											type="button"
											onClick={handleImportJson}
											className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15"
										>
											Load JSON
										</button>
										<button
											type="button"
											onClick={handleCopyJson}
											className="rounded-lg border border-primary/15 bg-background/30 px-3 py-2 text-sm text-text hover:border-primary/30"
										>
											Copy JSON
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>

				{validationError && (
					<div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
						{validationError}
					</div>
				)}

				<div className="flex items-center justify-end gap-3 pt-2 border-t border-primary/10">
					<button
						type="button"
						onClick={onClose}
						disabled={isSaving}
						className={cancelBtnClass}
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={isSaving}
						className={primaryBtnClass}
					>
						Save Rate Limits
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default RateLimitConfigModal;
