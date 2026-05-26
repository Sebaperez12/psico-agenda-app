export function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getAppointmentDurationMinutes(appointment) {
  if (!appointment?.start_at || !appointment?.end_at) {
    return "";
  }

  return String(
    Math.max(
      0,
      Math.round((new Date(appointment.end_at) - new Date(appointment.start_at)) / 60000),
    ),
  );
}

export function formatAppointmentSummary(appointment) {
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

export function formatAppointmentDateTime(appointment) {
  if (!appointment?.start_at) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-UY", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(appointment.start_at));
}
