import { useState } from "react";
import { Token } from "../../types/Prisma";
import { updateAccessToken } from "../../services/backend.accesstokens";
import { EditTokenModal } from "../modals/RenameAccessToken";
import { Icon } from "../ui/Icon";

export function TokenCard({
	token,
	onRevoke,
	revokeLoading,
	onUpdate,
	refreshTokens,
	disableEdit,
}: {
	token: Token;
	onRevoke: (id: number) => void;
	revokeLoading: boolean;
	onUpdate?: (updated: Token) => void;
	refreshTokens: () => void;
	disableEdit?: boolean;
}) {
	const [editOpen, setEditOpen] = useState(false);
	const [editLoading, setEditLoading] = useState(false);
	const [editError, setEditError] = useState<string | null>(null);

	const handleEdit = async (name: string, purpose: string) => {
		setEditLoading(true);
		setEditError(null);
		try {
			const res = await updateAccessToken(token.id, name, purpose);
			if (res.status === "OK") {
				setEditOpen(false);
				if (onUpdate) onUpdate(res);
				if (refreshTokens) refreshTokens();
			} else {
				setEditError(res.message || "Failed to update token");
			}
		} catch {
			setEditError("Failed to update token");
		}
		setEditLoading(false);
	};

	return (
		<>
			<div className={`bg-surface border border-white/[0.07] rounded-xl p-4 ${token.expired ? "opacity-60" : ""}`}>
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1 min-w-0 space-y-1.5">
						<div className="flex items-center gap-2 flex-wrap">
							<span className="text-sm font-semibold text-text">{token.name}</span>
							{token.expired && (
								<span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs">Expired</span>
							)}
						</div>
						{token.purpose && <p className="text-xs text-muted">{token.purpose}</p>}
						<code className="inline-block px-2 py-1 bg-background border border-white/[0.07] rounded text-xs font-mono text-primary/80 select-all">
							{token.tokenMasked}
						</code>
						<div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
							<span>Created {new Date(token.createdAt).toLocaleDateString()}</span>
							{token.expiresAt && (
								<span>Expires {new Date(token.expiresAt).toLocaleDateString()}</span>
							)}
						</div>
					</div>
					<div className="flex gap-1.5 shrink-0">
						<button
							className="p-1.5 text-muted hover:text-text hover:bg-white/[0.06] rounded transition-colors disabled:opacity-40"
							onClick={() => setEditOpen(true)}
							disabled={revokeLoading || disableEdit}
							title="Edit"
						>
							<Icon name="pencil" className="w-3.5 h-3.5" />
						</button>
						<button
							className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-40"
							onClick={() => onRevoke(token.id)}
							disabled={revokeLoading}
							title={revokeLoading ? "Revoking…" : "Revoke"}
						>
							<Icon name="trash" className="w-3.5 h-3.5" />
						</button>
					</div>
				</div>
			</div>
			<EditTokenModal
				isOpen={editOpen}
				onClose={() => { setEditOpen(false); setEditError(null); }}
				onSave={handleEdit}
				initialName={token.name}
				initialPurpose={token.purpose ?? ""}
				loading={editLoading}
				error={editError}
			/>
		</>
	);
}
