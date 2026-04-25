import { useEffect, useMemo, useState } from "react";
import "./Appointments.css";
import WeekNavigator from "../components/WeekNavigator";
import AppointmentDayColumn from "../components/AppointmentDayColumn";
import {
  getLocalDateKey,
  formatDateForInput,
  getTimeForInput,
  formatTime,
  getWeekDays,
  getWeekLabel,
} from "../utils/dateUtils";
import {
  buildTimeOptions,
  getStatusLabel,
  getDurationMinutes,
} from "../utils/appointmentUtils";
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

export default function Appointments() {
  const [patients, setPatients] = useState([]);
  const [weeklyPreview, setWeeklyPreview] = useState({});
  const [defaultSessionMinutes, setDefaultSessionMinutes] = useState(50);
  const [profileOfficeAddress, setProfileOfficeAddress] = useState("Consultorio principal");
  const [profileOfficeAddresses, setProfileOfficeAddresses] = useState([]);

  const [assigningSlotKey, setAssigningSlotKey] = useState(null);
  const [assignPatientId, setAssignPatientId] = useState("");

  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [editForm, setEditForm] = useState({
    patientId: "",
    date: "",
    time: "09:00",
    duration: "",
    location: "",
    repeatWeekly: false,
    recurringSeriesId: null,
    notes: "",
  });

  const [weekOffset, setWeekOffset] = useState(0);
  const [msg, setMsg] = useState("");

  const timeOptions = useMemo(() => buildTimeOptions(10), []);
  const weekDays = useMemo(() => getWeekDays(new Date(), weekOffset), [weekOffset]);
  const weekLabel = useMemo(() => getWeekLabel(weekDays), [weekDays]);

  async function loadPatients() {
    try {
      const patientsData = await fetchPatients();
      setPatients(patientsData);
    } catch (e) {
      console.error(e);
      setMsg(e.message);
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

  async function createAppointmentFromDay(dayDate, patientId, time, duration = "", options = {}) {
    setMsg("");

    if (!dayDate || !time) {
      setMsg("Completá fecha y hora");
      return;
    }

    try {
      const payload = {
        start_at: `${dayDate}T${time}:00`,
        status: patientId ? "reserved" : "free",
        location: options.location || profileOfficeAddress,
      };

      if (patientId) {
        payload.patient_id = Number(patientId);
      }

      if (duration && String(duration).trim()) {
        payload.duration_minutes = Number(duration);
      }

      if (options.repeatWeekly) {
        payload.recurrence = {
          frequency: "weekly",
        };
      }

      const result = await createAppointmentRequest(payload);

      setMsg(result.recurring_series ? "Serie semanal creada ✅" : "Turno creado ✅");
      await loadWeeklyPreview();
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function createInlineAppointment(slot, selectedPatientId = "", options = {}) {
    setMsg("");

    try {
      // Si el slot ya existe, actualizamos ese turno en vez de crear otro.
      if (slot.appointment_id) {
        const payload = {
          start_at: slot.start_at,
          patient_id: selectedPatientId ? Number(selectedPatientId) : null,
          status: selectedPatientId ? "reserved" : "free",
        };

        if (slot.end_at) {
          const duration = getDurationMinutes(slot.start_at, slot.end_at);
          if (duration) {
            payload.duration_minutes = duration;
          }
        }

        await updateAppointmentRequest(slot.appointment_id, payload);

        setAssigningSlotKey(null);
        setAssignPatientId("");
        setMsg("Turno actualizado ✅");
        await loadWeeklyPreview();
        return;
      }

      // Si no existe todavía, recién ahí lo creamos.
      const payload = {
        start_at: slot.start_at,
        status: selectedPatientId ? "reserved" : "free",
        location: options.location || profileOfficeAddress,
      };

      if (selectedPatientId) {
        payload.patient_id = Number(selectedPatientId);
      }

      if (slot.end_at) {
        const duration = getDurationMinutes(slot.start_at, slot.end_at);
        if (duration) {
          payload.duration_minutes = duration;
        }
      }

      if (options.repeatWeekly) {
        payload.recurrence = {
          frequency: "weekly",
        };
      }

      const result = await createAppointmentRequest(payload);

      setAssigningSlotKey(null);
      setAssignPatientId("");
      setMsg(result.recurring_series ? "Serie semanal creada ✅" : "Turno creado ✅");
      await loadWeeklyPreview();
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function updateAppointment(id) {
    setMsg("");

    if (!editForm.date || !editForm.time) {
      setMsg("Completá fecha y hora");
      return;
    }

    try {
      const payload = {
        start_at: `${editForm.date}T${editForm.time}:00`,
        location: editForm.location,
        notes: editForm.notes,
      };

      if (editForm.patientId) {
        payload.patient_id = Number(editForm.patientId);
        payload.status = "reserved";
      } else {
        payload.patient_id = null;
        payload.status = "free";
      }

      if (editForm.duration.trim()) {
        payload.duration_minutes = Number(editForm.duration);
      }

      payload.recurrence = editForm.repeatWeekly
        ? { frequency: "weekly", enabled: true }
        : { enabled: false };

      await updateAppointmentRequest(id, payload);

      cancelInlineEdit();
      setMsg("Turno actualizado ✅");
      await loadWeeklyPreview();
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function changeAppointmentStatus(id, status) {
    setMsg("");

    try {
      await updateAppointmentStatusRequest(id, status);
      setMsg("Estado actualizado ✅");
      await loadWeeklyPreview();
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function deleteAppointment(id) {
    setMsg("");

    try {
      await deleteAppointmentRequest(id);
      setMsg("Turno eliminado ✅");
      await loadWeeklyPreview();
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function notifyAppointment(slot, method = [], location = "Consultorio principal") {
    if (!slot.appointment_id) {
      setMsg("No hay turno válido para notificar");
      return;
    }

    if (!method || method.length === 0) {
      setMsg("Selecciona al menos un método de notificación");
      return;
    }

    try {
      const payload = {
        method: method[0] || "email",
        location,
      };

      const result = await notifyAppointmentRequest(slot.appointment_id, payload);
      setMsg(result.msg || "Notificación enviada ✅");
    } catch (e) {
      console.error(e);
      setMsg(e.message || "Error en notificación");
    }
  }

  function getPatientName(id) {
    const patient = patients.find((p) => p.id === id);
    return patient ? patient.full_name : `Paciente ${id}`;
  }

  function openInlineAssign(slotKey) {
    setAssigningSlotKey(slotKey);
    setAssignPatientId("");
    setMsg("");
  }

  function startInlineEdit(slot) {
    setEditingAppointmentId(slot.appointment_id);
    setEditForm({
      patientId: slot.patient_id ? String(slot.patient_id) : "",
      date: formatDateForInput(slot.start_at),
      time: getTimeForInput(slot.start_at),
      duration: String(getDurationMinutes(slot.start_at, slot.end_at)),
      location: slot.location || profileOfficeAddress,
      repeatWeekly: !!slot.recurring_series_id,
      recurringSeriesId: slot.recurring_series_id || null,
      notes: slot.notes || "",
    });
    setMsg("");
  }

  function cancelInlineEdit() {
    setEditingAppointmentId(null);
    setEditForm({
      patientId: "",
      date: "",
      time: "09:00",
      duration: "",
      location: "",
      repeatWeekly: false,
      recurringSeriesId: null,
      notes: "",
    });
  }

  useEffect(() => {
    loadPatients();
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const data = await api.get("/profile");
      const officeAddresses = Array.isArray(data?.office_addresses)
        ? data.office_addresses.filter(Boolean)
        : [];
      if (officeAddresses.length > 0) {
        setProfileOfficeAddresses(officeAddresses);
        setProfileOfficeAddress(officeAddresses[0]);
      } else if (data && data.office_address) {
        setProfileOfficeAddresses([data.office_address]);
        setProfileOfficeAddress(data.office_address);
      }
    } catch (e) {
      // Si no hay perfil, usar el default
      console.debug("Profile not found, using default address");
    }
  }

  useEffect(() => {
    loadWeeklyPreview(weekOffset);
  }, [weekOffset]);

  return (
    <div className="appointments-page">
      <div className="appointments-page__top">
        <div className="appointments-page__header">
          <h1 className="appointments-page__title">Turnos</h1>
          <p className="appointments-page__description">
            Visualiza y administra tus turnos de la semana. Crea, edita o cancela citas directamente desde aquí.
          </p>
        </div>

        <WeekNavigator
          weekLabel={weekLabel}
          onPrevWeek={() => setWeekOffset((prev) => prev - 1)}
          onNextWeek={() => setWeekOffset((prev) => prev + 1)}
          onToday={() => setWeekOffset(0)}
        />
      </div>

      <div className="appointments-page__week-grid">
        {weekDays.map((day) => {
          const key = getLocalDateKey(day);
          const items = weeklyPreview[key] || [];

          return (
            <AppointmentDayColumn
              key={key}
              day={day}
              items={items}
              patients={patients}
              timeOptions={timeOptions}
              assigningSlotKey={assigningSlotKey}
              assignPatientId={assignPatientId}
              setAssignPatientId={setAssignPatientId}
              editingAppointmentId={editingAppointmentId}
              editForm={editForm}
              setEditForm={setEditForm}
              getPatientName={getPatientName}
              getStatusLabel={getStatusLabel}
              formatTime={formatTime}
              openInlineAssign={openInlineAssign}
              createInlineAppointment={createInlineAppointment}
              createAppointmentFromDay={createAppointmentFromDay}
              startInlineEdit={startInlineEdit}
              cancelInlineEdit={cancelInlineEdit}
              updateAppointment={updateAppointment}
              changeAppointmentStatus={changeAppointmentStatus}
              deleteAppointment={deleteAppointment}
              notifyAppointment={notifyAppointment}
              setAssigningSlotKey={setAssigningSlotKey}
              defaultSessionMinutes={defaultSessionMinutes}
              defaultNotifyLocation={profileOfficeAddress}
              notifyLocationOptions={profileOfficeAddresses}
            />
          );
        })}
      </div>

      {msg && (
        <p className="appointments-page__message">
          <b>{msg}</b>
        </p>
      )}
    </div>
  );
}
