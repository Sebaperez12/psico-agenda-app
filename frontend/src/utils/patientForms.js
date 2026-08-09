import { formatDateForInput, getTimeForInput } from "./dateUtils";
import { getAppointmentDurationMinutes, getTodayDateInput } from "./appointmentFormatters";

export function buildPatientProfileForm(patient) {
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
    session_fee_amount: patient?.session_fee_amount || "",
    billing_notes: patient?.billing_notes || "",
  };
}

export function buildNextAppointmentForm(patient) {
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
    duration: getAppointmentDurationMinutes(appointment),
    location: appointment.location || "",
    notes: appointment.notes || "",
  };
}
