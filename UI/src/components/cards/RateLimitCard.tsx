import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "../buttons/ActionButton";
import RateLimitConfigModal from "../modals/functions/RateLimitConfigModal";
import { getRateLimitConfig, RateLimitConfig } from "../../services/backend.function.ratelimit";

function getPolicyCount(config: RateLimitConfig | null) {
	if (!config?.enabled) {
		return 0;
	}

	if (config.policies?.length) {
		return config.policies.filter((policy) => policy.enabled !== false).length;
	}

	let count = 0;
	if (config.global) {
		count += 1;
	}
	if (config.identity_limit && config.identities?.length) {
		count += 1;
	}
	return count;
}

function getObserveCount(config: RateLimitConfig | null) {
	if (!config?.enabled || !config.policies?.length) {
		return 0;
	}

	return config.policies.filter(
		(policy) => policy.enabled !== false && policy.mode === "observe",
	).length;
}

function getIdentityCount(config: RateLimitConfig | null) {
	if (!config?.enabled) {
		return 0;
	}

	if (config.policies?.length) {
		return config.policies.filter(
			(policy) => policy.enabled !== false && policy.scope === "identity",
		).length;
	}

	return config.identity_limit && config.identities?.length ? 1 : 0;
}

async function loadRateLimitSummary(
	functionId: number,
	disabled: boolean,
	setIsLoading: (value: boolean) => void,
	setConfig: (value: RateLimitConfig | null) => void,
) {
	if (!functionId || disabled) {
		return;
	}

	setIsLoading(true);
	try {
		const res = await getRateLimitConfig(functionId);
		if (res.status === "OK") {
			setConfig(res.data);
		}
	} finally {
		setIsLoading(false);
	}
}

export function RateLimitCard({
	functionId,
	disabled = false,
	disabledReason,
}: {
	functionId: number;
	disabled?: boolean;
	disabledReason?: string;
}) {
	const [isLoading, setIsLoading] = useState(false);
	const [showModal, setShowModal] = useState(false);
	const [config, setConfig] = useState<RateLimitConfig | null>(null);

	useEffect(() => {
		void loadRateLimitSummary(
			functionId,
			disabled,
			setIsLoading,
			setConfig,
		);
	}, [functionId, disabled]);

	const policyCount = useMemo(() => getPolicyCount(config), [config]);
	const observeCount = useMemo(() => getObserveCount(config), [config]);
	const identityCount = useMemo(() => getIdentityCount(config), [config]);

	return (
		<>
			<div
				className={`bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-lg p-4 relative ${
					disabled ? "opacity-50 pointer-events-none select-none grayscale" : ""
				}`}
			>
				<div className="flex items-start justify-between gap-3 mb-3">
					<div>
						<h2 className="text-lg font-bold text-primary flex items-center gap-2">
							<span>🚦</span>
							Rate Limits
						</h2>
						<p className="text-text/60 text-xs mt-1">
							Configure ordered policies, blocking behavior, and request matching.
						</p>
					</div>
					<div
						className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
							config?.enabled
								? "bg-emerald-500/10 text-emerald-300 border-emerald-400/20"
								: "bg-gray-800/60 text-gray-400 border-gray-700/60"
						}`}
					>
						{isLoading ? "Loading" : config?.enabled ? "Enabled" : "Disabled"}
					</div>
				</div>

				<div className="grid grid-cols-3 gap-2 mb-4">
					<div className="rounded-lg border border-primary/10 bg-background/30 p-2">
						<p className="text-[11px] uppercase tracking-wide text-text/45">
							Policies
						</p>
						<p className="text-sm font-semibold text-text mt-1">{policyCount}</p>
					</div>
					<div className="rounded-lg border border-primary/10 bg-background/30 p-2">
						<p className="text-[11px] uppercase tracking-wide text-text/45">
							Observe
						</p>
						<p className="text-sm font-semibold text-text mt-1">{observeCount}</p>
					</div>
					<div className="rounded-lg border border-primary/10 bg-background/30 p-2">
						<p className="text-[11px] uppercase tracking-wide text-text/45">
							Identity
						</p>
						<p className="text-sm font-semibold text-text mt-1">{identityCount}</p>
					</div>
				</div>

				<div className="space-y-3">
					<div className="rounded-lg border border-primary/10 bg-background/20 px-3 py-2">
						<p className="text-xs text-text/70">
							{config?.enabled
								? "Open the modal to edit policy order, per-route matching, and observe mode."
								: "Rate limiting is currently off. Open the modal to enable and configure it."}
						</p>
					</div>
					<ActionButton
						icon="⚙️"
						label="Configure"
						variant="secondary"
						onClick={() => setShowModal(true)}
						disabled={disabled || !functionId}
					/>
				</div>

				{disabled && disabledReason && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-10 pointer-events-none">
						<span className="text-xs text-white text-center px-2">
							{disabledReason}
						</span>
					</div>
				)}
			</div>

			<RateLimitConfigModal
				isOpen={showModal}
				onClose={() => setShowModal(false)}
				functionId={functionId}
				onSaved={() =>
					loadRateLimitSummary(functionId, disabled, setIsLoading, setConfig)
				}
			/>
		</>
	);
}
