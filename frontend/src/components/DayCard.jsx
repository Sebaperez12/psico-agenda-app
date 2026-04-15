import { useState } from "react";

export default function DayCard({ day, appointments = [], onAddAppointment }) {
  const [showForm, setShowForm] = useState(false);
  const [time, setTime] = useState("");
  const [patientName, setPatientName] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!time || !patientName.trim()) return;

    onAddAppointment(day.date, {
      time,
      patientName: patientName.trim(),
    });

    setTime("");
    setPatientName("");
    setShowForm(false);
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.dayText}>{day.label}</span>

          {appointments.length === 0 && !showForm && (
            <span style={styles.emptyText}>sin consultas</span>
          )}
        </div>

        <button
          type="button"
          style={styles.plusButton}
          onClick={() => setShowForm((prev) => !prev)}
        >
          +
        </button>
      </div>

      {appointments.length > 0 && (
        <div style={styles.appointmentsList}>
          {appointments.map((appointment, index) => (
            <div key={index} style={styles.appointmentRow}>
              <span style={styles.time}>{appointment.time}</span>
              <span style={styles.patient}>{appointment.patientName}</span>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={styles.inputTime}
          />

          <input
            type="text"
            placeholder="Nombre del paciente"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            style={styles.inputName}
          />

          <div style={styles.formButtons}>
            <button type="submit" style={styles.saveButton}>
              Guardar
            </button>

            <button
              type="button"
              style={styles.cancelButton}
              onClick={() => {
                setShowForm(false);
                setTime("");
                setPatientName("");
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const styles = {
  card: {
    border: "1px solid var(--color-border)",
    borderRadius: "22px",
    padding: "16px 18px",
    marginBottom: "16px",
    background: "rgba(255,255,255,0.84)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
  },
  dayText: {
    fontSize: "18px",
    fontWeight: 500,
    color: "var(--color-text-strong)",
  },
  emptyText: {
    fontSize: "16px",
    color: "var(--color-text-muted)",
  },
  plusButton: {
    border: "none",
    background: "transparent",
    fontSize: "42px",
    lineHeight: 1,
    cursor: "pointer",
    color: "var(--color-primary-strong)",
    padding: 0,
    width: "36px",
    height: "36px",
  },
  appointmentsList: {
    marginTop: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  appointmentRow: {
    display: "grid",
    gridTemplateColumns: "90px 1fr",
    alignItems: "center",
    border: "1px solid var(--color-border)",
    borderRadius: "10px",
    padding: "10px 14px",
    background: "#fff",
    gap: "12px",
  },
  time: {
    fontSize: "16px",
    color: "var(--color-text)",
  },
  patient: {
    fontSize: "16px",
    color: "var(--color-text)",
  },
  form: {
    marginTop: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "12px",
    border: "1px dashed var(--color-primary-strong)",
    borderRadius: "12px",
    background: "var(--color-surface-soft)",
  },
  inputTime: {
    height: "42px",
    borderRadius: "10px",
    border: "1px solid var(--color-border)",
    padding: "0 12px",
    fontSize: "15px",
  },
  inputName: {
    height: "42px",
    borderRadius: "10px",
    border: "1px solid var(--color-border)",
    padding: "0 12px",
    fontSize: "15px",
  },
  formButtons: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  saveButton: {
    height: "40px",
    borderRadius: "10px",
    border: "none",
    padding: "0 16px",
    background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-strong))",
    color: "#fff",
    cursor: "pointer",
  },
  cancelButton: {
    height: "40px",
    borderRadius: "10px",
    border: "1px solid var(--color-border)",
    padding: "0 16px",
    background: "#fff",
    color: "var(--color-text)",
    cursor: "pointer",
  },
};
