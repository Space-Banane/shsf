import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import IndexPage from "./pages/index/index";
import LoginPage from "./pages/login/LoginPage";
import RegisterPage from "./pages/register/RegisterPage";
import FunctionsList from './pages/functions/FunctionsList';
import FunctionDetail from './pages/functions/FunctionDetail';
// Added back the routes array
export interface AppRoute {
  path: string;
  component: React.FC<any>;
  name: string;
  requireAuth: boolean;
  no_nav?: boolean;
}

export const routes: AppRoute[] = [
  { path: "/", component: IndexPage, name: "Home", requireAuth: false },
  { path: "/login", component: LoginPage, name: "Login", requireAuth: false },
  { path: "/register", component: RegisterPage, name: "Register", requireAuth: false },
  {
    path: '/functions',
    name: 'Functions',
    component: FunctionsList,
    requireAuth: true,
  },
  {
    path: '/functions/:id',
    name: 'FunctionDetail',
    component: FunctionDetail,
    requireAuth: true,
    no_nav: true,
  },
];

const ProtectedRoute = ({ user, children }: { user: any; children: React.ReactNode }) => {
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

const AppRoutes = ({ userProp, refreshUserProp }: { userProp: any; refreshUserProp: () => void }) => {
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
