import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PatientCard from "../components/PatientCard";
import PatientQuickCreate from "../components/PatientQuickCreate";
import api from "../services/api";
import { buildNextAppointmentForm, buildPatientProfileForm } from "../utils/patientForms";
import "./Patients.css";

function attachAppointmentHistory(patients, appointments) {
  const appointmentsByPatient = {};

  appointments.forEach((appointment) => {
    if (!appointment.patient_id) return;
    const patientHistory = appointmentsByPatient[appointment.patient_id] || [];
    patientHistory.push(appointment);
    appointmentsByPatient[appointment.patient_id] = patientHistory;
  });

  Object.keys(appointmentsByPatient).forEach((patientId) => {
    appointmentsByPatient[patientId].sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  });

  return patients.map((patient) => ({
    ...patient,
    appointment_history: (appointmentsByPatient[patient.id] || patient.appointment_history || []).slice(0, 8),
  }));
}

export default function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [savingProfileId, setSavingProfileId] = useState(null);
  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [profileForm, setProfileForm] = useState(buildPatientProfileForm(null));
  const [nextAppointmentForm, setNextAppointmentForm] = useState(buildNextAppointmentForm(null));

  async function loadPatients(selectedId = expandedPatientId) {
    setMsg("");

    try {
      const [patientsData, appointmentsData] = await Promise.all([
        api.get("/patients"),
        api.get("/appointments"),
      ]);
      const nextPatients = attachAppointmentHistory(
        patientsData.patients || [],
        appointmentsData.appointments || [],
      );

      setPatients(nextPatients);

      if (!selectedId) return;

      const selectedPatient = nextPatients.find((patient) => patient.id === selectedId);
      if (!selectedPatient) {
        setExpandedPatientId(null);
        setProfileForm(buildPatientProfileForm(null));
        setNextAppointmentForm(buildNextAppointmentForm(null));
        return;
      }

      setProfileForm(buildPatientProfileForm(selectedPatient));
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
    setProfileStatus("");
    setSavingProfileId(patientId);

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
        session_fee_amount: profileForm.session_fee_amount || 0,
        billing_notes: profileForm.billing_notes || null,
      });
      await loadPatients(patientId);
      setProfileStatus("Perfil del paciente actualizado");
    } catch (e) {
      console.error(e);
      setProfileStatus(e.message);
    } finally {
      setSavingProfileId(null);
    }
  }

  async function saveNextAppointment(patientId) {
    setMsg("");

    if (!nextAppointmentForm.date || !nextAppointmentForm.time) {
      setMsg("Completa fecha y hora de la proxima cita");
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
        setMsg("Proxima hora actualizada en la agenda");
      } else {
        await api.post("/appointments", payload);
        setMsg("Proxima hora creada en la agenda");
      }

      await loadPatients(patientId);
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function deleteNextAppointment(patient) {
    if (!patient?.next_appointment?.id) {
      setMsg("Ese paciente no tiene proxima hora cargada");
      return;
    }

    setMsg("");

    try {
      await api.delete(`/appointments/${patient.next_appointment.id}`);
      setMsg("Proxima hora eliminada de la agenda");
      await loadPatients(patient.id);
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  function togglePatientEditor(patient) {
    if (expandedPatientId === patient.id) {
      setExpandedPatientId(null);
      setProfileForm(buildPatientProfileForm(null));
      setNextAppointmentForm(buildNextAppointmentForm(null));
      setProfileStatus("");
      return;
    }

    setExpandedPatientId(patient.id);
    setProfileForm(buildPatientProfileForm(patient));
    setNextAppointmentForm(buildNextAppointmentForm(patient));
    setMsg("");
    setProfileStatus("");
  }

  useEffect(() => {
    loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        Cada paciente puede tener una ficha completa y una proxima hora vinculada con la agenda.
      </p>

      <div className="patients-page__searchbar">
        <input
          className="patients-page__input patients-page__input--search"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Buscar paciente, email, telefono, DNI o obra social"
        />
      </div>

      <PatientQuickCreate
        fullName={fullName}
        phone={phone}
        email={email}
        onFullNameChange={setFullName}
        onPhoneChange={setPhone}
        onEmailChange={setEmail}
        onCreate={createPatient}
        onRefresh={() => loadPatients()}
      />

      {patients.length === 0 ? (
        <p className="patients-page__empty">No hay pacientes todavia.</p>
      ) : filteredPatients.length === 0 ? (
        <p className="patients-page__empty">No se encontraron pacientes para esta busqueda.</p>
      ) : (
        <ul className="patients-page__list">
          {filteredPatients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              isExpanded={expandedPatientId === patient.id}
              profileForm={profileForm}
              nextAppointmentForm={nextAppointmentForm}
              setProfileForm={setProfileForm}
              setNextAppointmentForm={setNextAppointmentForm}
              onToggleEditor={togglePatientEditor}
              onOpenHistory={(selectedPatient) => navigate(`/patients/${selectedPatient.id}/history`)}
              onDeletePatient={removePatient}
              onSaveProfile={savePatientProfile}
              onSaveNextAppointment={saveNextAppointment}
              onDeleteNextAppointment={deleteNextAppointment}
              profileStatus={expandedPatientId === patient.id ? profileStatus : ""}
              isSavingProfile={savingProfileId === patient.id}
            />
          ))}
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
