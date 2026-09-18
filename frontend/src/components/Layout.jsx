import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/logo 6 baja max.png";
import api from "../services/api";
import "./layout.css";

const PAGE_HELP = {
  dashboard: ["Inicio", "Consulta tu próxima sesión, los turnos de hoy, las solicitudes por confirmar y los cobros pendientes. También puedes copiar tu enlace de reservas."],
  appointments: ["Turnos", "Elige un día y desplaza la lista de horas para consultar tus sesiones. Toca un horario disponible para crear un turno o una sesión para editarla. Los avisos al paciente se envían por email."],
  patients: ["Pacientes", "Busca o agrega pacientes, actualiza sus datos y consulta su próxima sesión, honorarios y saldo pendiente. Desde Historial puedes revisar sus sesiones y cobros registrados."],
  history: ["Historial del paciente", "Consulta las sesiones del paciente y sus estados de asistencia y pago. Los importes son un registro de cobros; la app no procesa pagos ni emite facturas."],
  availability: ["Disponibilidad", "Define los días y horarios en los que atiendes. Estos horarios permiten organizar tu disponibilidad y ofrecer espacios en tu agenda de reservas."],
  profile: ["Mi perfil", "Configura tus datos profesionales, lugares de atención y preferencias de agenda. Aquí también puedes configurar tu enlace de reservas públicas."],
};

export default function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const helpDialog = useRef(null);
  const helpKey = pathname.endsWith("/history") ? "history" : pathname.split("/")[1];
  const [helpTitle, helpText] = PAGE_HELP[helpKey] || PAGE_HELP.dashboard;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    api.get("/me")
      .then((data) => {
        if (active && data?.user?.role === "admin") {
          navigate("/admin", { replace: true });
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const closeMenu = () => setMenuOpen(false);

  const getNavLinkClass = ({ isActive }) =>
    isActive ? "layout__nav-link layout__nav-link--active" : "layout__nav-link";

  return (
    <div className={`layout${helpKey === "appointments" ? " layout--appointments" : ""}`}>
      <header className="layout__header">
        <button
          type="button"
          className="layout__hamburger"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label="Abrir menú"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="layout__brand layout__brand--header">
          <img src={logo} alt="TherapyDesk" className="layout__logo" />
          <div className="layout__title-group">
            <span className="layout__title">TherapyDesk</span>
            <span className="layout__subtitle">Terapia y agenda clínica</span>
          </div>
        </div>
        <button type="button" className="layout__info" aria-label={`Información sobre ${helpTitle}`} onClick={() => helpDialog.current?.showModal()}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" />
          </svg>
        </button>
      </header>

      <dialog ref={helpDialog} className="layout__help" aria-labelledby="page-help-title" aria-describedby="page-help-text" onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
        }
      }}>
        <h2 id="page-help-title">{helpTitle}</h2>
        <p id="page-help-text">{helpText}</p>
        <form method="dialog"><button autoFocus>Entendido</button></form>
      </dialog>

      <aside className="layout__sidebar">
        <div className="layout__brand">
          <img src={logo} alt="TherapyDesk" className="layout__logo" />
          <div className="layout__title-group">
            <span className="layout__title">TherapyDesk</span>
            <span className="layout__subtitle">Terapia y agenda clínica</span>
          </div>
        </div>

        <nav className="layout__nav">
          <NavLink to="/dashboard" className={getNavLinkClass}>
            Inicio
          </NavLink>

          <NavLink to="/appointments" className={getNavLinkClass}>
            Turnos
          </NavLink>

          <NavLink to="/patients" className={getNavLinkClass}>
            Pacientes
          </NavLink>

          <NavLink to="/availability" className={getNavLinkClass}>
            Disponibilidad
          </NavLink>

          <NavLink to="/profile" className={getNavLinkClass}>
            Mi Perfil
          </NavLink>
        </nav>

        <button type="button" className="layout__logout" onClick={logout}>
          Cerrar sesión
        </button>
      </aside>

      <main className="layout__main">
        <div className="layout__content">
          <Outlet />
        </div>
      </main>

      {menuOpen && (
        <div className="layout__drawer" role="dialog" aria-modal="true">
          <div className="layout__drawer-overlay" onClick={closeMenu} />

          <div className="layout__drawer-panel" id="mobile-navigation">
            <div className="layout__drawer-top">
              <div className="layout__brand">
                <img src={logo} alt="TherapyDesk" className="layout__logo" />
                <div className="layout__title-group">
                  <span className="layout__title">TherapyDesk</span>
                  <span className="layout__subtitle">Terapia y agenda clínica</span>
                </div>
              </div>

              <button
                type="button"
                className="layout__drawer-close"
                onClick={closeMenu}
                aria-label="Cerrar menú"
              >
                ✕
              </button>
            </div>

            <nav className="layout__nav">
              <NavLink to="/dashboard" className={getNavLinkClass} onClick={closeMenu}>
                Inicio
              </NavLink>

              <NavLink to="/appointments" className={getNavLinkClass} onClick={closeMenu}>
                Turnos
              </NavLink>

              <NavLink to="/patients" className={getNavLinkClass} onClick={closeMenu}>
                Pacientes
              </NavLink>

              <NavLink to="/availability" className={getNavLinkClass} onClick={closeMenu}>
                Disponibilidad
              </NavLink>

              <NavLink to="/profile" className={getNavLinkClass} onClick={closeMenu}>
                Mi Perfil
              </NavLink>
            </nav>

            <button type="button" className="layout__logout" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
