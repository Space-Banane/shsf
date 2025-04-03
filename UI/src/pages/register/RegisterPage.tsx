import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../App";

function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const navigate = useNavigate();
  const { user, refreshUser } = useContext(UserContext);

  useEffect(() => {
    // Redirect if user is already logged in
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const handleRegister = () => {
    fetch("http://localhost:5000/api/account/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // Important for cookies
      body: JSON.stringify({ display_name: displayName, email, password, password_confirm: passwordConfirm }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "OK") {
          alert("Registration successful!");
          navigate("/login"); // Redirect to login
        } else {
          alert(data.message || "Registration failed");
        }
      })
      .catch((err) => console.error("Registration error:", err));
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-6">Register</h1>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-1">Display Name</label>
            <input
              type="text"
              placeholder="Your Name"
              className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-gray-300 mb-1">Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-gray-300 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-gray-300 mb-1">Confirm Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </div>
          <button
            className="w-full bg-blue-600 text-white py-3 rounded font-medium hover:bg-blue-700 transition duration-200"
            onClick={handleRegister}
          >
            Register
          </button>
        </div>
        <div className="mt-6 text-center text-gray-400">
          Already have an account? <a href="/login" className="text-blue-500 hover:text-blue-400">Login</a>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
