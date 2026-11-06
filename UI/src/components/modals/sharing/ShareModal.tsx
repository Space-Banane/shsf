import { useCallback, useEffect, useState } from "react";
import Modal, { cancelBtnClass, inputClass, labelClass, ModalError, ModalFooter, primaryBtnClass, selectClass } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import type { SharePermission } from "../../../types/Prisma";
import {
	addShare,
	listShareableGroups,
	listShares,
	PERMISSIONS,
	revokeShare,
	type GroupOption,
	type Share,
	type ShareResourceType,
} from "../../../services/backend.sharing";

interface ShareModalProps {
	isOpen: boolean;
	onClose: () => void;
	type: ShareResourceType;
	resourceId: number;
	resourceName: string;
}

const INHERIT_NOTE: Record<ShareResourceType, string> = {
	namespace: "Grants apply to every function in this namespace, including ones added later. Storage is shared separately.",
	function: "Shared functions still run as you: your storage, account environment, and callF scope.",
	storage: "Recipients reach this storage through the UI and API, not from their own function code.",
};

function ShareModal({ isOpen, onClose, type, resourceId, resourceName }: ShareModalProps) {
	const [shares, setShares] = useState<Share[] | null>(null);
	const [groups, setGroups] = useState<GroupOption[]>([]);
	const [target, setTarget] = useState("");
	const [permission, setPermission] = useState<SharePermission>("view");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		const [shareRes, groupRes] = await Promise.all([listShares(type, resourceId), listShareableGroups()]);
		if (shareRes.status === "OK") setShares(shareRes.data);
		else {
			setShares([]);
			setError(shareRes.message);
		}
		if (groupRes.status === "OK") setGroups(groupRes.data);
	}, [type, resourceId]);

	useEffect(() => {
		if (!isOpen) return;
		setShares(null);
		setError("");
		setTarget("");
		setPermission("view");
		void load();
	}, [isOpen, load]);

	const handleSubmit = async () => {
		const value = target.trim();
		if (!value) {
			setError("Enter an email or pick a group");
			return;
		}
		setIsLoading(true);
		setError("");
		const recipient = value.startsWith("group:") ? { groupId: Number(value.slice(6)) } : { email: value };
		const res = await addShare(type, resourceId, { ...recipient, permission });
		setIsLoading(false);
		if (res.status !== "OK") {
			setError(res.message);
			return;
		}
		setTarget("");
		void load();
	};

	useShiftEnterSubmit(() => void handleSubmit(), isOpen && !isLoading);

	const handleRevoke = async (shareId: number) => {
		setIsLoading(true);
		const res = await revokeShare(type, resourceId, shareId);
		setIsLoading(false);
		if (res.status !== "OK") setError(res.message);
		void load();
	};

	return (
		<Modal isOpen={isOpen} onClose={() => !isLoading && onClose()} title={`Share "${resourceName}"`} isLoading={isLoading}>
			<div className="space-y-4">
				<ModalError message={error} />
				<p className="text-xs text-muted">{INHERIT_NOTE[type]}</p>
				<div className="flex gap-2 items-end">
					<div className="flex-1">
						<label className={labelClass} htmlFor="share-target">User email or group</label>
						<input
							id="share-target"
							list="share-groups"
							className={inputClass}
							placeholder="user@example.com"
							value={target}
							onChange={(e) => setTarget(e.target.value)}
							disabled={isLoading}
							autoFocus
						/>
						<datalist id="share-groups">
							{groups.map((g) => (
								<option key={g.id} value={`group:${g.id}`}>{g.name}</option>
							))}
						</datalist>
					</div>
					<div>
						<label className={labelClass} htmlFor="share-permission">Permission</label>
						<select
							id="share-permission"
							className={selectClass}
							value={permission}
							onChange={(e) => setPermission(e.target.value as SharePermission)}
							disabled={isLoading}
						>
							{PERMISSIONS[type].map((p) => (
								<option key={p} value={p}>{p}</option>
							))}
						</select>
					</div>
				</div>

				<div>
					<p className={labelClass}>Shared with</p>
					{shares === null ? (
						<p className="text-sm text-muted">Loading…</p>
					) : shares.length === 0 ? (
						<p className="text-sm text-muted">Not shared with anyone yet.</p>
					) : (
						<ul className="divide-y divide-border rounded-md border border-border">
							{shares.map((s) => (
								<li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
									<span>
										{s.group ? `Group: ${s.group.name}` : `${s.user?.displayName} (${s.user?.email})`}
										<span className="ml-2 text-xs text-muted">{s.permission}</span>
									</span>
									<button
										className="text-xs text-red-400 hover:underline disabled:opacity-50"
										onClick={() => void handleRevoke(s.id)}
										disabled={isLoading}
									>
										Revoke
									</button>
								</li>
							))}
						</ul>
					)}
				</div>

				<ModalFooter>
					<button onClick={onClose} className={cancelBtnClass} disabled={isLoading}>Close</button>
					<button onClick={() => void handleSubmit()} className={primaryBtnClass} disabled={isLoading}>Share</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default ShareModal;
