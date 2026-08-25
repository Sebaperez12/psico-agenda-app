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
  fetchAppointments,
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
  notifyOnSave: true,
  notifyMethod: "email",
  notes: "",
  status: "",
  feeAmount: "",
  paymentStatus: "pending",
};

function normalizeAppointmentSlot(appointment) {
  const appointmentId = appointment.appointment_id || appointment.id;

  return {
    ...appointment,
    appointment_id: appointmentId,
    id: appointmentId,
    patient_id: appointment.patient_id || null,
    recurring_series_id: appointment.recurring_series_id || null,
    fee_amount: appointment.fee_amount || 0,
    payment_status: appointment.payment_status || "pending",
  };
}

function mergeAppointmentsIntoPreview(previewDays, appointments, weekDays) {
  const mergedDays = {};

  weekDays.forEach((day) => {
    const dayKey = getLocalDateKey(day);
    mergedDays[dayKey] = [...(previewDays[dayKey] || [])];
  });

  appointments.forEach((appointment) => {
    if (!appointment.start_at) return;

    const dayKey = getLocalDateKey(new Date(appointment.start_at));
    if (!mergedDays[dayKey]) return;

    const normalizedAppointment = normalizeAppointmentSlot(appointment);
    const existingIndex = mergedDays[dayKey].findIndex(
      (item) => item.appointment_id === normalizedAppointment.appointment_id
    );

    if (existingIndex >= 0) {
      mergedDays[dayKey][existingIndex] = {
        ...mergedDays[dayKey][existingIndex],
        ...normalizedAppointment,
      };
    } else {
      mergedDays[dayKey].push(normalizedAppointment);
    }
  });

  Object.keys(mergedDays).forEach((dayKey) => {
    mergedDays[dayKey].sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  });

  return mergedDays;
}

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
  const messageType = useMemo(() => {
    if (!msg) return "";
    const normalized = msg.toLowerCase();
    return normalized.includes("error")
      || normalized.includes("superpone")
      || normalized.includes("no se pudo")
      || normalized.includes("obligatorio")
      || normalized.includes("completa")
      ? "error"
      : "success";
  }, [msg]);

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
        .filter((item) => item.appointment_id)
        .filter((item) => {
          if (seenIds.has(item.appointment_id)) return false;
          seenIds.add(item.appointment_id);
          return true;
        })
        .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    });

    return normalized;
  }, [weekDays, weeklyPreview]);
  const selectedDayAppointments = useMemo(
    () => appointmentsByDay[getLocalDateKey(selectedDay)] || [],
    [appointmentsByDay, selectedDay]
  );
  const mobileHourRows = useMemo(() => {
    const rowHours = new Set(calendarHours);

    selectedDayAppointments.forEach((slot) => {
      if (!slot.start_at) return;
      rowHours.add(new Date(slot.start_at).getHours());
    });

    return Array.from(rowHours).sort((a, b) => a - b);
  }, [calendarHours, selectedDayAppointments]);

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
      const [previewResult, appointmentsResult] = await Promise.allSettled([
        fetchWeeklyPreview(offset),
        fetchAppointments(),
      ]);
      const previewData = previewResult.status === "fulfilled" ? previewResult.value : { days: {}, slotMinutes: 50 };
      const appointmentsData = appointmentsResult.status === "fulfilled" ? appointmentsResult.value : [];
      const visibleWeekDays = getWeekDays(new Date(), offset);

      setWeeklyPreview(mergeAppointmentsIntoPreview(previewData.days || {}, appointmentsData, visibleWeekDays));
      setDefaultSessionMinutes(previewData.slotMinutes || 50);

      if (previewResult.status === "rejected") {
        throw previewResult.reason;
      }
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
    if (!id) {
      return "Turno sin paciente";
    }

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
      notifyOnSave: true,
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
      notifyOnSave: true,
      notifyMethod,
      notes: slot.notes || "",
      status: slot.status || "",
      feeAmount: slot.fee_amount || "",
      paymentStatus: slot.payment_status || "pending",
    });
    setSelectedDateKey(formatDateForInput(slot.start_at));
    setIsPanelOpen(true);
    setMsg("");
  }

  function closePanel() {
    setIsPanelOpen(false);
    setForm(EMPTY_FORM);
  }

  function getWeekOffsetForDate(dateKey) {
    const targetDate = new Date(`${dateKey}T00:00:00`);
    const currentWeekStart = getWeekDays(new Date(), 0)[0];
    const targetWeekStart = getWeekDays(targetDate, 0)[0];
    const diffMs = targetWeekStart.getTime() - currentWeekStart.getTime();

    return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  }

  function goToToday() {
    setSelectedDateKey(getLocalDateKey(new Date()));
    setWeekOffset(0);
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
        fee_amount: form.feeAmount || 0,
        payment_status: form.paymentStatus || "pending",
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
        const notifyPatient = getPatientById(form.patientId);
        const notifyMethod = form.notifyMethod === "whatsapp" ? "email" : (form.notifyMethod || "email");
        const hasNotifyContact = notifyMethod === "email"
          ? Boolean(notifyPatient?.email)
          : false;
        const shouldNotify = form.notifyOnSave && form.patientId && hasNotifyContact;
        let successMessage = "Turno actualizado";

        if (shouldNotify) {
          try {
            await notifyAppointmentRequest(form.appointmentId, {
              method: notifyMethod,
              location: form.location || profileOfficeAddress,
            });
            successMessage = `${successMessage} y notificacion en proceso`;
          } catch (notifyError) {
            console.error(notifyError);
            successMessage = `${successMessage}, pero no se pudo notificar: ${notifyError.message}`;
          }
        }

        setMsg(successMessage);
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
            successMessage = `${successMessage} y notificacion en proceso`;
          } catch (notifyError) {
            console.error(notifyError);
            successMessage = `${successMessage}, pero no se pudo notificar: ${notifyError.message}`;
          }
        }

        setMsg(successMessage);
      }

      const savedDateKey = form.date;
      const nextWeekOffset = getWeekOffsetForDate(savedDateKey);

      setWeekOffset(nextWeekOffset);
      setSelectedDateKey(savedDateKey);
      closePanel();
      await loadWeeklyPreview(nextWeekOffset);
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
    const visibleWeekDays = getWeekDays(new Date(), weekOffset);
    setSelectedDateKey((currentDateKey) => {
      const isCurrentDateVisible = visibleWeekDays.some((day) => getLocalDateKey(day) === currentDateKey);
      return isCurrentDateVisible ? currentDateKey : getLocalDateKey(visibleWeekDays[0]);
    });
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
          <button type="button" className="appointments-page__button" onClick={goToToday}>
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

      {msg && (
        <div
          className={`appointments-page__message appointments-page__message--${messageType}`}
          role={messageType === "error" ? "alert" : "status"}
        >
          {msg}
        </div>
      )}

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
        {mobileHourRows.map((hour) => {
          const hourItems = selectedDayAppointments.filter(
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
