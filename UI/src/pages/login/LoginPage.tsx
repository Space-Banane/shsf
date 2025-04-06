import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../App";
import { BASE_URL } from "../..";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { user, refreshUser } = useContext(UserContext);
  
  useEffect(() => {
    // Redirect if user is already logged in
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);
  
  const handleLogin = () => {
    fetch(BASE_URL+"/api/account/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "OK") {
          refreshUser();
          navigate("/");
        } else {
          alert(data.message || "Login failed");
        }
      })
      .catch((err) => {
        console.error("Login error:", err);
        alert("An error occurred during login");
      });
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-6">Login</h1>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
            />
          </div>
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 rounded font-medium hover:bg-blue-700 transition duration-200"
          >
            Sign In
          </button>
        </div>
        <div className="mt-6 text-center text-gray-400">
          Don't have an account? <a href="/register" className="text-blue-500 hover:text-blue-400">Register</a>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
