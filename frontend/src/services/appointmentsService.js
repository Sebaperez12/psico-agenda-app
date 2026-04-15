import api from "./api";

export async function fetchPatients() {
  const data = await api.get("/patients");
  return data.patients || [];
}

export async function fetchWeeklyPreview(weekOffset = 0) {
  const data = await api.get(`/availability/weekly-preview?week_offset=${weekOffset}`);
  return {
    days: data.days || {},
    slotMinutes: data.slot_minutes || 50,
  };
}

export async function createAppointmentRequest(payload) {
  return await api.post("/appointments", payload);
}

export async function updateAppointmentRequest(id, payload) {
  return await api.patch(`/appointments/${id}`, payload);
}

export async function updateAppointmentStatusRequest(id, status) {
  return await api.patch(`/appointments/${id}`, { status });
}

export async function deleteAppointmentRequest(id) {
  return await api.delete(`/appointments/${id}`);
}

export async function notifyAppointmentRequest(appointmentId, payload = { method: "email", location: "Consultorio principal" }) {
  return await api.post(`/appointments/${appointmentId}/notify`, payload);
}
