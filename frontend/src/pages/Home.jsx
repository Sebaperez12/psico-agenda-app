import { Link, Navigate } from "react-router-dom";
import logo from "../assets/logo 6.png";
import "./Home.css";

export default function Home() {
  const isLoggedIn = Boolean(localStorage.getItem("token"));

  if (isLoggedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="home-page">
      <header className="home-page__header">
        <Link className="home-page__brand" to="/">
          <img src={logo} alt="TherapyDesk" />
          <span>TherapyDesk</span>
        </Link>
        <nav className="home-page__nav" aria-label="Acceso">
          <Link to="/login">Ingresar</Link>
          <Link className="home-page__nav-primary" to="/login?mode=register">Registrarme</Link>
        </nav>
      </header>

      <section className="home-page__main">
        <div className="home-page__hero">
          <p className="home-page__eyebrow">Agenda clinica para terapeutas</p>
          <h1>Ordenar tu practica no deberia llevarte mas trabajo.</h1>
          <p className="home-page__intro">
            Mira en el video como TherapyDesk te ayuda a ordenar turnos, pacientes y disponibilidad
            desde un lugar simple.
          </p>
          <div className="home-page__actions">
            <Link className="home-page__button home-page__button--primary" to="/login?mode=register">
              Crear mi cuenta
            </Link>
            <Link className="home-page__button" to="/login">
              Ya tengo cuenta
            </Link>
          </div>
        </div>

        <div className="home-page__video-frame" aria-label="Video de presentacion">
          <iframe
            src="https://www.youtube.com/embed/H8ZIw7-imh0"
            title="Video de presentacion de TherapyDesk"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </section>
    </main>
  );
}
