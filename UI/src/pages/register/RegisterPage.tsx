import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../App";
import { BASE_URL } from "../..";

function RegisterPage() {
	const [displayName, setDisplayName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [passwordConfirm, setPasswordConfirm] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();
	const userContext = useContext(UserContext);
	const user = userContext?.user;

	useEffect(() => {
		if (user) navigate("/", { replace: true });
	}, [user, navigate]);

	const handleRegister = async () => {
		setError("");
		setLoading(true);
		try {
			const response = await fetch(BASE_URL + "/api/account/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					display_name: displayName,
					email,
					password,
					password_confirm: passwordConfirm,
				}),
			});

			if (response.status === 400) {
				const errorData = await response.text();
				setError(errorData || "Registration failed");
				return;
			}

			const data = await response.json();
			if (data.status === "OK") {
				navigate("/", { replace: true, state: { message: "Registration successful!" } });
			} else {
				setError(data.message || "Registration failed");
			}
		} catch {
			setError("An error occurred during registration. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const inputClass = "w-full px-3 py-2.5 bg-background border border-white/[0.07] rounded-lg text-text text-sm focus:border-primary/50 focus:outline-none placeholder:text-muted/60";

	return (
		<div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
			<div className="w-full max-w-sm">
				<div className="text-center mb-8">
					<span className="text-shsf font-extrabold text-3xl">{"{}"}</span>
					<span className="text-shsf font-bold text-2xl ml-1">SHSF</span>
					<p className="text-sm text-muted mt-2">Create your account</p>
				</div>

				<div className="bg-surface border border-white/[0.07] rounded-xl p-6 shadow-2xl space-y-4">
					{error && (
						<div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
							{error}
						</div>
					)}
					<div>
						<label className="block text-xs font-medium text-muted mb-1.5">Display Name</label>
						<input
							type="text"
							placeholder="Your Name"
							className={inputClass}
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							disabled={loading}
							autoFocus
						/>
					</div>
					<div>
						<label className="block text-xs font-medium text-muted mb-1.5">Email Address</label>
						<input
							type="email"
							placeholder="your@email.com"
							className={inputClass}
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={loading}
						/>
					</div>
					<div>
						<label className="block text-xs font-medium text-muted mb-1.5">Password</label>
						<input
							type="password"
							placeholder="••••••••••••"
							className={inputClass}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={loading}
						/>
					</div>
					<div>
						<label className="block text-xs font-medium text-muted mb-1.5">Confirm Password</label>
						<input
							type="password"
							placeholder="••••••••••••"
							className={inputClass}
							value={passwordConfirm}
							onChange={(e) => setPasswordConfirm(e.target.value)}
							disabled={loading}
						/>
					</div>
					<button
						className="w-full py-2.5 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
						onClick={handleRegister}
						disabled={loading || !displayName || !email || !password || !passwordConfirm}
					>
						{loading ? (
							<><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" /> Creating account…</>
						) : "Create Account"}
					</button>
				</div>

				<p className="text-center text-sm text-muted mt-4">
					Already have an account?{" "}
					<a href="/login" className="text-primary hover:text-primary/80 transition-colors">
						Sign in
					</a>
				</p>
			</div>
		</div>
	);
}

export default RegisterPage;
