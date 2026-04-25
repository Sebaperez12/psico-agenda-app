import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedRoute({ token }) {
  // si viene token por props, úsalo; si no, lo saco de localStorage
  const t = token ?? localStorage.getItem("token");

  if (!t) return <Navigate to="/login" replace />;
  return <Outlet />;
}