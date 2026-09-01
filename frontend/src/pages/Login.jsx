import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import logo from "../assets/logo 6.png";
import portada from "../assets/PORTADA.png";
import api from "../services/api";
import "./Login.css";

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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
  const [showPassword, setShowPassword] = useState(false);
  const nav = useNavigate();

  const isRegister = mode === "register";

  useEffect(() => {
    localStorage.removeItem("token");
  }, []);

  const doRegister = async () => {
    setMsg("");
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setMsg("Ingresa un email valido");
      return;
    }

    setLoading(true);
    localStorage.removeItem("token");
    try {
      const data = await api.post("/auth/register", {
        email: normalizedEmail,
        password,
        full_name: fullName,
        professional_title: professionalTitle,
        description,
        office_address: officeAddress,
      });
      localStorage.setItem("token", data.access_token);
      if (data?.user?.role === "admin") {
        nav("/admin");
        return;
      }
      if (!data?.user?.email_verified) {
        nav("/confirm-email");
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
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setMsg("Ingresa un email valido");
      return;
    }

    setLoading(true);
    localStorage.removeItem("token");
    try {
      const data = await api.post("/auth/login", { email: normalizedEmail, password });
      localStorage.setItem("token", data.access_token);
      if (data?.user?.role === "admin") {
        nav("/admin");
        return;
      }
      if (!data?.user?.email_verified) {
        nav("/confirm-email");
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
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setMsg("Ingresa un email valido para solicitar recuperacion");
      return;
    }

    setLoading(true);
    try {
      const data = await api.post("/auth/forgot-password", { email: normalizedEmail });
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
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck="false"
            />
            <div className="login-card__password-field">
              <input
                className="login-card__field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                type={showPassword ? "text" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
              <button
                type="button"
                className={`login-card__password-toggle${showPassword ? " login-card__password-toggle--active" : ""}`}
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                title={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
              >
                <span aria-hidden="true" />
              </button>
            </div>
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
