import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo 3.png";
import api from "../services/api";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("test@mail.com");
  const [password, setPassword] = useState("123456");
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
      setMsg("La foto debe ser una imagen válida");
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
      nav(data?.user?.has_profile ? "/appointments" : "/profile");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "40px auto",
        padding: 24,
        fontFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.88)",
          border: "1px solid var(--color-border)",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 18px 40px var(--color-shadow)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <img
            src={logo}
            alt="TherapyDesk"
            style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }}
          />
          <div>
            <h1 style={{ margin: 0, color: "var(--color-text-strong)" }}>TherapyDesk</h1>
            <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)" }}>
              {isRegister ? "Registro del psicólogo" : "Ingreso a la agenda"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => setMode("login")}
            style={{
              flex: 1,
              background: !isRegister
                ? "linear-gradient(135deg, var(--color-primary), var(--color-primary-strong))"
                : "#fff",
              color: !isRegister ? "#fff" : "var(--color-text)",
            }}
          >
            Ingresar
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            style={{
              flex: 1,
              background: isRegister
                ? "linear-gradient(135deg, var(--color-primary), var(--color-primary-strong))"
                : "#fff",
              color: isRegister ? "#fff" : "var(--color-text)",
            }}
          >
            Registrarme
          </button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {isRegister && (
            <>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nombre y apellido"
              />
              <input
                value={professionalTitle}
                onChange={(e) => setProfessionalTitle(e.target.value)}
                placeholder="Título profesional"
              />
            </>
          )}

          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            type="password"
          />

          {isRegister && (
            <>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción profesional"
                rows="4"
              />
              <input
                value={officeAddress}
                onChange={(e) => setOfficeAddress(e.target.value)}
                placeholder="Dirección del consultorio"
              />
              <label
                style={{
                  display: "grid",
                  gap: 8,
                  color: "var(--color-text)",
                  fontWeight: 600,
                }}
              >
                Foto profesional
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
              </label>

              {photoDataUrl && (
                <img
                  src={photoDataUrl}
                  alt="Vista previa"
                  style={{ width: 96, height: 96, borderRadius: 18, objectFit: "cover" }}
                />
              )}
            </>
          )}

          <button
            type="button"
            onClick={isRegister ? doRegister : doLogin}
            disabled={loading}
            style={{
              background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-strong))",
              color: "#fff",
            }}
          >
            {loading ? "Procesando..." : isRegister ? "Crear cuenta y perfil" : "Ingresar"}
          </button>

          {msg && (
            <p style={{ margin: 0, color: "#af4444", fontWeight: 700 }}>
              {msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
