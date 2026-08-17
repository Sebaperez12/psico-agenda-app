import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import dashboardImage from "../assets/dashboard.png";
import logo from "../assets/logo 6.png";
import "./Home.css";

const videoId = "H8ZIw7-imh0";
const videoUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;

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
          <div className="home-page__actions">
            <Link className="home-page__cta home-page__cta--primary" to="/login?mode=register">
              Crear cuenta
            </Link>
            <Link className="home-page__cta" to="/login">
              Ya tengo cuenta
            </Link>
          </div>
          <p className="home-page__trust">
            <span aria-hidden="true" />
            Seguro, confidencial y diseñado para psicólogos.
          </p>
        </div>

        <div className="home-page__preview-group">
          <button className="home-page__preview" type="button" onClick={() => setVideoOpen(true)} aria-label="Ver demo de TherapyDesk">
            <img src={dashboardImage} alt="" />
            <span className="home-page__preview-play" aria-hidden="true">
              <span className="home-page__play-icon" />
            </span>
          </button>
          <p className="home-page__preview-caption">Mira en una demo breve como TherapyDesk ordena tu agenda y tus pacientes.</p>
        </div>
      </section>

      <section className="home-page__info" aria-label="Información de TherapyDesk">
        <div className="home-page__section-heading">
          <p className="home-page__eyebrow">Todo en un mismo espacio</p>
          <h2>Una herramienta simple para gestionar tu consulta diaria.</h2>
          <p>
            Pensada para profesionales que necesitan ver su semana, registrar pacientes y compartir
            disponibilidad sin perder tiempo entre planillas, mensajes y recordatorios manuales.
          </p>
        </div>

        <div className="home-page__features">
          <article className="home-page__feature">
            <span>01</span>
            <h3>Agenda clara</h3>
            <p>
              Visualiza turnos por día y semana, crea citas en pocos pasos y mantén cada horario
              organizado con estado, paciente y modalidad.
            </p>
          </article>
          <article className="home-page__feature">
            <span>02</span>
            <h3>Pacientes centralizados</h3>
            <p>
              Guarda datos de contacto, historial de sesiones y notas importantes para encontrar
              rápido la información que necesitas antes de cada encuentro.
            </p>
          </article>
          <article className="home-page__feature">
            <span>03</span>
            <h3>Reservas más simples</h3>
            <p>
              Configura tu disponibilidad y permite que tus pacientes soliciten horarios de manera
              ordenada, reduciendo idas y vueltas por mensaje.
            </p>
          </article>
        </div>
      </section>

      <section className="home-page__workflow" aria-label="Cómo funciona">
        <div>
          <p className="home-page__eyebrow">Flujo de trabajo</p>
          <h2>De la disponibilidad al seguimiento, sin ruido.</h2>
        </div>
        <ol className="home-page__steps">
          <li>
            <strong>Configura tus horarios.</strong>
            Define días, franjas y lugares de atención para que el sistema trabaje con tu agenda real.
          </li>
          <li>
            <strong>Organiza cada turno.</strong>
            Asocia pacientes, modalidades y detalles clínicos desde una vista preparada para revisar rápido.
          </li>
          <li>
            <strong>Da seguimiento.</strong>
            Consulta el historial del paciente y mantén tus registros unidos a la evolución de cada caso.
          </li>
        </ol>
      </section>

      <section className="home-page__closing">
        <div>
          <p className="home-page__eyebrow">Para consultas profesionales</p>
          <h2>Menos administración, más foco en la atención.</h2>
        </div>
        <Link className="home-page__cta home-page__cta--primary" to="/login?mode=register">
          Empezar ahora
        </Link>
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
