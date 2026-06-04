import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import dashboardImage from "../assets/dashboard.png";
import api from "../services/api";
import "./Dashboard.css";

const icons = {
  patients: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 19v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V19" />
      <path d="M9.5 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M18 11.5a2.5 2.5 0 0 0 0-5" />
      <path d="M21 19v-1a3.5 3.5 0 0 0-2.2-3.25" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <path d="M4.5 8.5h15" />
      <path d="M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M8 12h3" />
      <path d="M8 16h5" />
    </svg>
  ),
  week: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19V5" />
      <path d="M20 19V5" />
      <path d="M8 17V9" />
      <path d="M12 17V7" />
      <path d="M16 17v-5" />
      <path d="M3 19h18" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  ),
  availability: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M7 7h10" />
      <path d="M9 17h6" />
      <path d="M4 5v14" />
      <path d="M20 5v14" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  ),
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    weekAppointments: 0,
    nextAppointment: null,
    statusCounts: {
      attended: 0,
      no_show: 0,
      cancelled: 0,
    },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [patientsRes, weeklyRes] = await Promise.all([
        api.get("/patients"),
        api.get("/appointments/weekly-preview"),
      ]);

      const patients = patientsRes.patients || [];
      const weeklyData = weeklyRes.weekly_preview || {};
      const today = new Date().toISOString().split("T")[0];
      let todayAppointments = 0;
      let weekAppointments = 0;
      let nextAppointment = null;
      const statusCounts = {
        attended: 0,
        no_show: 0,
        cancelled: 0,
      };

      Object.values(weeklyData).forEach((daySlots) => {
        daySlots.forEach((slot) => {
          if (!slot.patient_id) return;

          weekAppointments++;
          if (slot.status in statusCounts) {
            statusCounts[slot.status]++;
          }
          const slotDate = slot.start_at?.split("T")[0];
          if (slotDate === today) {
            todayAppointments++;
          }

          if (slot.start_at && new Date(slot.start_at) > new Date()) {
            if (!nextAppointment || new Date(slot.start_at) < new Date(nextAppointment.start_at)) {
              nextAppointment = slot;
            }
          }
        });
      });

      setStats({
        totalPatients: patients.length,
        todayAppointments,
        weekAppointments,
        nextAppointment,
        statusCounts,
      });
    } catch (e) {
      console.error("Error loading dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }

  function formatNextAppointment(appointment) {
    if (!appointment?.start_at) return "Sin turnos proximos";

    const date = new Date(appointment.start_at);
    return new Intl.DateTimeFormat("es-UY", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard__loading">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <section className="dashboard__hero">
        <img className="dashboard__hero-cover" src={dashboardImage} alt="" aria-hidden="true" />
        <div className="dashboard__hero-content">
          <span className="dashboard__eyebrow">Panel general</span>
          <h1 className="dashboard__hero-title">Inicio</h1>
          <p className="dashboard__hero-subtitle">
            Resumen de agenda, pacientes y actividad de la semana.
          </p>
        </div>
      </section>

      <section className="dashboard__metrics">
        <div className="dashboard__metric-card">
          <div className="dashboard__metric-top">
            <div className="dashboard__icon">{icons.patients}</div>
            <div className="dashboard__metric-value">{stats.totalPatients}</div>
          </div>
          <div className="dashboard__metric-line" />
          <div className="dashboard__metric-label">Pacientes activos</div>
          <div className="dashboard__metric-desc">Total cargado en la agenda</div>
        </div>

        <div className="dashboard__metric-card">
          <div className="dashboard__metric-top">
            <div className="dashboard__icon">{icons.calendar}</div>
            <div className="dashboard__metric-value">{stats.todayAppointments}</div>
          </div>
          <div className="dashboard__metric-line" />
          <div className="dashboard__metric-label">Turnos hoy</div>
          <div className="dashboard__metric-desc">Sesiones programadas para hoy</div>
        </div>

        <div className="dashboard__metric-card">
          <div className="dashboard__metric-top">
            <div className="dashboard__icon">{icons.week}</div>
            <div className="dashboard__metric-value">{stats.weekAppointments}</div>
          </div>
          <div className="dashboard__metric-line" />
          <div className="dashboard__metric-label">Turnos esta semana</div>
          <div className="dashboard__metric-desc">Reservas visibles esta semana</div>
        </div>
      </section>

      <section className="dashboard__grid">
        <div className="dashboard__next-card">
          <div className="dashboard__section-head">
            <div className="dashboard__icon">{icons.clock}</div>
            <h2 className="dashboard__section-title">Proximo turno</h2>
          </div>
          <div className="dashboard__next-time">
            {stats.nextAppointment ? formatNextAppointment(stats.nextAppointment) : "Sin turnos proximos"}
          </div>
          {stats.nextAppointment && (
            <div className="dashboard__next-patient">
              Con {stats.nextAppointment.patient_name || `Paciente ${stats.nextAppointment.patient_id}`}
            </div>
          )}
          <button className="dashboard__primary-btn" onClick={() => navigate("/appointments")}>
            Ver agenda completa
            <span className="dashboard__button-icon">{icons.arrow}</span>
          </button>
        </div>

        <div className="dashboard__actions">
          <div className="dashboard__section-head">
            <div className="dashboard__icon">{icons.arrow}</div>
            <h2 className="dashboard__section-title">Accesos rapidos</h2>
          </div>
          <div className="dashboard__actions-grid">
            <button className="dashboard__action-btn" onClick={() => navigate("/appointments")}>
              <span className="dashboard__action-icon">{icons.calendar}</span>
              <span>Gestionar turnos</span>
            </button>
            <button className="dashboard__action-btn" onClick={() => navigate("/patients")}>
              <span className="dashboard__action-icon">{icons.patients}</span>
              <span>Ver pacientes</span>
            </button>
            <button className="dashboard__action-btn" onClick={() => navigate("/availability")}>
              <span className="dashboard__action-icon">{icons.availability}</span>
              <span>Disponibilidad</span>
            </button>
            <button className="dashboard__action-btn" onClick={() => navigate("/profile")}>
              <span className="dashboard__action-icon">{icons.profile}</span>
              <span>Mi perfil</span>
            </button>
          </div>
        </div>
      </section>

      <section className="dashboard__status-card">
        <div className="dashboard__section-head">
          <div className="dashboard__icon">{icons.week}</div>
          <h2 className="dashboard__section-title">Estados de la semana</h2>
        </div>
        <div className="dashboard__status-grid">
          <div className="dashboard__status-item dashboard__status-item--attended">
            <span>{stats.statusCounts.attended}</span>
            <strong>Atendidos</strong>
          </div>
          <div className="dashboard__status-item dashboard__status-item--no-show">
            <span>{stats.statusCounts.no_show}</span>
            <strong>Ausencias</strong>
          </div>
          <div className="dashboard__status-item dashboard__status-item--cancelled">
            <span>{stats.statusCounts.cancelled}</span>
            <strong>Cancelados</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
