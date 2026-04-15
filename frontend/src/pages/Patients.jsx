import { useEffect, useState } from "react";
import api from "../services/api";
import { formatDateForInput, getTimeForInput } from "../utils/dateUtils";
import "./Patients.css";

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildProfileForm(patient) {
  return {
    full_name: patient?.full_name || "",
    phone: patient?.phone || "",
    email: patient?.email || "",
    dni: patient?.dni || "",
    date_of_birth: patient?.date_of_birth || "",
    occupation: patient?.occupation || "",
    insurance: patient?.insurance || "",
    address: patient?.address || "",
    emergency_contact_name: patient?.emergency_contact_name || "",
    emergency_contact_phone: patient?.emergency_contact_phone || "",
    notes: patient?.notes || "",
  };
}

function buildNextAppointmentForm(patient) {
  const appointment = patient?.next_appointment;

  if (!appointment) {
    return {
      appointmentId: null,
      date: getTodayDateInput(),
      time: "09:00",
      duration: "",
      location: "",
      notes: "",
    };
  }

  return {
    appointmentId: appointment.id,
    date: formatDateForInput(appointment.start_at),
    time: getTimeForInput(appointment.start_at),
    duration: appointment.start_at && appointment.end_at
      ? String(
        Math.max(
          0,
          Math.round((new Date(appointment.end_at) - new Date(appointment.start_at)) / 60000),
        ),
      )
      : "",
    location: appointment.location || "",
    notes: appointment.notes || "",
  };
}

