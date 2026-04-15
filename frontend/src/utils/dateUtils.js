export function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateForInput(dateStr) {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getTimeForInput(dateStr) {
  const d = new Date(dateStr);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatTime(dateStr, locale = "es-UY") {
  const d = new Date(dateStr);
  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const meridiem = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

export function getStartOfWeek(baseDate = new Date(), offset = 0) {
  const d = new Date(baseDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDays(baseDate = new Date(), offset = 0) {
  const start = getStartOfWeek(baseDate, offset);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function getWeekLabel(weekDays, locale = "es-UY") {
  const first = weekDays[0];
  const last = weekDays[6];

  const firstStr = first.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
  });

  const lastStr = last.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return `${firstStr} - ${lastStr}`;
}
