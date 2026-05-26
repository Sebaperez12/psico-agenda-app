import { useEffect, useMemo, useState } from "react";
import "./Appointments.css";
import {
  getLocalDateKey,
  formatDateForInput,
  getTimeForInput,
  getWeekDays,
  getWeekLabel,
} from "../utils/dateUtils";
import { getDurationMinutes } from "../utils/appointmentUtils";
import AppointmentBlock from "../components/AppointmentBlock";
import AppointmentPanel from "../components/AppointmentPanel";
import { DEFAULT_END_HOUR, DEFAULT_START_HOUR, HOUR_HEIGHT, getVisibleAgendaRange } from "../utils/appointmentLayout";
import {
  fetchPatients,
  fetchWeeklyPreview,
  createAppointmentRequest,
  updateAppointmentRequest,
  updateAppointmentStatusRequest,
  deleteAppointmentRequest,
  notifyAppointmentRequest,
} from "../services/appointmentsService";
import api from "../services/api";

const EMPTY_FORM = {
  appointmentId: null,
  patientId: "",
  date: "",
  time: "09:00",
  duration: "",
  location: "",
  repeatWeekly: false,
  notifyOnSave: false,
  notifyMethod: "email",
  notes: "",
};

export default function Appointments() {
  const [patients, setPatients] = useState([]);
  const [weeklyPreview, setWeeklyPreview] = useState({});
  const [defaultSessionMinutes, setDefaultSessionMinutes] = useState(50);
  const [profileOfficeAddress, setProfileOfficeAddress] = useState("Consultorio principal");
  const [profileOfficeAddresses, setProfileOfficeAddresses] = useState([]);
  const [calendarStartHour, setCalendarStartHour] = useState(DEFAULT_START_HOUR);
  const [calendarEndHour, setCalendarEndHour] = useState(DEFAULT_END_HOUR);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState(getLocalDateKey(new Date()));
  const [form, setForm] = useState(EMPTY_FORM);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [msg, setMsg] = useState("");

  const weekDays = useMemo(() => getWeekDays(new Date(), weekOffset), [weekOffset]);
  const weekLabel = useMemo(() => getWeekLabel(weekDays), [weekDays]);
  const selectedDay = useMemo(
    () => weekDays.find((day) => getLocalDateKey(day) === selectedDateKey) || weekDays[0],
    [selectedDateKey, weekDays]
  );
  const calendarHours = useMemo(
    () => Array.from(
      { length: calendarEndHour - calendarStartHour + 1 },
      (_, index) => calendarStartHour + index
    ),
    [calendarEndHour, calendarStartHour]
  );

  const appointmentsByDay = useMemo(() => {
    const normalized = {};

    weekDays.forEach((day) => {
      const dayKey = getLocalDateKey(day);
      const seenIds = new Set();

      normalized[dayKey] = (weeklyPreview[dayKey] || [])
        .filter((item) => item.appointment_id && item.patient_id)
        .filter((item) => {
          if (seenIds.has(item.appointment_id)) return false;
          seenIds.add(item.appointment_id);
          return true;
        })
        .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    });

    return normalized;
  }, [weekDays, weeklyPreview]);

  const weekTotal = useMemo(
    () => Object.values(appointmentsByDay).reduce((total, items) => total + items.length, 0),
    [appointmentsByDay]
  );

  async function loadPatients() {
    try {
      const patientsData = await fetchPatients();
      setPatients(patientsData);
      return patientsData;
    } catch (e) {
      console.error(e);
      setMsg(e.message);
      return patients;
    }
  }

  async function loadWeeklyPreview(offset = weekOffset) {
    try {
      const previewData = await fetchWeeklyPreview(offset);
      setWeeklyPreview(previewData.days || {});
      setDefaultSessionMinutes(previewData.slotMinutes || 50);
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function loadProfile() {
    try {
      const data = await api.get("/profile");
      const officeAddresses = Array.isArray(data?.office_addresses)
        ? data.office_addresses.filter(Boolean)
        : [];

      if (officeAddresses.length > 0) {
        setProfileOfficeAddresses(officeAddresses);
        setProfileOfficeAddress(officeAddresses[0]);
      } else if (data?.office_address) {
        setProfileOfficeAddresses([data.office_address]);
        setProfileOfficeAddress(data.office_address);
      }

      const visibleRange = getVisibleAgendaRange(data);
      setCalendarStartHour(visibleRange.startHour);
      setCalendarEndHour(visibleRange.endHour);
    } catch {
      console.debug("Profile not found, using default address");
    }
  }

  function getPatientName(id) {
    const patient = patients.find((p) => p.id === id);
    return patient ? patient.full_name : `Paciente ${id}`;
  }

  function getPatientById(id) {
    return patients.find((patient) => String(patient.id) === String(id));
  }

  async function openCreate(day, hour = 9) {
    await loadPatients();
    setForm({
      ...EMPTY_FORM,
      date: formatDateForInput(day),
      time: `${String(hour).padStart(2, "0")}:00`,
      duration: "",
      location: profileOfficeAddress,
      notifyOnSave: false,
      notifyMethod: "email",
    });
    setSelectedDateKey(getLocalDateKey(day));
    setIsPanelOpen(true);
    setMsg("");
  }

  async function openEdit(slot) {
    const nextPatients = await loadPatients();
    const selectedPatient = nextPatients.find((patient) => String(patient.id) === String(slot.patient_id));
    const notifyMethod = selectedPatient?.email ? "email" : "email";

    setForm({
      appointmentId: slot.appointment_id,
      patientId: slot.patient_id ? String(slot.patient_id) : "",
      date: formatDateForInput(slot.start_at),
      time: getTimeForInput(slot.start_at),
      duration: String(getDurationMinutes(slot.start_at, slot.end_at) || defaultSessionMinutes),
      location: slot.location || profileOfficeAddress,
      repeatWeekly: !!slot.recurring_series_id,
      notifyOnSave: false,
      notifyMethod,
      notes: slot.notes || "",
    });
    setSelectedDateKey(formatDateForInput(slot.start_at));
    setIsPanelOpen(true);
    setMsg("");
  }

  function closePanel() {
    setIsPanelOpen(false);
    setForm(EMPTY_FORM);
  }

  async function saveAppointment() {
    setMsg("");

    if (!form.date || !form.time) {
      setMsg("Completa fecha y hora");
      return;
    }

    try {
      const payload = {
        start_at: `${form.date}T${form.time}:00`,
        patient_id: form.patientId ? Number(form.patientId) : null,
        status: form.patientId ? "scheduled" : "free",
        location: form.location || profileOfficeAddress,
        notes: form.notes,
      };

      if (form.duration && Number(form.duration) > 0) {
        payload.duration_minutes = Number(form.duration);
      }

      if (form.repeatWeekly) {
        payload.recurrence = { frequency: "weekly", enabled: true };
      } else if (form.appointmentId) {
        payload.recurrence = { enabled: false };
      }

      if (form.appointmentId) {
        await updateAppointmentRequest(form.appointmentId, payload);
        setMsg("Turno actualizado");
      } else {
        const result = await createAppointmentRequest(payload);
        const appointmentId = result?.appointment?.id;
        const notifyPatient = getPatientById(form.patientId);
        const notifyMethod = form.notifyMethod === "whatsapp" ? "email" : (form.notifyMethod || "email");
        const hasNotifyContact = notifyMethod === "email"
          ? Boolean(notifyPatient?.email)
          : false;
        const shouldNotify = form.notifyOnSave && form.patientId && appointmentId && hasNotifyContact;
        let successMessage = result.recurring_series ? "Serie semanal creada" : "Turno creado";

        if (shouldNotify) {
          try {
            await notifyAppointmentRequest(appointmentId, {
              method: notifyMethod,
              location: form.location || profileOfficeAddress,
            });
            successMessage = `${successMessage} y notificacion enviada`;
          } catch (notifyError) {
            console.error(notifyError);
            successMessage = `${successMessage}, pero no se pudo notificar: ${notifyError.message}`;
          }
        }

        setMsg(successMessage);
      }

      closePanel();
      await loadWeeklyPreview();
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function changeStatus(status) {
    if (!form.appointmentId) return;

    try {
      await updateAppointmentStatusRequest(form.appointmentId, status);
      setMsg("Estado actualizado");
      closePanel();
      await loadWeeklyPreview();
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function removeAppointment() {
    if (!form.appointmentId) return;

    try {
      await deleteAppointmentRequest(form.appointmentId);
      setMsg("Turno eliminado");
      closePanel();
      await loadWeeklyPreview();
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function notifyAppointment(method) {
    if (!form.appointmentId) return;

    try {
      const result = await notifyAppointmentRequest(form.appointmentId, {
        method,
        location: form.location || profileOfficeAddress,
      });
      const successMessage = result.msg || "Notificacion enviada";
      setMsg(successMessage);
      return { ok: true, message: successMessage };
    } catch (e) {
      console.error(e);
      const errorMessage = e.message || "Error al enviar la notificacion";
      setMsg(errorMessage);
      return { ok: false, message: errorMessage };
    }
  }

  useEffect(() => {
    loadPatients();
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadWeeklyPreview(weekOffset);
    setSelectedDateKey(getLocalDateKey(getWeekDays(new Date(), weekOffset)[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  return (
    <div className="appointments-page">
      <header className="appointments-page__top">
        <div>
          <h1 className="appointments-page__title">Turnos</h1>
          <p className="appointments-page__summary">
            {weekTotal} turno{weekTotal === 1 ? "" : "s"} en la semana
          </p>
        </div>

        <div className="appointments-page__actions">
          <button type="button" className="appointments-page__button" onClick={() => setWeekOffset(0)}>
            Hoy
          </button>
          <button
            type="button"
            className="appointments-page__icon-button"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            aria-label="Semana anterior"
            title="Semana anterior"
          >
            <span className="appointments-page__chevron appointments-page__chevron--left" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="appointments-page__icon-button"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            aria-label="Semana siguiente"
            title="Semana siguiente"
          >
            <span className="appointments-page__chevron appointments-page__chevron--right" aria-hidden="true" />
          </button>
          <div className="appointments-page__week-label">{weekLabel}</div>
          <button type="button" className="appointments-page__primary-button" onClick={() => openCreate(selectedDay)}>
            + Nuevo turno
          </button>
        </div>
      </header>

      <section className="appointments-page__mobile-days" aria-label="Dias de la semana">
        {weekDays.map((day) => {
          const key = getLocalDateKey(day);
          const isSelected = key === selectedDateKey;
          return (
            <button
              key={key}
              type="button"
              className={`appointments-page__day-pill${isSelected ? " appointments-page__day-pill--selected" : ""}`}
              onClick={() => setSelectedDateKey(key)}
            >
              <span>{day.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "")}</span>
              <strong>{day.getDate()}</strong>
            </button>
          );
        })}
      </section>

      <section
        className="appointments-calendar"
        style={{
          "--hour-height": `${HOUR_HEIGHT}px`,
          "--calendar-hour-count": calendarHours.length,
        }}
      >
        <div className="appointments-calendar__corner" />

        {weekDays.map((day) => {
          const key = getLocalDateKey(day);
          return (
            <div key={key} className="appointments-calendar__day-head">
              <strong>{day.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "")}</strong>
              <span>{day.getDate()}/{day.getMonth() + 1}</span>
            </div>
          );
        })}

        <div className="appointments-calendar__times">
          {calendarHours.map((hour) => (
            <div key={hour} className="appointments-calendar__time">
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {weekDays.map((day) => {
          const key = getLocalDateKey(day);
          return (
            <div key={key} className="appointments-calendar__day">
              {calendarHours.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  className="appointments-calendar__hour"
                  onClick={() => openCreate(day, hour)}
                  aria-label={`Crear turno ${key} ${hour}:00`}
                />
              ))}

              {(appointmentsByDay[key] || []).map((slot) => (
                <AppointmentBlock
                  key={slot.appointment_id}
                  slot={slot}
                  calendarStartHour={calendarStartHour}
                  calendarEndHour={calendarEndHour}
                  patientName={getPatientName(slot.patient_id)}
                  onClick={() => openEdit(slot)}
                />
              ))}
            </div>
          );
        })}
      </section>

      <section className="appointments-mobile-list">
        {calendarHours.map((hour) => {
          const hourItems = (appointmentsByDay[getLocalDateKey(selectedDay)] || []).filter(
            (slot) => new Date(slot.start_at).getHours() === hour
          );

          return (
            <div key={hour} className="appointments-mobile-list__row">
              <div className="appointments-mobile-list__time">
                {String(hour).padStart(2, "0")}:00
              </div>
              <div className="appointments-mobile-list__items">
                {hourItems.map((slot) => (
                  <AppointmentBlock
                    key={slot.appointment_id}
                    slot={slot}
                    calendarStartHour={calendarStartHour}
                    calendarEndHour={calendarEndHour}
                    patientName={getPatientName(slot.patient_id)}
                    onClick={() => openEdit(slot)}
                    mobile
                  />
                ))}
                {hourItems.length === 0 && (
                  <button type="button" className="appointments-mobile-list__empty" onClick={() => openCreate(selectedDay, hour)}>
                    Disponible
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {msg && <p className="appointments-page__message">{msg}</p>}

      {isPanelOpen && (
        <AppointmentPanel
          form={form}
          setForm={setForm}
          patients={patients}
          defaultSessionMinutes={defaultSessionMinutes}
          profileOfficeAddress={profileOfficeAddress}
          profileOfficeAddresses={profileOfficeAddresses}
          onClose={closePanel}
          onSave={saveAppointment}
          onDelete={removeAppointment}
          onStatus={changeStatus}
          onNotify={notifyAppointment}
        />
      )}
    </div>
  );
}
