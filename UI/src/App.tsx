import { useState, useEffect, createContext, useContext } from "react";
import {
	Navigate,
	Outlet,
	RouterProvider,
	createBrowserRouter,
	createRoutesFromElements,
	Route,
	useLocation,
} from "react-router-dom";
import { routes } from "./Routes";
import { User } from "./types/Prisma";
import { BASE_URL } from ".";
import { Footer } from "./components/ui/Footer";
import { NavBar } from "./components/ui/NavBar";
import { ToastContainer } from "react-toastify";
import { ConfirmProvider } from "./components/modals/ConfirmModal";

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const { user, loading } = useContext(UserContext);
	const location = useLocation();

	if (!user && !loading) {
		return <Navigate to="/login" state={{ from: location }} replace />;
	}

	return <>{children}</>;
}

function AppLayout() {
	const { user, loading, refreshUser } = useContext(UserContext);

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<NavBar user={user} loading={loading} refreshUser={refreshUser} />
			<ToastContainer theme="dark" autoClose={3500} limit={15} />
			<main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6">
				<Outlet />
			</main>
			<Footer />
		</div>
	);
}

function NoMatch() {
	return (
		<div className="p-4">
			<h1 className="text-white text-2xl">404 - Not Found</h1>
		</div>
	);
}

const router = createBrowserRouter(
	createRoutesFromElements(
		<Route element={<AppLayout />}>
			{routes.map((route) => (
				<Route
					key={route.path}
					path={route.path}
					element={
						route.requireAuth ? (
							<ProtectedRoute>
								<route.component />
							</ProtectedRoute>
						) : (
							<route.component />
						)
					}
				/>
			))}
			<Route path="*" element={<NoMatch />} />
		</Route>,
	),
);

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
			<ConfirmProvider>
				<RouterProvider router={router} />
			</ConfirmProvider>
		</UserContext.Provider>
	);
}

export default App;
