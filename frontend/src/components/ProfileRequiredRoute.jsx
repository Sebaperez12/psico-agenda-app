import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import api from "../services/api";

export default function ProfileRequiredRoute() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;

    async function checkProfile() {
      try {
        const data = await api.get("/me");
        if (!active) return;
        setStatus(data?.user?.has_profile ? "ready" : "missing");
      } catch (error) {
        if (!active) return;
        setStatus(error.status === 401 ? "unauthorized" : "ready");
      }
    }

    checkProfile();
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

  if (status === "missing") {
    return <Navigate to="/profile" replace />;
  }

  return <Outlet />;
}
