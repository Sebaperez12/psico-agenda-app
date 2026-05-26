import { formatTime } from "../utils/dateUtils";
import { getAppointmentBlockPosition } from "../utils/appointmentLayout";
import { getAppointmentStatusClass } from "../utils/appointmentStatus";

export default function AppointmentBlock({
  slot,
  calendarStartHour,
  calendarEndHour,
  patientName,
  onClick,
  mobile = false,
}) {
  const style = getAppointmentBlockPosition(slot, calendarStartHour, calendarEndHour);

  return (
    <button
      type="button"
      className={`${getAppointmentStatusClass("appointment-block", slot.status)}${mobile ? " appointment-block--mobile" : ""}`}
      style={mobile ? undefined : style}
      onClick={onClick}
    >
      <span className="appointment-block__time">{formatTime(slot.start_at)}</span>
      <strong className="appointment-block__name">{patientName}</strong>
      <span className="appointment-block__location">{slot.location || "Consultorio principal"}</span>
      {slot.recurring_series_id && (
        <span className="appointment-block__repeat" title="Turno recurrente">
          ↻
        </span>
      )}
    </button>
  );
}
