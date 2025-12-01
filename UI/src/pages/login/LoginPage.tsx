import { useState, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../../App";
import { BASE_URL } from "../..";

function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();
	const location = useLocation();
	const { user, refreshUser } = useContext(UserContext);

	useEffect(() => {
		// Redirect if user is already logged in
		if (user) {
			navigate("/", { replace: true });
		}
	}, [user, navigate]);

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
				navigate("/");
			} else {
				setError(data.message || "Login failed");
			}
		} catch (err) {
			console.error("Login error:", err);
			setError("An error occurred during login. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	// Get success message from registration
	const successMessage = location.state?.message;

	return (
		<div className="min-h-screen bg-background">
			{/* Hero Header Section */}
			<div className="relative bg-gradient-to-br from-green-900/20 to-blue-900/20 border-b border-primary/20">
				<div className="max-w-6xl mx-auto px-4 py-16">
					<div className="text-center space-y-4">
						<h1 className="text-5xl font-bold text-primary mb-4">Welcome Back</h1>
						<div className="h-1 w-24 bg-gradient-to-r from-green-500 to-blue-500 mx-auto rounded-full"></div>
						<p className="text-xl text-text/70 max-w-2xl mx-auto">
							Sign in to your SHSF account and continue building amazing functions
						</p>
					</div>
				</div>
			</div>

			<div className="max-w-2xl mx-auto px-4 py-12">
				<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-2xl p-8 hover:border-primary/40 hover:shadow-[0_0_30px_rgba(124,131,253,0.1)] transition-all duration-300">
					<div className="text-center mb-8">
						<div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
							<span className="text-3xl">👋</span>
						</div>
						<h2 className="text-2xl font-bold text-primary mb-2">Sign In</h2>
						<p className="text-text/60">
							Enter your credentials to access your account
						</p>
					</div>

					{successMessage && (
						<div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-xl text-green-300 text-sm flex items-center gap-3">
							<span className="text-lg">✅</span>
							<span>{successMessage}</span>
						</div>
					)}

					{error && (
						<div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm flex items-center gap-3">
							<span className="text-lg">⚠️</span>
							<span>{error}</span>
						</div>
					)}

					<div className="space-y-6">
						<div>
							<label className="block text-text/70 text-sm font-medium mb-2">
								Email Address
							</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full p-4 bg-background/50 border border-primary/20 rounded-xl text-text placeholder-text/40 focus:border-primary/50 focus:outline-none focus:shadow-[0_0_20px_rgba(124,131,253,0.1)] transition-all duration-300"
								placeholder="your@email.com"
								disabled={loading}
							/>
						</div>

						<div>
							<label className="block text-text/70 text-sm font-medium mb-2">
								Password
							</label>
							<input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full p-4 bg-background/50 border border-primary/20 rounded-xl text-text placeholder-text/40 focus:border-primary/50 focus:outline-none focus:shadow-[0_0_20px_rgba(124,131,253,0.1)] transition-all duration-300"
								placeholder="••••••••••••"
								disabled={loading}
								onKeyPress={(e) => {
									if (e.key === "Enter" && !loading && email && password) {
										handleLogin();
									}
								}}
							/>
						</div>

						<button
							onClick={handleLogin}
							disabled={loading || !email || !password}
							className="w-full p-4 bg-gradient-to-r from-green-600 to-blue-600 text-white font-bold rounded-xl hover:shadow-[0_0_30px_rgba(124,131,253,0.3)] hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-300 flex items-center justify-center gap-3"
						>
							{loading ? (
								<>
									<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
									Signing In...
								</>
							) : (
								<>
									<span className="text-lg">🔑</span>
									Sign In
								</>
							)}
						</button>
					</div>

					<div className="mt-8 pt-6 border-t border-primary/10 text-center">
						<p className="text-text/60">
							Don't have an account?{" "}
							<a
								href="/register"
								className="text-primary hover:text-primary/80 font-semibold hover:underline transition-all duration-300"
							>
								Create one here
							</a>
						</p>
					</div>

					{/* Quick Links */}
					<div className="mt-8 pt-6 border-t border-primary/10">
						<h3 className="text-lg font-semibold text-text mb-4 text-center">
							Quick Access
						</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
							<a
								href="/docs"
								className="p-3 bg-background/30 rounded-lg hover:bg-background/50 transition-all duration-300 text-center group"
							>
								<div className="text-2xl mb-2 group-hover:scale-110 transition-transform duration-300">
									📚
								</div>
								<p className="text-text/70 group-hover:text-text transition-colors duration-300">
									Documentation
								</p>
							</a>
							<a
								href="/"
								className="p-3 bg-background/30 rounded-lg hover:bg-background/50 transition-all duration-300 text-center group"
							>
								<div className="text-2xl mb-2 group-hover:scale-110 transition-transform duration-300">
									🏠
								</div>
								<p className="text-text/70 group-hover:text-text transition-colors duration-300">
									Back to Home
								</p>
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default LoginPage;
