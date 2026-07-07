import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { authenticateGuestUser } from "../services/backend.guest";
import { BASE_URL } from "..";

export default function GuestAccessPage() {
	const [searchParams] = useSearchParams();
	const nsp = searchParams.get("nsp");
	const func = searchParams.get("func");

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		try {
			const res = await authenticateGuestUser({
				email,
				password,
				namespaceId: Number(nsp),
				functionExecId: String(func),
			});
			if (res.status === "OK") {
				window.location.href = `${BASE_URL}/api/exec/${nsp}/${func}`;
			} else {
				setError(res.message || "Authentication failed");
			}
		} catch {
			setError("Authentication failed");
		} finally {
			setLoading(false);
		}
	};

	if (!nsp || !func) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="bg-surface border border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-400">
					Missing function parameters.
				</div>
			</div>
		);
	}

	const inputClass = "w-full px-3 py-2 bg-background border border-white/[0.07] rounded-lg text-text text-sm focus:border-primary/50 focus:outline-none placeholder:text-muted/60";

	return (
		<div className="min-h-screen flex items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm bg-surface border border-white/[0.07] rounded-xl p-6 shadow-2xl">
				<div className="mb-5">
					<h1 className="text-lg font-semibold text-text">Guest Access</h1>
					<p className="text-sm text-muted mt-0.5">Enter your credentials to access this function.</p>
				</div>
				<form onSubmit={handleSubmit} className="space-y-3">
					<div>
						<label className="block text-xs font-medium text-muted mb-1.5">Email</label>
						<input
							type="email"
							required
							className={inputClass}
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={loading}
							autoFocus
						/>
					</div>
					<div>
						<label className="block text-xs font-medium text-muted mb-1.5">Password</label>
						<input
							type="password"
							required
							className={inputClass}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={loading}
						/>
					</div>
					{error && (
						<p className="text-sm text-red-400">{error}</p>
					)}
					<button
						type="submit"
						className="w-full py-2 bg-primary text-background text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
						disabled={loading}
					>
						{loading ? "Authenticating…" : "Sign In"}
					</button>
				</form>
			</div>
		</div>
	);
}
