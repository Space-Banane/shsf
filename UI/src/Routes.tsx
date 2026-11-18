import React from "react";
import IndexPage from "./pages/index/index";
import LoginPage from "./pages/login/LoginPage";
import RegisterPage from "./pages/register/RegisterPage";
import FunctionsList from "./pages/functions/FunctionsList";
import { DocsPage } from "./pages/index/docs";
import { documentationRoutes } from "./pages/docs/docsRegistry";
import { AccountPage } from "./pages/Account";
import FunctionDetail from "./pages/functions/FunctionDetail";
import AccessTokensPage from "./pages/AccessTokens";
import StoragePage from "./pages/Storage";
import CronJobsPage from "./pages/CronJobs";
import GuestUsersPage from "./pages/GuestUsers";
import GuestAccessPage from "./pages/Guest-Access";
import { AdminPage } from "./pages/Admin";
import FunctionAnalyticsPage from "./pages/FunctionAnalytics";
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
		name: "Function",
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