function formatAppointmentSummary(appointment) {
  if (!appointment?.start_at) {
    return "Sin turno agendado";
  }

  return new Intl.DateTimeFormat("es-UY", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(appointment.start_at));
}

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [profileForm, setProfileForm] = useState(buildProfileForm(null));
  const [nextAppointmentForm, setNextAppointmentForm] = useState(buildNextAppointmentForm(null));

  async function loadPatients(selectedId = expandedPatientId) {
    setMsg("");
    try {
      const data = await api.get("/patients");
      const nextPatients = data.patients || [];
      setPatients(nextPatients);

      if (!selectedId) {
        return;
      }

      const selectedPatient = nextPatients.find((patient) => patient.id === selectedId);

      if (!selectedPatient) {
        setExpandedPatientId(null);
        setProfileForm(buildProfileForm(null));
        setNextAppointmentForm(buildNextAppointmentForm(null));
        return;
      }

      setProfileForm(buildProfileForm(selectedPatient));
      setNextAppointmentForm(buildNextAppointmentForm(selectedPatient));
    } catch (e) {
      console.error(e);
      setPatients([]);
      setMsg(e.message);
    }
  }

  async function createPatient() {
    setMsg("");
    try {
      await api.post("/patients", {
        full_name: fullName,
        phone: phone || null,
        email: email || null,
      });
      setFullName("");
      setPhone("");
      setEmail("");
      await loadPatients();
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function removePatient(id) {
    setMsg("");
    try {
      await api.delete(`/patients/${id}`);
      await loadPatients(expandedPatientId === id ? null : expandedPatientId);
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function savePatientProfile(patientId) {
    setMsg("");
    try {
      await api.patch(`/patients/${patientId}`, {
        ...profileForm,
        email: profileForm.email || null,
        phone: profileForm.phone || null,
        dni: profileForm.dni || null,
        date_of_birth: profileForm.date_of_birth || null,
        occupation: profileForm.occupation || null,
        insurance: profileForm.insurance || null,
        address: profileForm.address || null,
        emergency_contact_name: profileForm.emergency_contact_name || null,
        emergency_contact_phone: profileForm.emergency_contact_phone || null,
        notes: profileForm.notes || null,
      });
      setMsg("Perfil del paciente actualizado ✅");
      await loadPatients(patientId);
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function saveNextAppointment(patientId) {
    setMsg("");

    if (!nextAppointmentForm.date || !nextAppointmentForm.time) {
      setMsg("Completá fecha y hora de la próxima cita");
      return;
    }

    const payload = {
      patient_id: patientId,
      start_at: `${nextAppointmentForm.date}T${nextAppointmentForm.time}:00`,
      location: nextAppointmentForm.location || null,
      notes: nextAppointmentForm.notes || null,
      status: "scheduled",
    };

    if (nextAppointmentForm.duration && String(nextAppointmentForm.duration).trim()) {
      payload.duration_minutes = Number(nextAppointmentForm.duration);
    }

    try {
      if (nextAppointmentForm.appointmentId) {
        await api.patch(`/appointments/${nextAppointmentForm.appointmentId}`, payload);
        setMsg("Próxima hora actualizada en la agenda ✅");
      } else {
        await api.post("/appointments", payload);
        setMsg("Próxima hora creada en la agenda ✅");
      }

      await loadPatients(patientId);
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function deleteNextAppointment(patient) {
    if (!patient?.next_appointment?.id) {
      setMsg("Ese paciente no tiene próxima hora cargada");
      return;
    }

    setMsg("");
    try {
      await api.delete(`/appointments/${patient.next_appointment.id}`);
      setMsg("Próxima hora eliminada de la agenda ✅");
      await loadPatients(patient.id);
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  function togglePatientEditor(patient) {
    if (expandedPatientId === patient.id) {
      setExpandedPatientId(null);
      setProfileForm(buildProfileForm(null));
      setNextAppointmentForm(buildNextAppointmentForm(null));
      return;
    }

    setExpandedPatientId(patient.id);
    setProfileForm(buildProfileForm(patient));
    setNextAppointmentForm(buildNextAppointmentForm(patient));
    setMsg("");
  }

  useEffect(() => {
    loadPatients();
  }, []);

  const filteredPatients = patients.filter((patient) => {
    const query = filterText.trim().toLowerCase();
    if (!query) return true;

    return [
      patient.full_name,
      patient.phone,
      patient.email,
      patient.dni,
      patient.occupation,
      patient.insurance,
      patient.address,
      patient.notes,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  return (
    <div className="patients-page">
      <h1 className="patients-page__title">Pacientes</h1>
      <p className="patients-page__description">
        Cada paciente ahora puede tener una ficha más completa y una próxima hora vinculada directamente con la agenda.
      </p>

      <div className="patients-page__searchbar">
        <input
          className="patients-page__input patients-page__input--search"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Buscar paciente, email, teléfono, DNI o obra social"
        />
      </div>

      <div className="patients-page__form">
        <input
          className="patients-page__input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nombre completo"
        />
        <input
          className="patients-page__input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Teléfono (opcional)"
        />
        <input
          className="patients-page__input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <button className="patients-page__btn patients-page__btn--primary" onClick={createPatient}>
          Agregar
        </button>
        <button className="patients-page__btn" onClick={() => loadPatients()}>
          Refrescar
        </button>
      </div>

      {patients.length === 0 ? (
        <p className="patients-page__empty">No hay pacientes todavía.</p>
      ) : filteredPatients.length === 0 ? (
        <p className="patients-page__empty">No se encontraron pacientes para esta búsqueda.</p>
      ) : (
        <ul className="patients-page__list">
          {filteredPatients.map((patient) => {
            const isExpanded = expandedPatientId === patient.id;

            return (
              <li className="patients-page__card" key={patient.id}>
                <div className="patients-page__card-header">
                  <div className="patients-page__upcoming">
                    <span className="patients-page__upcoming-label">Próxima hora</span>
                    <strong>{formatAppointmentSummary(patient.next_appointment)}</strong>
                    {patient.next_appointment?.location && (
                      <span>{patient.next_appointment.location}</span>
                    )}
                  </div>

                  <div className="patients-page__item-info">
                    <strong>{patient.full_name}</strong>
                    <span>{patient.phone || "Sin teléfono"}</span>
                    <span>{patient.email || "Sin email"}</span>
                  </div>

                  <div className="patients-page__card-actions">
                    <button
                      className="patients-page__btn"
                      onClick={() => togglePatientEditor(patient)}
                    >
                      {isExpanded ? "Cerrar" : "Editar"}
                    </button>
                    <button
                      className="patients-page__item-delete"
                      onClick={() => removePatient(patient.id)}
                    >
                      borrar
                    </button>
                  </div>
                </div>

                {(patient.insurance || patient.occupation || patient.dni) && (
                  <div className="patients-page__meta">
                    {patient.dni && <span>DNI: {patient.dni}</span>}
                    {patient.insurance && <span>Obra social: {patient.insurance}</span>}
                    {patient.occupation && <span>Ocupación: {patient.occupation}</span>}
                  </div>
                )}

                {isExpanded && (
                  <div className="patients-page__editor">
                    <section className="patients-page__section patients-page__section--agenda">
                      <div className="patients-page__section-head">
                        <h2>Próxima hora</h2>
                        <p>Lo que edites acá se guarda sobre el mismo turno de la agenda.</p>
                      </div>

                      <div className="patients-page__grid patients-page__grid--appointment">
                        <input
                          className="patients-page__input"
                          type="date"
                          value={nextAppointmentForm.date}
                          onChange={(e) => setNextAppointmentForm((current) => ({ ...current, date: e.target.value }))}
                        />
                        <input
                          className="patients-page__input"
                          type="time"
                          value={nextAppointmentForm.time}
                          onChange={(e) => setNextAppointmentForm((current) => ({ ...current, time: e.target.value }))}
                        />
                        <input
                          className="patients-page__input"
                          type="number"
                          min="10"
                          step="5"
                          value={nextAppointmentForm.duration}
                          onChange={(e) =>
                            setNextAppointmentForm((current) => ({ ...current, duration: e.target.value }))
                          }
                          placeholder="Duración en minutos"
                        />
                        <input
                          className="patients-page__input"
                          value={nextAppointmentForm.location}
                          onChange={(e) =>
                            setNextAppointmentForm((current) => ({ ...current, location: e.target.value }))
                          }
                          placeholder="Lugar"
                        />
                        <textarea
                          className="patients-page__input patients-page__textarea"
                          value={nextAppointmentForm.notes}
                          onChange={(e) =>
                            setNextAppointmentForm((current) => ({ ...current, notes: e.target.value }))
                          }
                          placeholder="Notas del turno"
                        />
                      </div>

                      <div className="patients-page__section-actions">
                        <button
                          className="patients-page__btn patients-page__btn--primary"
                          onClick={() => saveNextAppointment(patient.id)}
                        >
                          {patient.next_appointment ? "Actualizar próxima hora" : "Crear próxima hora"}
                        </button>
                        {patient.next_appointment && (
                          <button className="patients-page__btn" onClick={() => deleteNextAppointment(patient)}>
                            Eliminar de agenda
                          </button>
                        )}
                      </div>
                    </section>

                    <section className="patients-page__section">
                      <div className="patients-page__section-head">
                        <h2>Perfil del paciente</h2>
                        <p>Podés guardar datos clínicos y de contacto extra.</p>
                      </div>

                      <div className="patients-page__grid">
                        <input
                          className="patients-page__input"
                          value={profileForm.full_name}
                          onChange={(e) => setProfileForm((current) => ({ ...current, full_name: e.target.value }))}
                          placeholder="Nombre completo"
                        />
                        <input
                          className="patients-page__input"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm((current) => ({ ...current, phone: e.target.value }))}
                          placeholder="Teléfono"
                        />
                        <input
                          className="patients-page__input"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm((current) => ({ ...current, email: e.target.value }))}
                          placeholder="Email"
                        />
                        <input
                          className="patients-page__input"
                          value={profileForm.dni}
                          onChange={(e) => setProfileForm((current) => ({ ...current, dni: e.target.value }))}
                          placeholder="DNI"
                        />
                        <input
                          className="patients-page__input"
                          type="date"
                          value={profileForm.date_of_birth}
                          onChange={(e) => setProfileForm((current) => ({ ...current, date_of_birth: e.target.value }))}
                        />
                        <input
                          className="patients-page__input"
                          value={profileForm.occupation}
                          onChange={(e) => setProfileForm((current) => ({ ...current, occupation: e.target.value }))}
                          placeholder="Ocupación"
                        />
                        <input
                          className="patients-page__input"
                          value={profileForm.insurance}
                          onChange={(e) => setProfileForm((current) => ({ ...current, insurance: e.target.value }))}
                          placeholder="Obra social / cobertura"
                        />
                        <input
                          className="patients-page__input"
                          value={profileForm.address}
                          onChange={(e) => setProfileForm((current) => ({ ...current, address: e.target.value }))}
                          placeholder="Dirección"
                        />
                        <input
                          className="patients-page__input"
                          value={profileForm.emergency_contact_name}
                          onChange={(e) =>
                            setProfileForm((current) => ({
                              ...current,
                              emergency_contact_name: e.target.value,
                            }))
                          }
                          placeholder="Contacto de emergencia"
                        />
                        <input
                          className="patients-page__input"
                          value={profileForm.emergency_contact_phone}
                          onChange={(e) =>
                            setProfileForm((current) => ({
                              ...current,
                              emergency_contact_phone: e.target.value,
                            }))
                          }
                          placeholder="Teléfono de emergencia"
                        />
                        <textarea
                          className="patients-page__input patients-page__textarea"
                          value={profileForm.notes}
                          onChange={(e) => setProfileForm((current) => ({ ...current, notes: e.target.value }))}
                          placeholder="Notas del paciente"
                        />
                      </div>

                      <button
                        className="patients-page__btn patients-page__btn--primary"
                        onClick={() => savePatientProfile(patient.id)}
                      >
                        Guardar perfil
                      </button>
                    </section>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {msg && (
        <p className="patients-page__msg">
          <b>{msg}</b>
        </p>
      )}
    </div>
  );
}
