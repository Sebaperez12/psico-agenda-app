import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import logo from "../assets/logo 6.png";
import portada from "../assets/PORTADA.png";
import api from "../services/api";
import "./Login.css";

export default function Login() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get("mode") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [description, setDescription] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const isRegister = mode === "register";

  const doRegister = async () => {
    setMsg("");
    setLoading(true);
    try {
      const data = await api.post("/auth/register", {
        email,
        password,
        full_name: fullName,
        professional_title: professionalTitle,
        description,
        office_address: officeAddress,
      });
      localStorage.setItem("token", data.access_token);
      if (!data?.user?.email_verified) {
        nav("/confirm-email");
        return;
      }
      if (data?.user?.role === "admin") {
        nav("/admin");
        return;
      }
      nav("/appointments");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const doLogin = async () => {
    setMsg("");
    setLoading(true);
    try {
      const data = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.access_token);
      if (!data?.user?.email_verified) {
        nav("/confirm-email");
        return;
      }
      if (data?.user?.role === "admin") {
        nav("/admin");
        return;
      }
      nav(data?.user?.has_profile ? "/appointments" : "/profile");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordRecovery = async () => {
    setMsg("");
    if (!email.trim()) {
      setMsg("Ingresa tu email para solicitar recuperacion");
      return;
    }

    setLoading(true);
    try {
      const data = await api.post("/auth/forgot-password", { email });
      setMsg(data.msg);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <Link className="login-page__home-link" to="/" aria-label="Volver al inicio">
        ←
      </Link>
      <section className="login-page__visual" aria-label="Consultorio terapeutico">
        <img src={portada} alt="" className="login-page__image" />
        <div className="login-page__visual-shade" />
        <div className="login-page__visual-copy">
          <span className="login-page__eyebrow">Agenda clinica</span>
          <h2>Una forma mas clara de ordenar tu practica.</h2>
          <p>Turnos, pacientes y recordatorios en un espacio pensado para el trabajo terapeutico.</p>
        </div>
      </section>

      <section className="login-page__panel" aria-label="Acceso a TherapyDesk">
        <div className="login-card">
          <div className="login-card__brand">
            <img src={logo} alt="TherapyDesk" className="login-card__logo" />
            <div>
              <h1>TherapyDesk</h1>
              <p>{isRegister ? "Registro del psicologo" : "Ingreso a la agenda"}</p>
            </div>
          </div>

          <div className="login-card__form">
            {isRegister && (
              <>
                <input
                  className="login-card__field"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nombre y apellido"
                />
                <input
                  className="login-card__field"
                  value={professionalTitle}
                  onChange={(e) => setProfessionalTitle(e.target.value)}
                  placeholder="Titulo profesional"
                />
              </>
            )}

            <input
              className="login-card__field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
            />
            <input
              className="login-card__field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              type="password"
            />
            {!isRegister && (
              <button
                type="button"
                className="login-card__forgot"
                onClick={requestPasswordRecovery}
                disabled={loading}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}

            {isRegister && (
              <>
                <textarea
                  className="login-card__field login-card__textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripcion profesional"
                  rows="4"
                />
                <input
                  className="login-card__field"
                  value={officeAddress}
                  onChange={(e) => setOfficeAddress(e.target.value)}
                  placeholder="Direccion del consultorio"
                />
              </>
            )}

            <div className="login-card__actions">
              <button
                type="button"
                className="login-card__action login-card__action--login"
                onClick={isRegister ? () => setMode("login") : doLogin}
                disabled={loading && !isRegister}
              >
                {loading && !isRegister ? "Procesando..." : "Ingresar"}
              </button>
              <button
                type="button"
                className="login-card__action login-card__action--register"
                onClick={isRegister ? doRegister : () => setMode("register")}
                disabled={loading && isRegister}
              >
                {loading && isRegister ? "Procesando..." : "Registrarme"}
              </button>
            </div>

            {msg && <p className="login-card__msg">{msg}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}
