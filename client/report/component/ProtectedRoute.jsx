import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = () => {
  const token = localStorage.getItem("adminToken");

  return token ? <Outlet /> : <Navigate to="/" replace />;
};

export default ProtectedRoute;
