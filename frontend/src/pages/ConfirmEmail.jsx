import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import logo from "../assets/logo 6.png";
import sessionImage from "../assets/PORTADA.png";
import api from "../services/api";
import "./ConfirmEmail.css";

export default function ConfirmEmail() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);
  const [msg, setMsg] = useState("");
  const [resending, setResending] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    api.get("/me")
      .then((data) => {
        if (!active) return;
        setUser(data?.user || null);
        setStatus(data?.user?.email_verified ? "verified" : "pending");
      })
      .catch((error) => {
        if (!active) return;
        setStatus(error.status === 401 ? "unauthorized" : "pending");
        setMsg(error.status === 401 ? "" : error.message);
      });

    return () => {
      active = false;
    };
  }, []);

  async function resendVerification() {
    setMsg("");
    setResending(true);
    try {
      const data = await api.post("/auth/resend-verification", {});
      setMsg(data.msg || "Te enviamos nuevamente el email de confirmacion.");
    } catch (error) {
      setMsg(error.message);
    } finally {
      setResending(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  async function deletePendingAccount() {
    if (!deleteArmed) {
      setMsg("");
      setDeleteArmed(true);
      return;
    }

    setMsg("");
    setDeleting(true);
    try {
      await api.delete("/account", { confirm_email: user?.email });
      localStorage.removeItem("token");
      navigate("/login", { replace: true });
    } catch (error) {
      setMsg(error.message);
    } finally {
      setDeleting(false);
    }
  }

  if (status === "loading") {
    return <main className="confirm-email-page">Cargando...</main>;
  }

  if (status === "unauthorized") {
    return <Navigate to="/login" replace />;
  }

  if (status === "verified") {
    if (user?.role === "admin") {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to={user?.has_profile ? "/dashboard" : "/profile"} replace />;
  }

  return (
    <main className="confirm-email-page">
      <section className="confirm-email-card" aria-labelledby="confirm-email-title">
        <div className="confirm-email-card__copy">
          <Link className="confirm-email-card__brand" to="/">
            <img src={logo} alt="TherapyDesk" />
            <span>TherapyDesk</span>
          </Link>

          <p className="confirm-email-card__eyebrow">Cuenta pendiente</p>
          <h1 id="confirm-email-title">Falta confirmar tu email</h1>
          <p className="confirm-email-card__text">
            Para proteger tu cuenta y evitar registros con correos ajenos, necesitamos confirmar{" "}
            <strong>{user?.email || "tu email"}</strong>. Si no encontrás el mensaje de
            confirmacion, podes reenviarlo desde aca.
          </p>

          <div className="confirm-email-card__actions">
            <button type="button" onClick={resendVerification} disabled={resending}>
              {resending ? "Enviando..." : "Reenviar email"}
            </button>
            <button type="button" className="confirm-email-card__secondary" onClick={logout}>
              Cambiar cuenta
            </button>
            <button
              type="button"
              className="confirm-email-card__danger"
              onClick={deletePendingAccount}
              disabled={deleting}
            >
              {deleting
                ? "Eliminando..."
                : deleteArmed
                  ? "Confirmar eliminacion"
                  : "Eliminar cuenta"}
            </button>
          </div>

          {msg && <p className="confirm-email-card__msg">{msg}</p>}
          <p className="confirm-email-card__hint">
            Si ya lo confirmaste, volve a ingresar o actualiza esta pagina.
          </p>
        </div>

        <div className="confirm-email-card__visual" aria-hidden="true">
          <img src={sessionImage} alt="" />
        </div>
      </section>
    </main>
  );
}
