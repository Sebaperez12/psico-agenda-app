export function buildTimeOptions(step = 10) {
  const times = [];

  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += step) {
      const hh = String(hour).padStart(2, "0");
      const mm = String(min).padStart(2, "0");
      times.push(`${hh}:${mm}`);
    }
  }

  const startIndex = times.indexOf("09:00");

  if (startIndex === -1) {
    return times;
  }

  return [...times.slice(startIndex), ...times.slice(0, startIndex)];
}

export function getStatusLabel(status) {
  switch (status) {
    case "scheduled":
      return "reservado";
    case "pending":
      return "Pendiente";
    case "attended":
      return "Atendido";
    case "no_show":
      return "Ausencia";
    case "cancelled":
      return "Cancelado";
    case "free":
      return "libre";
    default:
      return status || "reservado";
  }
}

export function getDurationMinutes(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return Math.round((end - start) / 60000);
}
