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
				// Cookie is set by backend, redirect to exec endpoint
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

	// If params missing, show error
	if (!nsp || !func) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="bg-red-900/20 border border-red-500/30 rounded-lg p-8 text-red-300">
					Missing function parameters.
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#181e2a] via-[#191726] to-[#1a1a22]">
			<div className="max-w-md w-full bg-gradient-to-br from-blue-900/30 via-purple-900/30 to-indigo-900/30 border border-primary/30 rounded-2xl p-8 shadow-lg">
				<div className="flex flex-col items-center mb-6">
					<div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500 flex items-center justify-center shadow-lg border-4 border-background/40 text-3xl mb-2">
						<span role="img" aria-label="guest">
							👤
						</span>
					</div>
					<h1 className="text-2xl font-bold text-primary mb-1">Guest Access</h1>
					<p className="text-text/70 text-center text-sm">
						Enter your guest credentials to access this function.
					</p>
				</div>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div>
						<label className="block text-text/60 text-sm mb-1">Email</label>
						<input
							type="email"
							required
							className="w-full px-4 py-2 border border-primary/20 rounded-lg bg-background/80 text-text focus:border-primary/40 focus:outline-none"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={loading}
							autoFocus
						/>
					</div>
					<div>
						<label className="block text-text/60 text-sm mb-1">Password</label>
						<input
							type="password"
							required
							className="w-full px-4 py-2 border border-primary/20 rounded-lg bg-background/80 text-text focus:border-primary/40 focus:outline-none"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={loading}
						/>
					</div>
					<button
						type="submit"
						className="w-full py-2 mt-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-60"
						disabled={loading}
					>
						{loading ? "Authenticating..." : "Login"}
					</button>
					{error && (
						<div className="text-red-400 text-sm mt-2 text-center">{error}</div>
					)}
				</form>
			</div>
		</div>
	);
}
