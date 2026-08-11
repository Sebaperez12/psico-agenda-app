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
            TherapyDesk reune turnos, pacientes, disponibilidad, reservas y pendientes en un lugar simple.
            La idea es que puedas mirar tu dia y entender que necesita atencion.
          </p>
          <div className="home-page__actions">
            <Link className="home-page__button home-page__button--primary" to="/login?mode=register">
              Crear mi cuenta
            </Link>
            <Link className="home-page__button" to="/login">
              Ya tengo cuenta
            </Link>
            <a className="home-page__button" href="#video">
              Ver video
            </a>
          </div>
        </div>

        <div className="home-page__side">
          <p className="home-page__note">
            Hoy es una agenda para tu consultorio. La idea de fondo es construir, de a poco,
            un espacio compartido para terapeutas que buscan trabajar con mas claridad.
          </p>

          <section className="home-page__grid" aria-label="Funcionalidades">
            <article>
              <h3>Agenda</h3>
              <p>Turnos, estados y horarios de la semana.</p>
            </article>
            <article>
              <h3>Pacientes</h3>
              <p>Datos utiles e historial en un mismo lugar.</p>
            </article>
            <article>
              <h3>Reservas</h3>
              <p>Un enlace publico dentro de tu disponibilidad.</p>
            </article>
            <article>
              <h3>Pendientes</h3>
              <p>Confirmaciones y cobros visibles sin mezclar todo.</p>
            </article>
          </section>

          <p className="home-page__closing">
            Una herramienta individual, pensada para crecer hacia comunidad.
          </p>
        </div>
      </section>
    </main>
  );
}
