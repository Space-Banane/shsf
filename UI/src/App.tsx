import { useState, useEffect, createContext, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { routes } from "./Routes";
import { User } from "./types/Prisma";
import { BASE_URL } from ".";
import { TextScramble } from "./utils/TextScramble";

const funnyMessages = [
	"Debugging is like being the detective in a crime movie where you are also the murderer.",
	"Programming is 10% writing code and 90% figuring out why it doesn’t work.",
	"To understand recursion, you must first understand recursion.",
	"Ain't no place like 127.0.0.1.",
	"I have a joke about UDP, but I’m not sure if you’ll get it.",
	"I'm not a magician, but I can see why your code disappeared.",
	"My code doesn't have bugs, it just develops random features.",
	'"rm -rf / --no-preserve-root" to remove the French Language Pack',
	"I don't always test my code, but when I do, I do it in production.",
	"Keep calm and code on.",
	"Life is too short for bad code.",
	"Will code for a redbull",
	"It's not a bug, it's an undocumented feature.",
	"Coding is like riding a bike... except the bike is on fire, you're on fire, everything's on fire.",
	"I break code, not hearts.",
	"Always code as if the guy who ends up maintaining your code will be a violent psychopath who knows where you live.",
	"My code compiles, therefore I do nothing wrong.",
	"Commit early, commit often, but never commit regret.",
	"Keep calm and blame the compiler.",
	"Don’t worry, my code is just like your ex—complicated and a bit broken.",
	"In code we trust, in redbull we must.",
	"I code in the shower, and yes, my logic is wet.",
	"I like my code like I like my humor: dry and unexpected.",
	"My code is like a fine wine; it only gets better with debugging.",
	"May your bugs be few and your commits be many.",
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
	const funnyMessageRef = useRef<HTMLSpanElement>(null);
	const textScrambleRef = useRef<TextScramble | null>(null);

	useEffect(() => {
		// Initialize TextScramble once the component is mounted
		if (funnyMessageRef.current) {
			textScrambleRef.current = new TextScramble(funnyMessageRef.current);

			// Set initial message
			const initialMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
			textScrambleRef.current.setText(initialMessage);
			setFunnyMessage(initialMessage);
		}
	}, []);

	useEffect(() => {
		const intervalId = setInterval(() => {
			const newMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
			if (textScrambleRef.current) {
				textScrambleRef.current.setText(newMessage);
			}
			setFunnyMessage(newMessage);
		}, 15000); // Change message every 15 seconds

		return () => clearInterval(intervalId); // Cleanup interval on component unmount
	}, []);

	useEffect(() => {
		fetchUserData();
		const initialMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
		if (textScrambleRef.current) {
			textScrambleRef.current.setText(initialMessage);
		}
		setFunnyMessage(initialMessage);
	}, []);

	const fetchUserData = () => {
		setLoading(true);
		fetch(`${BASE_URL}/api/account/getUserInfo`, {
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
		fetch(`${BASE_URL}/api/logout`, {
			method: "PATCH",
			credentials: "include",
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.status === "OK") {
					setUser(null);
					window.location.href = "/login"; // Redirect to login
					document.cookie =
						"shsf_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
				}
			})
			.catch((err) => console.error("Logout error:", err));
	};

	const newMessage = () => {
		const newMsg = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
		if (textScrambleRef.current) {
			textScrambleRef.current.setText(newMsg);
		}
		setFunnyMessage(newMsg);
	};

	return (
		<UserContext.Provider value={{ user, loading, refreshUser: fetchUserData }}>
			<BrowserRouter>
				<div className="min-h-screen flex flex-col bg-background">
					<header className="bg-navbar border-b border-blue-700/30">
						<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
							<div className="flex h-16 items-center justify-between">
								{/* Logo */}
								<div className="flex items-center">
									<a href="/" className="text-2xl font-bold">
										<h2 className="space-x-2 text-primary inline font-extrabold text-3xl mr-2">{"{}"}</h2> {/* Peak logo */}
										<h3 className="inline text-primary">SHSF</h3>
									</a>
								</div>
								{/* Navigation Links */}
								<nav className="hidden md:flex items-center space-x-2">
									{routes
										.filter(
											(route) => !["Login", "Register"].includes(route.name)
										)
										.filter((route) => !route.no_nav)
										.map((route) => (
											<a
												key={route.path}
												href={route.path}
												className="px-4 py-1.5 rounded-md text-text hover:bg-[#383863] transition-all duration-200 text-lg font-medium border border-transparent hover:border-purple-500/20 flex items-center space-x-2"
											>
												<span>{route.name}</span>
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
														{user.displayName
															? user.displayName[0].toUpperCase()
															: "?"}
													</div>
												)}
												<span className="text-text font-semibold text-lg hidden md:inline">
													{user.displayName}
												</span>
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

					<footer className="bg-footer py-2 border-t border-blue-700/30 text-base">
						<div className="container mx-auto px-4 text-center">
							<p className="text-text">
								© {new Date().getFullYear()}. Made with{" "}
								<span className="text-red-500 text-2xl">♥</span> by{" "}
								<a
									href="https://space.reversed.dev"
									className="underline hover:text-secondary"
								>
									Space
								</a>
							</p>
							<p className="text-accent">
								<span ref={funnyMessageRef} className="italic text-quote"></span>{" "}
								<button
									onClick={() => newMessage()}
									className="text-accent hover:text-accent/50 ml-2"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										className="h-5 w-5 inline-block ml-1 fill-current text-accent hover:text-secondary transition-colors"
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
