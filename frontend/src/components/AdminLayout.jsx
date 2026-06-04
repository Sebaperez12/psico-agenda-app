import { NavLink, Outlet, useNavigate } from "react-router-dom";
import logo from "../assets/logo 6.png";
import "./AdminLayout.css";

export default function AdminLayout() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const getNavLinkClass = ({ isActive }) =>
    isActive ? "admin-layout__nav-link admin-layout__nav-link--active" : "admin-layout__nav-link";

  return (
    <div className="admin-layout">
      <aside className="admin-layout__sidebar">
        <div className="admin-layout__brand">
          <img src={logo} alt="TherapyDesk" className="admin-layout__logo" />
          <div>
            <span className="admin-layout__title">TherapyDesk</span>
            <span className="admin-layout__subtitle">Administracion</span>
          </div>
        </div>

        <nav className="admin-layout__nav">
          <NavLink to="/admin" end className={getNavLinkClass}>
            Psicologos
          </NavLink>
        </nav>

        <button type="button" className="admin-layout__logout" onClick={logout}>
          Cerrar sesion
        </button>
      </aside>

      <main className="admin-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
