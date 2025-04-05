import { useState, useEffect, createContext } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { routes } from "./Routes";
import { User } from "./types/Prisma";

const funnyMessages = [
  "Debugging is like being the detective in a crime movie where you are also the murderer.",
  "There are 10 types of people in the world: those who understand binary and those who don’t.",
  "Why do programmers prefer dark mode? Because light attracts bugs!",
  "Programming is 10% writing code and 90% figuring out why it doesn’t work.",
  "To understand recursion, you must first understand recursion.",
  "A SQL query walks into a bar, walks up to two tables, and asks: 'Can I join you?'",
  "There’s no place like 127.0.0.1.",
  "I have a joke about UDP, but I’m not sure if you’ll get it.",
  "I'm not a magician, but I can see why your code disappeared.",
  "My code doesn't have bugs, it just develops random features.",
  "I don't always test my code, but when I do, I do it in production.",
  "Keep calm and code on.",
  "Life is too short for bad code.",
  "Coding: where 'it works on my machine' is a valid excuse.",
  "I'm not lazy, I'm just in power-saving mode.",
  "Will code for coffee.",
  "If at first you don't succeed, call it version 1.0.",
  "I used to have a handle on life, but then my code crashed.",
  "It's not a bug, it's an undocumented feature.",
  "My code is so clean, you can eat off it... if you're into that.",
  "Real programmers count from 0.",
  "I code, therefore I am.",
  "Keyboard: the modern-day magic wand.",
  "Coding is like riding a bike... except the bike is on fire, you're on fire, everything's on fire.",
  "I'm not a code monkey, I'm a code slinger.",
  "You had me at 'Hello, World!'",
  "Running late is my default state, just like my infinite loops.",
  "I break code, not hearts.",
  "My source control is my safety net.",
  "Always code as if the guy who ends up maintaining your code will be a violent psychopath who knows where you live.",
  "I don't always write comments, but when I do, I ensure no one reads them.",
  "You can’t handle the truth() of my code!",
  "Programmer by day, bug fixer by night.",
  "My code compiles, therefore I do nothing wrong.",
  "Commit early, commit often, but never commit regret.",
  "Hello, world! I'm back with more bugs.",
  "I may not be perfect, but my code is error-free... in my dreams.",
  "I write code; I solve problems; I conquer bugs.",
  "Optimism is my default state, even when code fails.",
  "Keep calm and blame the compiler.",
  "Don’t worry, my code is just like your ex—complicated and a bit broken.",
  "Let’s make our code as sassy as our comments.",
  "In code we trust, in coffee we must.",
  "I code in the shower, and yes, my logic is wet.",
  "I like my code like I like my humor: dry and unexpected.",
  "My code is like a fine wine; it only gets better with debugging.",
  "I’m here to turn coffee into code and code into chaos.",
  "Don't worry, if my code crashes, it’s just taking a coffee break.",
  "May your bugs be few and your commits be many.",
  "Every line of code is a new adventure... into madness."
];

// Create a context for user data
export const UserContext = createContext<{
  user: User | null;
  loading: boolean;
  refreshUser: () => void;
}>({
  user: null,
  loading: true,
  refreshUser: () => {},
});

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [funnyMessage, setFunnyMessage] = useState("Loading...");

  useEffect(() => {
    const intervalId = setInterval(() => {
      setFunnyMessage(funnyMessages[Math.floor(Math.random() * funnyMessages.length)]);
    }, 15000); // Change message every 15 seconds

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, []);

  useEffect(() => {
    fetchUserData();
    setFunnyMessage(funnyMessages[Math.floor(Math.random() * funnyMessages.length)]);
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

  const newMessage = () => {
    setFunnyMessage(funnyMessages[Math.floor(Math.random() * funnyMessages.length)]);
  };

  return (
    <UserContext.Provider value={{ user, loading, refreshUser: fetchUserData }}>
      <BrowserRouter>
        <div className="min-h-screen bg-[#161725] text-blue-100 flex flex-col">
          <header className="bg-[#282844] border-b border-purple-700/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-between">
                {/* Logo */}
                <div className="flex items-center">
                  <a href="/" className="text-2xl font-bold">
                    <img src="/small_transparent.ico" alt="Logo" className="h-8 w-8 inline-block mr-1" />
                    <h3 className="inline text-slate-300">SHSF</h3>
                  </a>
                </div>
              {/* Navigation Links */}
              <nav className="hidden md:flex items-center space-x-1">
          {routes
          .filter((route) => !["Login", "Register"].includes(route.name))
          .filter((route) => !route.no_nav)
          .map((route) => (
            <a
            key={route.path}
            href={route.path}
            className="px-3 py-2 rounded-md text-sm font-medium text-blue-200 hover:bg-[#383863] hover:text-white transition-all"
            >
            {route.name}
            </a>
          ))}
              </nav>

              {/* User Section */}
              <div className="flex items-center">
          {loading ? (
          <div className="animate-pulse h-8 w-8 rounded-full bg-[#383863]"></div>
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
            className="h-8 w-8 rounded-full ring-2 ring-purple-500/50"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
            {user.displayName ? user.displayName[0].toUpperCase() : "?"}
                </div>
              )}
              <span className="text-blue-100 hidden md:inline">{user.displayName}</span>
            </button>
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#282844] rounded-md shadow-lg py-1 z-10 border border-purple-500/20">
                <button
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-[#383863]"
                >
            Logout
                </button>
              </div>
            )}
          </div>
          ) : (
          <a
            href="/login"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition duration-150 border border-purple-500/20"
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

          <footer className="bg-[#282844] py-2 border-t border-purple-700/30">
            <div className="container mx-auto px-4 text-center text-blue-200">
              <p>
              © {new Date().getFullYear()}. Made with{" "}
              <span className="text-red-500 text-2xl">♥</span>  by{" "}
              <a href="https://space.reversed.dev" className="text-blue-400 hover:text-blue-300">
                Space
              </a>
              </p>
              <p className="text-sm text-blue-300">
              {funnyMessage} <button onClick={() => newMessage()} className="text-blue-400 hover:text-blue-300 ml-2">
                <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="h-5 w-5 inline-block ml-1 fill-current text-blue-400 hover:text-blue-300 transition-colors"
                role="img"
                aria-label="Reload"
                >
                <title>Reload</title>
                <path d="M2 12C2 16.97 6.03 21 11 21C13.39 21 15.68 20.06 17.4 18.4L15.9 16.9C14.63 18.25 12.86 19 11 19C4.76 19 1.64 11.46 6.05 7.05C10.46 2.64 18 5.77 18 12H15L19 16H19.1L23 12H20C20 7.03 15.97 3 11 3C6.03 3 2 7.03 2 12Z" />
                </svg>
              </button>
              </p>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </UserContext.Provider>
  );
}

export default App;