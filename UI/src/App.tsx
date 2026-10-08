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
import { apiFetch } from "./services/api";

const fetch = apiFetch;

// Create a context for user data
export const UserContext = createContext<{
	user: User | null;
	loading: boolean;
	error: string | null;
	refreshUser: () => void;
}>({
	user: null,
	loading: true,
	error: null,
	refreshUser: () => {},
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const { user, loading, error, refreshUser } = useContext(UserContext);
	const location = useLocation();

	if (!user && !loading && error) {
		return (
			<div className="max-w-xl mx-auto mt-16 bg-surface border border-red-500/20 rounded-xl px-5 py-4">
				<h1 className="text-base font-semibold text-text">SHSF is unavailable</h1>
				<p className="text-sm text-red-400 mt-1">{error}</p>
				<button className="mt-4 px-3 py-1.5 bg-primary text-background text-sm font-medium rounded-lg" onClick={refreshUser}>
					Try again
				</button>
			</div>
		);
	}

	if (!user && !loading) {
		return <Navigate to="/login" state={{ from: location }} replace />;
	}

	return <>{children}</>;
}

function AppLayout() {
	const { user, loading, refreshUser } = useContext(UserContext);
	const location = useLocation();

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<NavBar user={user} loading={loading} refreshUser={refreshUser} />
			<ToastContainer theme="dark" autoClose={3500} limit={3} />
			<main key={location.pathname} className="motion-fade-in flex-grow w-full max-w-none mx-auto px-4 sm:px-6 lg:px-8 xl:w-11/12 xl:px-0 2xl:w-5/6 2xl:px-0 py-6">
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
	const [authError, setAuthError] = useState<string | null>(null);

	const fetchUserData = () => {
		setLoading(true);
		fetch(`${BASE_URL}/api/account/getUserInfo`, {
			credentials: "include",
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.status === "OK") {
					setUser(data.user);
					setAuthError(null);
				} else if (data.code === "AUTHENTICATION_REQUIRED") {
					setUser(null);
					setAuthError(null);
				} else {
					setUser(null);
					setAuthError(data.message || "SHSF could not verify your session. Try again.");
				}
			})
			.catch((err) => {
				console.error("Error fetching user info:", err);
				setUser(null);
				setAuthError("SHSF could not verify your session. Try again.");
			})
			.finally(() => setLoading(false));
	};

	useEffect(() => {
		fetchUserData();
	}, []);

	return (
		<UserContext.Provider value={{ user, loading, error: authError, refreshUser: fetchUserData }}>
			<ConfirmProvider>
				<RouterProvider router={router} />
			</ConfirmProvider>
		</UserContext.Provider>
	);
}

export default App;
