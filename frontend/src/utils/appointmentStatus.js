export const APPOINTMENT_STATUS_LABELS = {
  scheduled: "Agendado",
  attended: "Atendido",
  no_show: "Ausencia",
  cancelled: "Cancelado",
  free: "Libre",
};

export function getAppointmentStatusLabel(status) {
  return APPOINTMENT_STATUS_LABELS[status] || status || "Sin estado";
}

export function getAppointmentStatusClass(baseClassName, status) {
  return `${baseClassName} ${baseClassName}--${status || "scheduled"}`;
}
