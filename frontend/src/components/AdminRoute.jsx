import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import api from "../services/api";

export default function AdminRoute() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      try {
        const data = await api.get("/me");
        if (!active) return;
        setStatus(data?.user?.role === "admin" ? "ready" : "forbidden");
      } catch (error) {
        if (!active) return;
        setStatus(error.status === 401 ? "unauthorized" : "forbidden");
      }
    }

    checkAdmin();
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return <div style={{ padding: 24 }}>Cargando...</div>;
  }

  if (status === "unauthorized") {
    return <Navigate to="/login" replace />;
  }

  if (status === "forbidden") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
