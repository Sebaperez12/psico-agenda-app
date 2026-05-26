export const DEFAULT_START_HOUR = 6;
export const DEFAULT_END_HOUR = 22;
export const HOUR_HEIGHT = 72;

export function getAppointmentBlockPosition(
  slot,
  calendarStartHour = DEFAULT_START_HOUR,
  calendarEndHour = DEFAULT_END_HOUR,
) {
  const start = new Date(slot.start_at);
  const end = new Date(slot.end_at);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const minMinutes = calendarStartHour * 60;
  const maxMinutes = (calendarEndHour + 1) * 60;
  const top = Math.max(0, ((startMinutes - minMinutes) / 60) * HOUR_HEIGHT);
  const height = Math.max(64, ((Math.min(endMinutes, maxMinutes) - startMinutes) / 60) * HOUR_HEIGHT - 8);

  return {
    top: `${top}px`,
    height: `${height}px`,
  };
}

export function getVisibleAgendaRange(profileData) {
  const startHour = getHourFromTime(profileData?.visible_agenda_start_time, DEFAULT_START_HOUR);
  const endHour = getHourFromTime(profileData?.visible_agenda_end_time, DEFAULT_END_HOUR);

  if (endHour <= startHour) {
    return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  }

  return { startHour, endHour };
}

function getHourFromTime(value, fallback) {
  const hour = Number(String(value || "").slice(0, 2));
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return fallback;
  }
  return hour;
}
