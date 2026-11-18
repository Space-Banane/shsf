import React from "react";
import { documentationRoutes } from "./pages/docs/docsRegistry";

const IndexPage = React.lazy(() => import("./pages/index/index"));
const LoginPage = React.lazy(() => import("./pages/login/LoginPage"));
const RegisterPage = React.lazy(() => import("./pages/register/RegisterPage"));
const FunctionsList = React.lazy(() => import("./pages/functions/FunctionsList"));
const DocsPage = React.lazy(() => import("./pages/index/docs").then((module) => ({ default: module.DocsPage })));
const AccountPage = React.lazy(() => import("./pages/Account").then((module) => ({ default: module.AccountPage })));
const FunctionDetail = React.lazy(() => import("./pages/functions/FunctionDetail"));
const AccessTokensPage = React.lazy(() => import("./pages/AccessTokens"));
const StoragePage = React.lazy(() => import("./pages/Storage"));
const CronJobsPage = React.lazy(() => import("./pages/CronJobs"));
const GuestUsersPage = React.lazy(() => import("./pages/GuestUsers"));
const GuestAccessPage = React.lazy(() => import("./pages/Guest-Access"));
const AdminPage = React.lazy(() => import("./pages/Admin").then((module) => ({ default: module.AdminPage })));
const FunctionAnalyticsPage = React.lazy(() => import("./pages/FunctionAnalytics"));

// Added back the routes array
export interface AppRoute {
	path: string;
	component: React.ComponentType<any>;
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
