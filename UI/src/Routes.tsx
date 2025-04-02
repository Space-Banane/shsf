import { BrowserRouter, Routes, Route } from "react-router-dom";
import IndexPage from "./pages/index/index";
import RunnerPage from "./pages/run/run";
import NotFoundPage from "./pages/404";

export const routes = [
  {
    name: "Index",
    path: "/",
    component: IndexPage,
  },
  {
    name:"Runner",
    path: "/run",
    component: RunnerPage,
  },
];

const AppRoutes = () => {
  const renderRoutes = () => {
    return routes.map((route) => (
      <Route
        key={route.name}
        path={route.path}
        element={<route.component />}
      />
    ));
  };

  return (
    <BrowserRouter>
      <Routes>
        {renderRoutes()}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
