import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import IndexPage from "./pages/index/index";
import LoginPage from "./pages/login/LoginPage";
import RegisterPage from "./pages/register/RegisterPage";
import FunctionsList from "./pages/functions/FunctionsList";
import { DocsPage } from "./pages/index/docs";
import { documentationRoutes } from "./pages/docs/docsRegistry";
import { AccountPage } from "./pages/Account";
import AccessTokensPage from "./pages/AccessTokens";
import StoragePage from "./pages/Storage";
import CronJobsPage from "./pages/CronJobs";
import GuestUsersPage from "./pages/GuestUsers";
import GuestAccessPage from "./pages/Guest-Access";
import { AdminPage } from "./pages/Admin";
import FunctionAnalyticsPage from "./pages/FunctionAnalytics";

const FunctionDetail = React.lazy(() => import("./pages/functions/FunctionDetail"));
// Added back the routes array
export interface AppRoute {
	path: string;
	component: React.FC<any>;
	name: string;
	requireAuth: boolean;
	show_nav?: boolean;
	adminOnly?: boolean;
}

export const routes: AppRoute[] = [
	{
		path: "/",
		component: IndexPage,
		name: "Home",
		requireAuth: false,
		show_nav: true,
	},
	{
		path: "/account",
		component: AccountPage,
		name: "Account",
		requireAuth: true,
	},
	{
		path: "/admin",
		component: AdminPage,
		name: "Admin",
		requireAuth: true,
		show_nav: false,
		adminOnly: true,
	},
	{
		path: "/docs",
		component: DocsPage,
		name: "Docs",
		requireAuth: false,
		show_nav: true,
	},

	...documentationRoutes,

	{ path: "/login", component: LoginPage, name: "Login", requireAuth: false },
	{
		path: "/register",
		component: RegisterPage,
		name: "Register",
		requireAuth: false,
	},
	{
		path: "/functions",
		name: "Functions",
		component: FunctionsList,
		requireAuth: true,
		show_nav: true,
	},
	{
		path: "/functions/:id",
		name: "FunctionDetail",
		component: FunctionDetail,
		requireAuth: true,
	},
	{
		path: "/storage",
		name: "Storage",
		component: StoragePage,
		requireAuth: true,
		show_nav: true,
	},
	{
		path: "/cron-jobs",
		name: "Cron Jobs",
		component: CronJobsPage,
		requireAuth: true,
		show_nav: true,
	},
	{
		path: "/function-analytics",
		name: "Analytics",
		component: FunctionAnalyticsPage,
		requireAuth: true,
		show_nav: true,
	},

	{
		path: "/access-tokens",
		name: "Access Tokens",
		component: AccessTokensPage,
		requireAuth: true,
	},
	{
		path: "/guest-users",
		name: "Guest Users",
		component: GuestUsersPage,
		requireAuth: true,
		show_nav: true,
	},
	{
		path: "/guest-access",
		name: "Guest Access",
		component: GuestAccessPage,
		requireAuth: false,
	},
];

const ProtectedRoute = ({
	user,
	children,
}: {
	user: any;
	children: React.ReactNode;
}) => {
	const location = useLocation();
	if (!user) {
		return <Navigate to="/login" state={{ from: location }} replace />;
	}
	return <>{children}</>;
};

function NoMatch() {
	return (
		<div className="p-4">
			<h1 className="text-white text-2xl">404 - Not Found</h1>
		</div>
	);
}

const AppRoutes = ({
	userProp,
	refreshUserProp,
}: {
	userProp: any;
	refreshUserProp: () => void;
}) => {
	const user = userProp;
	const refreshUser = refreshUserProp;

	return (
		<Routes>
			{routes.map((route) => (
				<Route
					key={route.name}
					path={route.path}
					element={
						route.requireAuth ? (
							<ProtectedRoute user={user}>
								<React.Suspense fallback={null}>
									<route.component user={user} refreshUser={refreshUser} />
								</React.Suspense>
							</ProtectedRoute>
						) : (
							<React.Suspense fallback={null}>
								<route.component user={user} refreshUser={refreshUser} />
							</React.Suspense>
						)
					}
				/>
			))}
			<Route path="*" element={<NoMatch />} />
		</Routes>
	);
};

export default AppRoutes;
