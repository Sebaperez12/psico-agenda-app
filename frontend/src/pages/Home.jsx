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

      <section className="home-page__hero">
        <p className="home-page__eyebrow">Agenda clinica para terapeutas</p>
        <h1>Un lugar tranquilo para ordenar tu practica.</h1>
        <p className="home-page__intro">
          TherapyDesk acompana el trabajo cotidiano de psicologos y terapeutas: turnos, pacientes,
          disponibilidad, reservas y pequenos recordatorios administrativos en un mismo espacio.
        </p>
        <div className="home-page__actions">
          <Link className="home-page__button home-page__button--primary" to="/login?mode=register">
            Crear mi cuenta
          </Link>
          <Link className="home-page__button" to="/login">
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      <section className="home-page__letter">
        <h2>Para que sirve</h2>
        <p>
          La practica clinica tiene muchas tareas pequenas que no siempre se ven: confirmar horarios,
          recordar pagos, revisar la disponibilidad de la semana, encontrar rapido los datos de un
          paciente o compartir un enlace para reservar.
        </p>
        <p>
          TherapyDesk esta pensado para reunir esas tareas sin convertir tu consultorio en una oficina
          llena de sistemas. La idea es simple: menos lugares donde mirar, menos pasos repetidos y mas
          claridad antes de empezar el dia.
        </p>
      </section>

      <section className="home-page__grid" aria-label="Funcionalidades">
        <article>
          <h3>Agenda semanal</h3>
          <p>Organiza turnos, estados, pacientes y horarios disponibles desde una vista clara.</p>
        </article>
        <article>
          <h3>Pacientes</h3>
          <p>Guarda datos de contacto, notas utiles e historial de turnos sin perder el hilo.</p>
        </article>
        <article>
          <h3>Reservas online</h3>
          <p>Comparte un enlace para que puedan elegir horarios dentro de tu disponibilidad.</p>
        </article>
        <article>
          <h3>Cobros y pendientes</h3>
          <p>Ten presente que queda por confirmar o cobrar, sin mezclarlo con la parte clinica.</p>
        </article>
      </section>

      <section className="home-page__closing">
        <p>
          No busca reemplazar tu manera de trabajar. Busca darte una mesa mas despejada para sostenerla.
        </p>
        <Link className="home-page__button home-page__button--primary" to="/login?mode=register">
          Empezar
        </Link>
      </section>
    </main>
  );
}
