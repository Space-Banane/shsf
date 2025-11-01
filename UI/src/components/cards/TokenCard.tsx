import { useState } from "react";
import { Token } from "../../types/Prisma";
import { updateAccessToken } from "../../services/backend.accesstokens";
import { EditTokenModal } from "../modals/RenameAccessToken";

// --- Main TokenCard ---
export function TokenCard({
  token,
  onRevoke,
  revokeLoading,
  onUpdate,
  refreshTokens,
  disableEdit
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
    } catch (e) {
      setEditError("Failed to update token");
    }
    setEditLoading(false);
  };

  return (
    <>
      <div
        className={[
          "relative flex flex-col md:flex-row md:items-center gap-4 md:gap-6 mb-4",
          "bg-gradient-to-br from-gray-900/50 to-gray-800/50",
          "border border-primary/20 rounded-lg p-4",
          "text-white",
          token.expired ? "opacity-60 grayscale" : "",
        ].join(" ")}
      >
        {/* Decorative solid bar removed */}
        <div className="flex-1">
          {/* Title section */}
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-primary">{token.name}</h3>
              {token.expired && (
                <span className="ml-2 px-2 py-0.5 bg-red-900 text-red-300 rounded text-xs border border-red-500/20">
                  Expired
                </span>
              )}
            </div>
            {token.purpose && (
              <div className="mt-1 text-sm text-gray-300">{token.purpose}</div>
            )}
            <div className="mt-2">
              <span className="font-mono text-base px-3 py-1 rounded bg-gray-900 border border-gray-700 shadow-inner select-all">
                {token.tokenMasked}
              </span>
            </div>
          </div>
          {/* Professional metadata row */}
          <div className="flex flex-wrap gap-x-8 gap-y-1 mt-2 text-sm text-gray-300 font-normal">
            <div>
              <span className="text-gray-400">Created:</span>{" "}
              <span className="font-mono text-gray-200">
                {new Date(token.createdAt).toLocaleString()}
              </span>
            </div>
            {token.expiresAt && (
              <div>
                <span className="text-gray-400">Expires:</span>{" "}
                <span className="font-mono text-gray-200">
                  {new Date(token.expiresAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center mt-2 md:mt-0 gap-2">
          <button
            className={[
              "px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
              "bg-background/50 border border-primary/20 text-primary hover:border-primary/40 hover:bg-primary/5",
            ].join(" ")}
            onClick={() => setEditOpen(true)}
            disabled={revokeLoading || disableEdit}
          >
            Edit
          </button>
          <button
            className={[
              "px-4 py-2 rounded-lg font-semibold transition shadow border",
              "bg-red-800/80 text-white border-red-500/30",
              "hover:bg-red-700/80",
              "disabled:opacity-50",
            ].join(" ")}
            onClick={() => onRevoke(token.id)}
            disabled={revokeLoading}
          >
            {revokeLoading ? "Revoking..." : "Revoke"}
          </button>
        </div>
      </div>
      <EditTokenModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditError(null);
        }}
        onSave={handleEdit}
        initialName={token.name}
        initialPurpose={token.purpose ?? ""}
        loading={editLoading}
        error={editError}
      />
    </>
  );
}
