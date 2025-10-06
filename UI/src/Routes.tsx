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
