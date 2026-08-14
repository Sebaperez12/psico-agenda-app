import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import logo from "../assets/logo 6.png";
import "./Home.css";

export default function Home() {
  const [videoOpen, setVideoOpen] = useState(false);
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
          <h1>Ordena tu practica. Enfocate en lo que realmente importa.</h1>
          <p className="home-page__intro">
            TherapyDesk te ayuda a gestionar tu agenda, tus pacientes y tu consultorio desde un
            solo lugar. Menos tareas administrativas, mas tiempo para tus pacientes.
          </p>
          <div className="home-page__actions">
            <button
              className="home-page__button home-page__button--primary"
              type="button"
              onClick={() => setVideoOpen(true)}
            >
              <span className="home-page__play-icon" aria-hidden="true" />
              Ver video
            </button>
            <Link className="home-page__button" to="/login?mode=register">
              Registrarme
            </Link>
          </div>
          <p className="home-page__trust">
            <span aria-hidden="true" />
            Seguro, confidencial y disenado para psicologos.
          </p>
        </div>
      </section>

      {videoOpen && (
        <div className="home-page__video-modal" role="dialog" aria-modal="true" aria-label="Video de presentacion">
          <button className="home-page__video-backdrop" type="button" onClick={() => setVideoOpen(false)} aria-label="Cerrar video" />
          <div className="home-page__video-dialog">
            <button className="home-page__video-close" type="button" onClick={() => setVideoOpen(false)} aria-label="Cerrar video">
              x
            </button>
            <iframe
              src="https://www.youtube.com/embed/H8ZIw7-imh0?rel=0&playsinline=1"
              title="Video de presentacion de TherapyDesk"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </main>
  );
}
