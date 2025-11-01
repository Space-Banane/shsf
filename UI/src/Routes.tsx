import { DatabaseComDocPage } from "./pages/docs/db-com";
import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import IndexPage from "./pages/index/index";
import LoginPage from "./pages/login/LoginPage";
import RegisterPage from "./pages/register/RegisterPage";
import FunctionsList from "./pages/functions/FunctionsList";
import { DocsPage } from "./pages/index/docs";
import { DocsGettingStarted } from "./pages/docs/getting-started";
import { MyFirstFunctionDoc } from "./pages/docs/my-first-function";
import { DataPassingPage } from "./pages/docs/data-passing";
import { CustomResponsesPage } from "./pages/docs/custom-responses";
import { EnvironmentVariablesPage } from "./pages/docs/environment-variables";
import { AccountPage } from "./pages/Account";
import  FunctionDetail  from "./pages/functions/FunctionDetail";
import { SecureHeadersPage } from "./pages/docs/secure-headers";
import { PersistentDataPage } from "./pages/docs/persistent-data";
import { RedirectsPage } from "./pages/docs/redirects";
import { RawBodyPage } from "./pages/docs/raw-body";
import { UserInterfacesPage } from "./pages/docs/user-interfaces";
import { DockerMountPage } from "./pages/docs/docker-mount";
import { ServeOnlyHtmlPage } from "./pages/docs/serve-only";
import { AccessTokensDocPage } from "./pages/docs/access-tokens";
import AccessTokensPage from "./pages/AccessTokens";
import { CLIDocPage } from "./pages/docs/cli";
import StoragePage from "./pages/Storage";
// Added back the routes array
export interface AppRoute {
  path: string;
  component: React.FC<any>;
  name: string;
  requireAuth: boolean;
  show_nav?: boolean;
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
    path: "/docs",
    component: DocsPage,
    name: "Docs",
    requireAuth: false,
    show_nav: true,
  },

  // More docs
  {
    path: "/docs/getting-started",
    component: DocsGettingStarted,
    name: "Getting Started",
    requireAuth: false,
  },
  {
    path: "/docs/my-first-function",
    component: MyFirstFunctionDoc,
    name: "My First Function",
    requireAuth: false,
  },
  {
    path: "/docs/data-passing",
    component: DataPassingPage,
    name: "Data Passing",
    requireAuth: false,
  },
  {
    path: "/docs/custom-responses",
    component: CustomResponsesPage,
    name: "Custom Responses",
    requireAuth: false,
  },
  {
    path: "/docs/environment-variables",
    component: EnvironmentVariablesPage,
    name: "Environment Variables",
    requireAuth: false,
  },
  {
    path: "/docs/secure-headers",
    component: SecureHeadersPage,
    name: "Secure Headers",
    requireAuth: false,
  },
  {
    path: "/docs/persistent-data",
    component: PersistentDataPage,
    name: "Persistent Data",
    requireAuth: false,
  },
  {
    path: "/docs/redirects",
    component: RedirectsPage,
    name: "Redirects",
    requireAuth: false,
  },
  {
    path: "/docs/docker-mount",
    component: DockerMountPage,
    name: "Docker Mount",
    requireAuth: false,
  },
  {
    path: "/docs/serve-only",
    component: ServeOnlyHtmlPage,
    name: "Serve Only HTML",
    requireAuth: false,
  },
  {
    path: "/docs/access-tokens",
    component: AccessTokensDocPage,
    name: "Access Tokens Doc",
    requireAuth: false,
  },
  {
    path: "/docs/raw-body",
    component: RawBodyPage,
    name: "Raw Body",
    requireAuth: false,
  },
  {
    path: "/docs/user-interfaces",
    component: UserInterfacesPage,
    name: "User Interfaces",
    requireAuth: false,
  },
  {
    path: "/docs/cli",
    component: CLIDocPage,
    name: "CLI Usage",
    requireAuth: false,
  },
  {
    path: "/docs/db-com",
    component: DatabaseComDocPage,
    name: "Database Communication",
    requireAuth: false,
  },

  

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
    path: "/access-tokens",
    name: "Access Tokens",
    component: AccessTokensPage,
    requireAuth: true,
  }
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
                <route.component user={user} refreshUser={refreshUser} />
              </ProtectedRoute>
            ) : (
              <route.component user={user} refreshUser={refreshUser} />
            )
          }
        />
      ))}
      <Route path="*" element={<NoMatch />} />
    </Routes>
  );
};

export default AppRoutes;
