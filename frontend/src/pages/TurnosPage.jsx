import { useState } from "react";
import DayCard from "../components/DayCard";

export default function TurnosPage() {
  // 📅 días de ejemplo
  const initialDays = [
    { date: "2026-03-18", label: "Lunes 18" },
    { date: "2026-03-19", label: "Martes 19" },
    { date: "2026-03-20", label: "Miércoles 20" },
    { date: "2026-03-21", label: "Jueves 21" },
  ];

  // 📊 estado de turnos por día
  const [appointmentsByDay, setAppointmentsByDay] = useState({
    "2026-03-18": [],
    "2026-03-19": [
      { time: "09:00", patientName: "Juan Pérez" },
      { time: "10:30", patientName: "Ana Gómez" },
      { time: "12:00", patientName: "Carlos Silva" },
    ],
    "2026-03-20": [],
    "2026-03-21": [],
  });

  // ➕ agregar turno
  const handleAddAppointment = (dayDate, newAppointment) => {
    setAppointmentsByDay((prev) => {
      const current = prev[dayDate] || [];

      const updated = [...current, newAppointment].sort((a, b) =>
        a.time.localeCompare(b.time)
      );

      return {
        ...prev,
        [dayDate]: updated,
      };
    });
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Turnos</h1>

      <div style={styles.list}>
        {initialDays.map((day) => (
          <DayCard
            key={day.date}
            day={day}
            appointments={appointmentsByDay[day.date] || []}
            onAddAppointment={handleAddAppointment}
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: "520px",
    margin: "0 auto",
    padding: "32px 20px 60px",
  },
  title: {
    fontSize: "32px",
    marginBottom: "24px",
    color: "#111",
  },
  list: {
    display: "flex",
    flexDirection: "column",
  },
};