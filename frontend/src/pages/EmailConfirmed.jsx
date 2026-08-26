import { Link, useSearchParams } from "react-router-dom";
import logo from "../assets/logo 6.png";
import mailImage from "../assets/mail.png";
import "./EmailConfirmed.css";

export default function EmailConfirmed() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

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
              ? "Listo, ya podes entrar a tu cuenta y usar la agenda con normalidad."
              : "El link puede estar vencido, incompleto o ya haber sido usado. Inicia sesion y pedi reenviar la confirmacion."}
          </p>

          <div className="email-confirmed-card__actions">
            <Link to="/login">Ingresar</Link>
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
