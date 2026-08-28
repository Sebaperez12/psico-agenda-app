import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo 6.png";
import mailImage from "../assets/mail.png";
import "./EmailConfirmed.css";

export default function EmailConfirmed() {
  const params = useMemo(() => {
    const rawParams = window.location.hash ? window.location.hash.slice(1) : window.location.search.slice(1);
    return new URLSearchParams(rawParams);
  }, []);
  const isSuccess = params.get("status") === "success";
  const accessToken = params.get("access_token");
  const nextPath = params.get("next") || "/appointments";
  const [hasSession, setHasSession] = useState(() => Boolean(localStorage.getItem("token")));

  useEffect(() => {
    if (!isSuccess || !accessToken) return;

    localStorage.setItem("token", accessToken);
    setHasSession(true);
    window.history.replaceState(null, "", `${window.location.pathname}?status=success`);
  }, [accessToken, isSuccess]);

  return (
    <main className="email-confirmed-page">
      <section className="email-confirmed-card" aria-labelledby="email-confirmed-title">
        <div className="email-confirmed-card__visual" aria-hidden="true">
          <img src={mailImage} alt="" />
        </div>

        <div className="email-confirmed-card__copy">
          <Link className="email-confirmed-card__brand" to="/">
            <img src={logo} alt="TherapyDesk" />
            <span>TherapyDesk</span>
          </Link>

          <p className="email-confirmed-card__eyebrow">
            {isSuccess ? "Email confirmado" : "Link no disponible"}
          </p>
          <h1 id="email-confirmed-title">
            {isSuccess ? "Tu email ya quedo confirmado" : "No pudimos confirmar este link"}
          </h1>
          <p className="email-confirmed-card__text">
            {isSuccess
              ? "Listo, ya podes abrir tu cuenta y usar la agenda con normalidad."
              : "El link puede estar vencido, incompleto o ya haber sido usado. Inicia sesion y pedi reenviar la confirmacion."}
          </p>

          <div className="email-confirmed-card__actions">
            <Link to={isSuccess && hasSession ? nextPath : "/login"}>
              {isSuccess && hasSession ? "Abrir mi cuenta" : "Ingresar"}
            </Link>
            {!isSuccess && (
              <Link className="email-confirmed-card__secondary" to="/confirm-email">
                Reenviar email
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
