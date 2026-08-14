import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import logo from "../assets/logo 6.png";
import "./Home.css";

const videoId = "H8ZIw7-imh0";
const videoUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;
const videoPoster = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

export default function Home() {
  const [videoOpen, setVideoOpen] = useState(false);
  const isLoggedIn = Boolean(localStorage.getItem("token"));

  useEffect(() => {
    if (!videoOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setVideoOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [videoOpen]);

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
          <p className="home-page__eyebrow">Agenda clínica para terapeutas</p>
          <h1>Ordena tu práctica sin sumar más trabajo.</h1>
          <p className="home-page__intro">
            TherapyDesk reúne agenda, pacientes, disponibilidad y reservas en un solo lugar para
            que puedas trabajar con más claridad.
          </p>
          <p className="home-page__trust">
            <span aria-hidden="true" />
            Seguro, confidencial y diseñado para psicólogos.
          </p>
        </div>

        <div className="home-page__preview-group">
          <button className="home-page__preview" type="button" onClick={() => setVideoOpen(true)} aria-label="Ver demo de TherapyDesk">
            <img src={videoPoster} alt="" />
            <span className="home-page__preview-play" aria-hidden="true">
              <span className="home-page__play-icon" />
            </span>
          </button>
          <p className="home-page__preview-caption">Mira en una demo breve como TherapyDesk ordena tu agenda y tus pacientes.</p>
        </div>
      </section>

      {videoOpen && (
        <div className="home-page__video-modal" role="dialog" aria-modal="true" aria-label="Video de presentación">
          <button className="home-page__video-backdrop" type="button" onClick={() => setVideoOpen(false)} aria-label="Cerrar video" />
          <div className="home-page__video-dialog">
            <button className="home-page__video-close" type="button" onClick={() => setVideoOpen(false)} aria-label="Cerrar video">
              x
            </button>
            <iframe
              src={videoUrl}
              title="Video de presentación de TherapyDesk"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </main>
  );
}
