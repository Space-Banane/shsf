import { useState, useEffect, createContext } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { routes } from "./Routes";

// Create a context for user data
export const UserContext = createContext<{
  user: any;
  loading: boolean;
  refreshUser: () => void;
}>({
  user: null,
  loading: true,
  refreshUser: () => {},
});

function App() {
  interface User {
    avatar_url?: string;
    display_name?: string;
  }
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = () => {
    setLoading(true);
    fetch("http://localhost:5000/api/account/getUserInfo", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "OK") {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch((err) => {
        console.error("Error fetching user info:", err);
        setUser(null);
      })
      .finally(() => setLoading(false));
  };

  const handleLogout = () => {
    fetch("http://localhost:5000/api/logout", {
      method: "PATCH",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "OK") {
          setUser(null);
          window.location.href = "/login"; // Redirect to login
        }
      })
      .catch((err) => console.error("Logout error:", err));
  };

  return (
    <UserContext.Provider value={{ user, loading, refreshUser: fetchUserData }}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col">
          <header className="bg-gray-800 border-b border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-between">
              {/* Navigation Links */}
              <nav className="hidden md:flex items-center space-x-1">
                {routes
                .filter((route) => !["Login", "Register"].includes(route.name))
                .filter((route) => !route.no_nav)
                .map((route) => (
                  <a
                  key={route.path}
                  href={route.path}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-all"
                  >
                  {route.name}
                  </a>
                ))}
              </nav>

              {/* User Section */}
              <div className="flex items-center">
                {loading ? (
                <div className="animate-pulse h-8 w-8 rounded-full bg-gray-600"></div>
                ) : user ? (
                <div className="relative">
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center space-x-2 focus:outline-none"
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt="User Avatar"
                        className="h-8 w-8 rounded-full ring-2 ring-gray-700"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                        {user.display_name ? user.display_name[0].toUpperCase() : "?"}
                      </div>
                    )}
                    <span className="text-white hidden md:inline">{user.display_name}</span>
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-10">
                      <a
                        href="/profile"
                        className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                      >
                        Profile
                      </a>
                      <a
                        href="/settings"
                        className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                      >
                        Settings
                      </a>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
                ) : (
                <a
                  href="/login"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition duration-150"
                >
                  Login
                </a>
                )}
              </div>
              </div>
            </div>
          </header>

          <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Routes>
              {routes.map((route) => (
                <Route 
                  key={route.path} 
                  path={route.path} 
                  element={
                    route.requireAuth && !user && !loading ? (
                      <Navigate to="/login" replace />
                    ) : (
                      <route.component />
                    )
                  } 
                />
              ))}
            </Routes>
          </main>

          <footer className="bg-gray-800 py-4">
            <div className="container mx-auto px-4 text-center text-gray-400">
              © {new Date().getFullYear()}. By <a href="https://space.reversed.dev" className="text-blue-500 hover:text-blue-400">Space</a>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </UserContext.Provider>
  );
}

export default App;