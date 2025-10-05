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
    // Redirect if user is already logged in
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const handleRegister = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch(BASE_URL+"/api/account/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Important for cookies
        body: JSON.stringify({ display_name: displayName, email, password, password_confirm: passwordConfirm }),
      });

      if (response.status === 400) {
        const errorData = await response.text();
        setError(errorData || "Registration failed");
        return;
      }
      
      const data = await response.json();
      
      if (data.status === "OK") {
        navigate("/", { 
          replace: true,
          state: { message: "Registration successful!" }
        });
      } else {
        setError(data.message || "Registration failed");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError("An error occurred during registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header Section */}
      <div className="relative bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-b border-primary/20">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold text-primary mb-4">Create Account</h1>
            <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
            <p className="text-xl text-text/70 max-w-2xl mx-auto">
              Join SHSF and start deploying serverless functions in seconds
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-2xl p-8 hover:border-primary/40 hover:shadow-[0_0_30px_rgba(124,131,253,0.1)] transition-all duration-300">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🚀</span>
            </div>
            <h2 className="text-2xl font-bold text-primary mb-2">Get Started Today</h2>
            <p className="text-text/60">Fill in your details to create your SHSF account</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm flex items-center gap-3">
              <span className="text-lg">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-text/70 text-sm font-medium mb-2">
                Display Name
              </label>
              <input
                type="text"
                placeholder="Your Name"
                className="w-full p-4 bg-background/50 border border-primary/20 rounded-xl text-text placeholder-text/40 focus:border-primary/50 focus:outline-none focus:shadow-[0_0_20px_rgba(124,131,253,0.1)] transition-all duration-300"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-text/70 text-sm font-medium mb-2">
                Email Address
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                className="w-full p-4 bg-background/50 border border-primary/20 rounded-xl text-text placeholder-text/40 focus:border-primary/50 focus:outline-none focus:shadow-[0_0_20px_rgba(124,131,253,0.1)] transition-all duration-300"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-text/70 text-sm font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                className="w-full p-4 bg-background/50 border border-primary/20 rounded-xl text-text placeholder-text/40 focus:border-primary/50 focus:outline-none focus:shadow-[0_0_20px_rgba(124,131,253,0.1)] transition-all duration-300"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-text/70 text-sm font-medium mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                className="w-full p-4 bg-background/50 border border-primary/20 rounded-xl text-text placeholder-text/40 focus:border-primary/50 focus:outline-none focus:shadow-[0_0_20px_rgba(124,131,253,0.1)] transition-all duration-300"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              className="w-full p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-[0_0_30px_rgba(124,131,253,0.3)] hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-300 flex items-center justify-center gap-3"
              onClick={handleRegister}
              disabled={loading || !displayName || !email || !password || !passwordConfirm}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating Account...
                </>
              ) : (
                <>
                  <span className="text-lg">🚀</span>
                  Create Account
                </>
              )}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-primary/10 text-center">
            <p className="text-text/60">
              Already have an account?{" "}
              <a
                href="/login"
                className="text-primary hover:text-primary/80 font-semibold hover:underline transition-all duration-300"
              >
                Sign in here
              </a>
            </p>
          </div>

          {/* Features Preview */}
          <div className="mt-8 pt-6 border-t border-primary/10">
            <h3 className="text-lg font-semibold text-text mb-4 text-center">What you get with SHSF</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-background/30 rounded-lg">
                <div className="text-2xl mb-2">⚡</div>
                <p className="text-text/70">Instant Deployment</p>
              </div>
              <div className="text-center p-3 bg-background/30 rounded-lg">
                <div className="text-2xl mb-2">🔧</div>
                <p className="text-text/70">Easy Management</p>
              </div>
              <div className="text-center p-3 bg-background/30 rounded-lg">
                <div className="text-2xl mb-2">📊</div>
                <p className="text-text/70">Real-time Analytics</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
