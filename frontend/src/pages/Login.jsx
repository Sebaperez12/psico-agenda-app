import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo 6.png";
import portada from "../assets/PORTADA.png";
import api from "../services/api";
import "./Login.css";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [description, setDescription] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const isRegister = mode === "register";

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMsg("La foto debe ser una imagen valida");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(String(reader.result || ""));
    };
    reader.onerror = () => {
      setMsg("No se pudo leer la foto");
    };
    reader.readAsDataURL(file);
  };

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
        photo_data_url: photoDataUrl || null,
      });
      localStorage.setItem("token", data.access_token);
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
                <label className="login-card__file">
                  Foto profesional
                  <input type="file" accept="image/*" onChange={handlePhotoChange} />
                </label>

                {photoDataUrl && (
                  <img src={photoDataUrl} alt="Vista previa" className="login-card__preview" />
                )}
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
