import { useState, useEffect, createContext, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { routes } from "./Routes";
import { User } from "./types/Prisma";
import { BASE_URL } from ".";
import { Footer } from "./components/ui/Footer";
import { NavBar } from "./components/ui/NavBar";

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

	useEffect(() => {
		fetchUserData();
	}, []);

	

	return (
		<UserContext.Provider value={{ user, loading, refreshUser: fetchUserData }}>
			<BrowserRouter>
				<div className="min-h-screen flex flex-col bg-background">
					<NavBar user={user} loading={loading} refreshUser={fetchUserData} />

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

					<Footer />
				</div>
			</BrowserRouter>
		</UserContext.Provider>
	);
}

export default App;
