import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./Dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    weekAppointments: 0,
    nextAppointment: null,
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

      // Contar turnos de hoy y semana
      const today = new Date().toISOString().split('T')[0];
      let todayAppointments = 0;
      let weekAppointments = 0;
      let nextAppointment = null;

      Object.values(weeklyData).forEach(daySlots => {
        daySlots.forEach(slot => {
          if (slot.patient_id) {
            weekAppointments++;
            const slotDate = slot.start_at?.split('T')[0];
            if (slotDate === today) {
              todayAppointments++;
            }
            // Encontrar el próximo turno
            if (slot.start_at && new Date(slot.start_at) > new Date()) {
              if (!nextAppointment || new Date(slot.start_at) < new Date(nextAppointment.start_at)) {
                nextAppointment = slot;
              }
            }
          }
        });
      });

      setStats({
        totalPatients: patients.length,
        todayAppointments,
        weekAppointments,
        nextAppointment,
      });
    } catch (e) {
      console.error("Error loading dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }

  const formatNextAppointment = (appointment) => {
    if (!appointment?.start_at) return "Sin turnos próximos";

    const date = new Date(appointment.start_at);
    return new Intl.DateTimeFormat("es-UY", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard__loading">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Hero Section con imagen de fondo */}
      <section className="dashboard__hero">
        <div className="dashboard__hero-overlay">
          <div className="dashboard__hero-content">
            <h1 className="dashboard__hero-title">
              Bienvenido a tu espacio profesional
            </h1>
            <p className="dashboard__hero-subtitle">
              Cada sesión es una oportunidad para transformar vidas.
              Tu dedicación y expertise hacen la diferencia.
            </p>
            <div className="dashboard__hero-quote">
              "La psicología es el arte de ayudar a las personas a encontrar su propio camino hacia la felicidad."
            </div>
          </div>
        </div>
      </section>

      {/* Métricas principales */}
      <section className="dashboard__metrics">
        <div className="dashboard__metric-card">
          <div className="dashboard__metric-icon">👥</div>
          <div className="dashboard__metric-value">{stats.totalPatients}</div>
          <div className="dashboard__metric-label">Pacientes activos</div>
          <div className="dashboard__metric-desc">Personas que confían en tu expertise</div>
        </div>

        <div className="dashboard__metric-card">
          <div className="dashboard__metric-icon">📅</div>
          <div className="dashboard__metric-value">{stats.todayAppointments}</div>
          <div className="dashboard__metric-label">Turnos hoy</div>
          <div className="dashboard__metric-desc">Sesiones programadas para hoy</div>
        </div>

        <div className="dashboard__metric-card">
          <div className="dashboard__metric-icon">📊</div>
          <div className="dashboard__metric-value">{stats.weekAppointments}</div>
          <div className="dashboard__metric-label">Turnos esta semana</div>
          <div className="dashboard__metric-desc">Tu agenda semanal organizada</div>
        </div>
      </section>

      {/* Próximo turno destacado */}
      <section className="dashboard__next-appointment">
        <div className="dashboard__next-card">
          <h2 className="dashboard__next-title">Próximo turno</h2>
          <div className="dashboard__next-time">
            {stats.nextAppointment ? formatNextAppointment(stats.nextAppointment) : "Sin turnos próximos"}
          </div>
          {stats.nextAppointment && (
            <div className="dashboard__next-patient">
              Con {stats.nextAppointment.patient_name || `Paciente ${stats.nextAppointment.patient_id}`}
            </div>
          )}
          <button
            className="dashboard__next-btn"
            onClick={() => navigate("/appointments")}
          >
            Ver agenda completa
          </button>
        </div>
      </section>

      {/* Acciones rápidas */}
      <section className="dashboard__actions">
        <h2 className="dashboard__actions-title">Acciones rápidas</h2>
        <div className="dashboard__actions-grid">
          <button
            className="dashboard__action-btn"
            onClick={() => navigate("/appointments")}
          >
            <div className="dashboard__action-icon">📅</div>
            <div className="dashboard__action-text">Gestionar turnos</div>
          </button>

          <button
            className="dashboard__action-btn"
            onClick={() => navigate("/patients")}
          >
            <div className="dashboard__action-icon">👥</div>
            <div className="dashboard__action-text">Ver pacientes</div>
          </button>

          <button
            className="dashboard__action-btn"
            onClick={() => navigate("/availability")}
          >
            <div className="dashboard__action-icon">⏰</div>
            <div className="dashboard__action-text">Configurar disponibilidad</div>
          </button>

          <button
            className="dashboard__action-btn"
            onClick={() => navigate("/profile")}
          >
            <div className="dashboard__action-icon">⚙️</div>
            <div className="dashboard__action-text">Mi perfil</div>
          </button>
        </div>
      </section>

      {/* Mensaje motivador */}
      <section className="dashboard__motivation">
        <div className="dashboard__motivation-card">
          <div className="dashboard__motivation-icon">🌟</div>
          <h3 className="dashboard__motivation-title">Tu impacto importa</h3>
          <p className="dashboard__motivation-text">
            Cada conversación que tienes, cada sesión que realizas, contribuye a mejorar la vida de alguien.
            Tu profesión es noble y esencial para el bienestar de la comunidad.
          </p>
          <div className="dashboard__motivation-quote">
            "El psicólogo no solo trata síntomas, sino que acompaña procesos de crecimiento personal."
          </div>
        </div>
      </section>
    </div>
  );
}
