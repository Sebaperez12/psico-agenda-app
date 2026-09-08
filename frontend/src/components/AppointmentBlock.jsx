import { formatTime } from "../utils/dateUtils";
import { getAppointmentBlockPosition } from "../utils/appointmentLayout";
import { APPOINTMENT_STATUS_LABELS, getAppointmentStatusClass } from "../utils/appointmentStatus";

export default function AppointmentBlock({
  slot,
  calendarStartHour,
  calendarEndHour,
  patientName,
  onClick,
  mobile = false,
}) {
  const style = getAppointmentBlockPosition(slot, calendarStartHour, calendarEndHour);
  const paymentStatus = slot.payment_status || "pending";
  const paymentLabel = paymentStatus === "paid"
    ? "Pagado"
    : paymentStatus === "waived" ? "Sin cargo" : "Pago pendiente";

  return (
    <button
      type="button"
      className={`${getAppointmentStatusClass("appointment-block", slot.status)}${mobile ? " appointment-block--mobile" : ""}`}
      style={mobile ? undefined : style}
      onClick={onClick}
      title={`${APPOINTMENT_STATUS_LABELS[slot.status] || "Agendado"} · ${paymentLabel}`}
    >
      <span className="appointment-block__time">{formatTime(slot.start_at)}</span>
      <strong className="appointment-block__name">{patientName}</strong>
      <span className="appointment-block__location">{slot.location || "Consultorio principal"}</span>
      <span className="appointment-block__indicators">
        <span
          className={`appointment-block__payment appointment-block__payment--${paymentStatus}`}
          role="img"
          aria-label={paymentLabel}
          title={paymentLabel}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="8" cy="8" r="6" />
            {paymentStatus === "paid" ? (
              <path d="m5 8 2 2 4-4" />
            ) : paymentStatus === "waived" ? (
              <path d="M5 8h6" />
            ) : (
              <path d="M8 4.5V8l2 1.5" />
            )}
          </svg>
        </span>
      {slot.recurring_series_id && (
        <span className="appointment-block__repeat" title="Turno recurrente">
          ↻
        </span>
      )}
      </span>
    </button>
  );
}
