import { useEffect, useState } from "react";
import {
  listAccessTokens,
  generateAccessToken,
  revokeAccessToken,
} from "../services/backend.accesstokens";
import { Token } from "../types/Prisma";
import { TokenCard } from "../components/cards/TokenCard";
import { ActionButton } from "../components/cards/LogCard";

export default function AccessTokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate form state
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [expiresIn, setExpiresIn] = useState<number | "">("");
  const [neverExpire, setNeverExpire] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  // Revoke state
  const [revokeLoading, setRevokeLoading] = useState<number | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Find if SHSF CLI token exists
  const shsfCliToken = tokens.find((t) => t.name === "SHSF CLI");

  // Handler for preset SHSF Cli token creation
  const [cliGenLoading, setCliGenLoading] = useState(false);
  const [cliGenError, setCliGenError] = useState<string | null>(null);

  const fetchTokens = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAccessTokens();
      setTokens(data || []);
    } catch (e) {
      setError("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenLoading(true);
    setGenError(null);
    setGeneratedToken(null);
    try {
      const res = await generateAccessToken(
        name,
        purpose || undefined,
        neverExpire ? null : expiresIn ? Number(expiresIn) : undefined
      );
      if (res.status === "OK" && res.token) {
        setGeneratedToken(res.token);
        setName("");
        setPurpose("");
        setExpiresIn("");
        setNeverExpire(false);
        fetchTokens();
      } else {
        setGenError(res.message || "Failed to generate token");
      }
    } catch (e) {
      setGenError("Failed to generate token");
    } finally {
      setGenLoading(false);
    }
  };

  const handleRevoke = async (id: number) => {
    setRevokeLoading(id);
    setRevokeError(null);
    try {
      await revokeAccessToken(id);
      fetchTokens();
    } catch (e) {
      setRevokeError("Failed to revoke token. Please try again.");
    } finally {
      setRevokeLoading(null);
    }
  };

  const handleCreateCliToken = async () => {
    setCliGenLoading(true);
    setCliGenError(null);
    setGeneratedToken(null);
    try {
      const res = await generateAccessToken(
        "SHSF Cli",
        "Preset token for SHSF CLI tool",
        null // never expires
      );
      if (res.status === "OK" && res.token) {
        setGeneratedToken(res.token);
        fetchTokens();
        setName("SHSF Cli");
        setPurpose("Preset token for SHSF CLI tool");
        setExpiresIn("");
        setNeverExpire(false);
      } else {
        setCliGenError(res.message || "Failed to generate SHSF Cli token");
      }
    } catch (e) {
      setCliGenError("Failed to generate SHSF Cli token");
    } finally {
      setCliGenLoading(false);
    }
  };

  // Helper to check if the last generated token is for SHSF CLI
  const isGeneratedCliToken =
    generatedToken &&
    (name.trim().toLowerCase() === "shsf cli" ||
      (shsfCliToken && shsfCliToken.tokenMasked && generatedToken));

  function renderGeneratedToken() {
    if (!generatedToken) return null;
    // Check if the SHSF CLI token was just generated
    const isCli = isGeneratedCliToken;

    return (
      <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-green-300 font-mono break-all shadow">
        <div className="mb-2 font-semibold text-green-200">Your new token:</div>
        <div className="text-lg">{generatedToken}</div>
        <div className="text-xs text-green-200 mt-2">
          Please copy and store this token securely. You won't be able to see it
          again.
        </div>
        {isCli && (
          <>
            <div className="mb-1 font-semibold text-primary/80">
              Set this token in your SHSF CLI:
            </div>
            <div className="mt-4 bg-background/40 border border-primary/20 rounded p-3 text-sm text-primary font-mono">
              <div className="select-all">
                {/* Dummy CLI command */}
                shsf-cli --mode set-key --key {generatedToken}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#181e2a] via-[#191726] to-[#1a1a22]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/70 via-purple-900/60 to-indigo-900/70 border-b border-primary/20 py-12 mb-10 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 flex flex-col items-center text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500 flex items-center justify-center shadow-lg border-4 border-background/40 text-4xl">
              <span role="img" aria-label="key">
                🔑
              </span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-primary mb-2 drop-shadow">
            Access Tokens
          </h1>
          <p className="text-lg text-text/70 max-w-xl mx-auto">
            Manage your API access tokens. Generate, view, and revoke tokens for
            programmatic access to your account.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-16">
        {/* Generate Token Card */}
        <div className="mb-10">
          <form
            onSubmit={handleGenerate}
            className="bg-gradient-to-br from-blue-900/30 via-purple-900/30 to-indigo-900/30 border border-primary/30 rounded-2xl p-8 flex flex-col gap-5 shadow-lg"
          >
            <h2 className="text-2xl font-bold text-primary mb-2 flex items-center gap-2">
              <span className="text-xl">➕</span> Generate New Token
            </h2>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-text/60 text-sm mb-1">
                  Token Name
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={128}
                  placeholder="e.g. My CLI Tool"
                  className="w-full px-4 py-2 border border-primary/20 rounded-lg bg-background/80 text-text focus:border-primary/40 focus:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={genLoading}
                />
              </div>
              <div className="flex-1">
                <label className="block text-text/60 text-sm mb-1">
                  Purpose (optional)
                </label>
                <input
                  type="text"
                  maxLength={512}
                  placeholder="Describe usage"
                  className="w-full px-4 py-2 border border-primary/20 rounded-lg bg-background/80 text-text focus:border-primary/40 focus:outline-none"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  disabled={genLoading}
                />
              </div>
              <div className="w-40">
                {!neverExpire && (
                  <>
                    <label className="block text-text/60 text-sm mb-1">
                      Expires in (days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      placeholder="30"
                      className="w-full px-4 py-2 border border-primary/20 rounded-lg bg-background/80 text-text focus:border-primary/40 focus:outline-none"
                      value={expiresIn}
                      onChange={(e) =>
                        setExpiresIn(
                          e.target.value ? Number(e.target.value) : ""
                        )
                      }
                      disabled={genLoading || neverExpire}
                    />
                  </>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="never-expire"
                    checked={neverExpire}
                    onChange={() => setNeverExpire((v) => !v)}
                    disabled={genLoading}
                  />
                  <label
                    htmlFor="never-expire"
                    className="text-xs text-text/60 select-none cursor-pointer"
                  >
                    Never expire
                  </label>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <ActionButton
                icon="➕"
                label={genLoading ? "Generating..." : "Generate Token"}
                variant="primary"
                onClick={() => {}} // No-op, form submit will handle
                disabled={genLoading}
                // Prevent double submit: only allow submit via form
                // The button type is handled by the form, so this is just for style
              />
              {shsfCliToken == null && (
                <>
                  <ActionButton
                    icon="⚡"
                    label={
                      cliGenLoading
                        ? "Creating SHSF CLI Token..."
                        : "Create SHSF CLI Token"
                    }
                    variant="secondary"
                    onClick={handleCreateCliToken}
                    disabled={cliGenLoading}
                  />
                  {cliGenError && (
                    <div className="text-red-400 text-sm mt-2">
                      {cliGenError}
                    </div>
                  )}
                </>
              )}
            </div>
            {genError && (
              <div className="text-red-400 text-sm mt-2">{genError}</div>
            )}
            {renderGeneratedToken()}
          </form>
        </div>

        {/* Tokens List */}
        <div>
          <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
            <span className="text-lg">🗝️</span> Your Tokens
          </h2>
          {loading ? (
            <div className="text-text/60">Loading...</div>
          ) : error ? (
            <div className="text-red-400">{error}</div>
          ) : (
            <>
              {revokeError && (
                <div className="text-red-400 mb-2">{revokeError}</div>
              )}
              {tokens.length === 0 ? (
                <div className="text-text/60">No tokens found.</div>
              ) : (
                <div>
                  {tokens.map((t) => (
                    <TokenCard
                      key={t.id}
                      token={t}
                      onRevoke={handleRevoke}
                      revokeLoading={revokeLoading === t.id}
                      refreshTokens={fetchTokens}
                      disableEdit={t.name === "SHSF Cli"}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
