import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { formatAppointmentDateTime } from "../utils/appointmentFormatters";
import { getAppointmentStatusLabel } from "../utils/appointmentStatus";
import "./PatientHistory.css";

export default function PatientHistory() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function loadHistory() {
      setMsg("");
      setLoading(true);

      try {
        const [patientsData, appointmentsData] = await Promise.all([
          api.get("/patients"),
          api.get("/appointments"),
        ]);
        const selectedPatient = (patientsData.patients || []).find(
          (item) => String(item.id) === String(patientId),
        );
        const history = (appointmentsData.appointments || [])
          .filter((appointment) => String(appointment.patient_id) === String(patientId))
          .sort((a, b) => new Date(b.start_at) - new Date(a.start_at));

        setPatient(selectedPatient || null);
        setAppointments(history);
      } catch (e) {
        console.error(e);
        setMsg(e.message);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [patientId]);

  const counts = useMemo(() => {
    return appointments.reduce(
      (totals, appointment) => ({
        ...totals,
        [appointment.status]: (totals[appointment.status] || 0) + 1,
      }),
      {},
    );
  }, [appointments]);

  if (loading) {
    return <div className="patient-history">Cargando historial...</div>;
  }

  return (
    <div className="patient-history">
      <header className="patient-history__top">
        <div>
          <button type="button" className="patient-history__back" onClick={() => navigate("/patients")}>
            Volver
          </button>
          <h1>{patient?.full_name || "Paciente"}</h1>
          <p>Historial de turnos</p>
        </div>
      </header>

      <section className="patient-history__summary">
        <div>
          <strong>{appointments.length}</strong>
          <span>Total</span>
        </div>
        <div>
          <strong>{counts.attended || 0}</strong>
          <span>Atendidos</span>
        </div>
        <div>
          <strong>{counts.no_show || 0}</strong>
          <span>Ausencias</span>
        </div>
        <div>
          <strong>{counts.cancelled || 0}</strong>
          <span>Cancelados</span>
        </div>
      </section>

      {msg && <p className="patient-history__message">{msg}</p>}

      {appointments.length > 0 ? (
        <ol className="patient-history__list">
          {appointments.map((appointment) => (
            <li className="patient-history__item" key={appointment.id}>
              <span className={`patient-history__status patient-history__status--${appointment.status}`}>
                {getAppointmentStatusLabel(appointment.status)}
              </span>
              <div>
                <strong>{formatAppointmentDateTime(appointment)}</strong>
                <span>{appointment.location || "Sin lugar cargado"}</span>
                {appointment.notes && <p>{appointment.notes}</p>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="patient-history__empty">Todavia no hay turnos registrados.</p>
      )}
    </div>
  );
}
