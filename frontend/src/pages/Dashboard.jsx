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
  link: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 4.3 2.8 17.5A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.5L13.7 4.3a2 2 0 0 0-3.4 0Z" />
    </svg>
  ),
};

function getLocalDateKey(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("es-UY", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

function formatTime(date) {
  return new Intl.DateTimeFormat("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatAppointmentDate(date) {
  return new Intl.DateTimeFormat("es-UY", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  }).format(new Date(date));
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    weekAppointments: 0,
    pendingRequestsTotal: 0,
    pendingRequests: [],
    availableSlots: 0,
    billingDue: 0,
    patientsWithDebt: 0,
    weekDays: [],
    nextAppointment: null,
    nextAvailableSlot: null,
    publicBooking: {
      enabled: false,
      slug: "",
      link: "",
    },
    statusCounts: {
      attended: 0,
      no_show: 0,
      cancelled: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [dashboardMsg, setDashboardMsg] = useState("");

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [patientsResult, weeklyResult, availabilityResult, appointmentsResult, profileResult] = await Promise.allSettled([
        api.get("/patients"),
        api.get("/appointments/weekly-preview"),
        api.get("/availability/weekly-preview"),
        api.get("/appointments"),
        api.get("/profile"),
      ]);

      const patients = patientsResult.status === "fulfilled" ? patientsResult.value.patients || [] : [];
      const weeklyData = weeklyResult.status === "fulfilled" ? weeklyResult.value.weekly_preview || {} : {};
      const availabilityData = availabilityResult.status === "fulfilled" ? availabilityResult.value.weekly_preview || {} : {};
      const appointments = appointmentsResult.status === "fulfilled" ? appointmentsResult.value.appointments || [] : [];
      const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
      const patientsById = patients.reduce((map, patient) => {
        map[patient.id] = patient;
        return map;
      }, {});
      const billingDue = patients.reduce((total, patient) => {
        return total + Number(patient.billing_summary?.balance_due || 0);
      }, 0);
      const patientsWithDebt = patients.filter((patient) => Number(patient.billing_summary?.balance_due || 0) > 0).length;
      const now = new Date();
      const today = getLocalDateKey(now);
      let todayAppointments = 0;
      let weekAppointments = 0;
      let nextAppointment = null;
      let nextAvailableSlot = null;
      const statusCounts = {
        attended: 0,
        no_show: 0,
        cancelled: 0,
      };
      const weekDays = [];

      Object.entries(weeklyData).forEach(([dayKey, daySlots]) => {
        let dayCount = 0;
        daySlots.forEach((slot) => {
          if (!slot.patient_id || slot.status === "cancelled") return;

          dayCount++;
          weekAppointments++;
          if (slot.status in statusCounts) {
            statusCounts[slot.status]++;
          }
          const slotDate = slot.start_at ? getLocalDateKey(slot.start_at) : dayKey;
          if (slotDate === today) {
            todayAppointments++;
          }

          if (slot.start_at && new Date(slot.start_at) > now) {
            if (!nextAppointment || new Date(slot.start_at) < new Date(nextAppointment.start_at)) {
              nextAppointment = slot;
            }
          }
        });
        weekDays.push({ date: dayKey, count: dayCount });
      });

      const availableSlots = Object.values(availabilityData).reduce((total, daySlots) => {
        return total + daySlots.filter((slot) => {
          if (slot.status !== "free" || !slot.start_at) return false;
          const slotDate = new Date(slot.start_at);
          if (slotDate <= now) return false;
          if (!nextAvailableSlot || slotDate < new Date(nextAvailableSlot.start_at)) {
            nextAvailableSlot = slot;
          }
          return true;
        }).length;
      }, 0);

      const pendingRequests = appointments
        .filter((appointment) => appointment.status === "pending" && appointment.start_at && new Date(appointment.start_at) >= now)
        .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
      const visiblePendingRequests = pendingRequests
        .slice(0, 4)
        .map((appointment) => ({
          ...appointment,
          patient_name: patientsById[appointment.patient_id]?.full_name || "Paciente",
        }));

      const bookingSlug = profile?.booking_slug || "";
      setStats({
        totalPatients: patients.length,
        todayAppointments,
        weekAppointments,
        pendingRequestsTotal: pendingRequests.length,
        pendingRequests: visiblePendingRequests,
        availableSlots,
        billingDue,
        patientsWithDebt,
        weekDays,
        nextAppointment,
        nextAvailableSlot,
        publicBooking: {
          enabled: !!profile?.public_booking_enabled,
          slug: bookingSlug,
          link: bookingSlug ? `${window.location.origin}/reservar/${bookingSlug}` : "",
        },
        statusCounts,
      });
    } catch (e) {
      console.error("Error loading dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }

  function formatNextAppointment(appointment) {
    if (!appointment?.start_at) return "Sin turnos próximos";

    const date = new Date(appointment.start_at);
    return new Intl.DateTimeFormat("es-UY", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  async function copyBookingLink() {
    if (!stats.publicBooking.link) return;
    try {
      await navigator.clipboard.writeText(stats.publicBooking.link);
      setDashboardMsg("Link copiado");
    } catch (e) {
      console.error("No se pudo copiar el link:", e);
    }
  }

  function openBookingLink() {
    if (!stats.publicBooking.link) return;
    window.open(stats.publicBooking.link, "_blank", "noopener,noreferrer");
  }

  async function confirmPendingRequest(appointmentId) {
    if (!appointmentId || confirmingId) return;
    setConfirmingId(appointmentId);
    setDashboardMsg("");
    try {
      await api.patch(`/appointments/${appointmentId}`, { status: "scheduled" });
      try {
        await api.post(`/appointments/${appointmentId}/notify`, { method: "email" });
        setDashboardMsg("Turno confirmado y email enviado");
      } catch (notifyError) {
        console.error(notifyError);
        setDashboardMsg("Turno confirmado. No se pudo enviar el email.");
      }
      await loadDashboardData();
    } catch (e) {
      console.error(e);
      setDashboardMsg(e.message || "No se pudo confirmar el turno");
    } finally {
      setConfirmingId(null);
    }
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
            Lo importante del consultorio para resolver hoy.
          </p>
        </div>
      </section>

      <section className="dashboard__video-card" aria-label="Video de presentacion">
        <iframe
          src="https://www.youtube.com/embed/H8ZIw7-imh0"
          title="Video de presentacion de TherapyDesk"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </section>

      <section className="dashboard__metrics">
        <div className="dashboard__metric-card">
          <div className="dashboard__metric-top">
            <div className="dashboard__icon">{icons.patients}</div>
            <div className="dashboard__metric-value">{stats.pendingRequestsTotal}</div>
          </div>
          <div className="dashboard__metric-line" />
          <div className="dashboard__metric-label">Solicitudes pendientes</div>
          <div className="dashboard__metric-desc">Turnos que esperan confirmación</div>
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
            <div className="dashboard__metric-value dashboard__metric-value--money">{formatMoney(stats.billingDue)}</div>
          </div>
          <div className="dashboard__metric-line" />
          <div className="dashboard__metric-label">Pendiente de cobro</div>
          <div className="dashboard__metric-desc">{stats.patientsWithDebt} pacientes con saldo pendiente</div>
        </div>
      </section>

      <section className="dashboard__grid">
        <div className={`dashboard__next-card${stats.nextAppointment ? "" : " dashboard__next-card--empty"}`}>
          <div className="dashboard__section-head">
            <div className="dashboard__icon">{icons.clock}</div>
            <h2 className="dashboard__section-title">Próximo turno</h2>
          </div>
          {stats.nextAppointment ? (
            <div className="dashboard__next-feature">
              <div className="dashboard__next-illustration">{icons.calendar}</div>
              <div className="dashboard__next-detail">
                <div className="dashboard__next-date">
                  {formatAppointmentDate(stats.nextAppointment.start_at)}
                </div>
                <div className="dashboard__next-hour">
                  {formatTime(stats.nextAppointment.start_at)}
                </div>
                <div className="dashboard__next-patient">
                  Con {stats.nextAppointment.patient_name || `Paciente ${stats.nextAppointment.patient_id}`}
                </div>
              </div>
            </div>
          ) : (
            <div className="dashboard__next-empty">
              <div className="dashboard__next-illustration">{icons.calendar}</div>
              <div>
                <div className="dashboard__next-time">{formatNextAppointment(stats.nextAppointment)}</div>
                <div className="dashboard__next-patient">No hay sesiones próximas cargadas.</div>
              </div>
            </div>
          )}
          <button className="dashboard__primary-btn" onClick={() => navigate("/appointments")}>
            Ver agenda completa
            <span className="dashboard__button-icon">{icons.arrow}</span>
          </button>
        </div>

        <div className="dashboard__pending-card">
          <div className="dashboard__section-head">
            <div className="dashboard__icon">{icons.alert}</div>
            <h2 className="dashboard__section-title">Por confirmar</h2>
          </div>
          {stats.pendingRequests.length > 0 ? (
            <div className="dashboard__request-list">
              {stats.pendingRequests.map((request) => (
                <div
                  className="dashboard__request-row"
                  key={request.id}
                >
                  <button
                    type="button"
                    className="dashboard__request-info"
                    onClick={() => navigate("/appointments")}
                  >
                    <strong>{formatShortDate(request.start_at)}</strong>
                    <small>{request.patient_name}</small>
                  </button>
                  <em>{formatTime(request.start_at)}</em>
                  <button
                    type="button"
                    className="dashboard__confirm-btn"
                    onClick={() => confirmPendingRequest(request.id)}
                    disabled={confirmingId === request.id}
                  >
                    {confirmingId === request.id ? "..." : "Confirmar"}
                  </button>
                </div>
              ))}
              {stats.pendingRequestsTotal > stats.pendingRequests.length && (
                <p className="dashboard__hint">
                  Hay {stats.pendingRequestsTotal - stats.pendingRequests.length} solicitudes más en agenda.
                </p>
              )}
            </div>
          ) : (
            <p className="dashboard__empty-text">No hay solicitudes pendientes.</p>
          )}
        </div>
      </section>

      <section className="dashboard__insights">
        <div className="dashboard__week-card">
          <div className="dashboard__section-head">
            <div className="dashboard__icon">{icons.week}</div>
            <h2 className="dashboard__section-title">Semana</h2>
          </div>
          <div className="dashboard__week-strip">
            {stats.weekDays.map((day) => (
              <div
                className={`dashboard__week-day${day.count > 0 ? " dashboard__week-day--busy" : ""}`}
                key={day.date}
              >
                <span>{formatShortDate(`${day.date}T12:00:00`).split(" ")[0]}</span>
                <strong>{day.count}</strong>
              </div>
            ))}
          </div>
          <p className="dashboard__hint">
            {stats.weekAppointments} turnos cargados esta semana.
          </p>
        </div>

        <div className="dashboard__booking-card">
          <div className="dashboard__section-head">
            <div className="dashboard__icon">{icons.link}</div>
            <h2 className="dashboard__section-title">Link de reservas</h2>
          </div>
          {stats.publicBooking.enabled && stats.publicBooking.link ? (
            <>
              <div className="dashboard__booking-link">{stats.publicBooking.link}</div>
              <div className="dashboard__button-row">
                <button className="dashboard__secondary-btn" type="button" onClick={copyBookingLink}>
                  Copiar link
                </button>
                <button className="dashboard__secondary-btn" type="button" onClick={openBookingLink}>
                  Abrir link
                </button>
                <button className="dashboard__secondary-btn" type="button" onClick={() => navigate("/profile")}>
                  Configurar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="dashboard__empty-text">Tu agenda pública no está activa.</p>
              <button className="dashboard__secondary-btn" type="button" onClick={() => navigate("/profile")}>
                Activar desde perfil
              </button>
            </>
          )}
        </div>
      </section>

      {dashboardMsg && <p className="dashboard__message">{dashboardMsg}</p>}

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
