import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import logo from "../assets/logo 6.png";
import "./layout.css";

export default function Layout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const closeMenu = () => setMenuOpen(false);

  const getNavLinkClass = ({ isActive }) =>
    isActive ? "layout__nav-link layout__nav-link--active" : "layout__nav-link";

  return (
    <div className="layout">
      <header className="layout__header">
        <button
          type="button"
          className="layout__hamburger"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
        >
          ☰
        </button>

        <div className="layout__brand layout__brand--header">
          <img src={logo} alt="TherapyDesk" className="layout__logo" />
          <div className="layout__title-group">
            <span className="layout__title">TherapyDesk</span>
            <span className="layout__subtitle">Terapia y agenda clínica</span>
          </div>
        </div>
      </header>

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

          <div className="layout__drawer-panel">
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
