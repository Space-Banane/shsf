import { useState, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../../App";
import { BASE_URL } from "../..";

type LoginLocationState = {
	from?: {
		pathname?: string;
		search?: string;
		hash?: string;
	};
	message?: string;
};

const getRedirectPath = (state: LoginLocationState | null | undefined) => {
	const pathname = state?.from?.pathname;
	if (!pathname || !pathname.startsWith("/") || pathname === "/login") return "/";
	return `${pathname}${state.from?.search ?? ""}${state.from?.hash ?? ""}`;
};

function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();
	const location = useLocation();
	const { user, refreshUser } = useContext(UserContext);
	const locationState = location.state as LoginLocationState | null;
	const redirectPath = getRedirectPath(locationState);

	useEffect(() => {
		if (user) navigate(redirectPath, { replace: true });
	}, [user, navigate, redirectPath]);

	const handleLogin = async () => {
		setError("");
		setLoading(true);
		try {
			const response = await fetch(BASE_URL + "/api/account/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ email, password }),
			});
			const data = await response.json();
			if (data.status === "OK") {
				refreshUser();
				navigate(redirectPath, { replace: true });
			} else {
				setError(data.message || "Login failed");
			}
		} catch {
			setError("An error occurred during login. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const successMessage = locationState?.message;
	const inputClass = "w-full px-3 py-2.5 bg-background border border-white/[0.07] rounded-lg text-text text-sm focus:border-primary/50 focus:outline-none placeholder:text-muted/60";

	return (
		<div className="min-h-screen flex items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm">
				<div className="text-center mb-8">
					<span className="text-shsf font-extrabold text-3xl">{"{}"}</span>
					<span className="text-shsf font-bold text-2xl ml-1">SHSF</span>
					<p className="text-sm text-muted mt-2">Sign in to your account</p>
				</div>

				<div className="bg-surface border border-white/[0.07] rounded-xl p-6 shadow-2xl space-y-4">
					{successMessage && (
						<div className="px-3 py-2.5 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
							{successMessage}
						</div>
					)}
					{error && (
						<div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
							{error}
						</div>
					)}
					<div>
						<label className="block text-xs font-medium text-muted mb-1.5">Email</label>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className={inputClass}
							placeholder="your@email.com"
							disabled={loading}
							autoFocus
						/>
					</div>
					<div>
						<label className="block text-xs font-medium text-muted mb-1.5">Password</label>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className={inputClass}
							placeholder="••••••••••••"
							disabled={loading}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !loading && email && password) handleLogin();
							}}
						/>
					</div>
					<button
						onClick={handleLogin}
						disabled={loading || !email || !password}
						className="w-full py-2.5 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
					>
						{loading ? (
							<><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" /> Signing in…</>
						) : "Sign In"}
					</button>
				</div>

				<p className="text-center text-sm text-muted mt-4">
					Don't have an account?{" "}
					<a href="/register" className="text-primary hover:text-primary/80 transition-colors">
						Create one
					</a>
				</p>
				<div className="flex justify-center gap-6 mt-4 text-xs text-muted/50">
					<a href="/docs" className="hover:text-muted transition-colors">Documentation</a>
					<a href="/" className="hover:text-muted transition-colors">Home</a>
				</div>
			</div>
		</div>
	);
}

export default LoginPage;
