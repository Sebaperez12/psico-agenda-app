import { useEffect, useMemo, useState } from "react";
import AppointmentSlotCard from "./AppointmentSlotCard";
import { getLocalDateKey, formatDateForInput, formatTime } from "../utils/dateUtils";

export default function AppointmentDayColumn({
  day,
  items = [],
  patients,
  timeOptions,
  assigningSlotKey,
  assignPatientId,
  setAssignPatientId,
  editingAppointmentId,
  editForm,
  setEditForm,
  getPatientName,
  getStatusLabel,
  formatTime,
  openInlineAssign,
  createInlineAppointment,
  createAppointmentFromDay,
  startInlineEdit,
  cancelInlineEdit,
  updateAppointment,
  changeAppointmentStatus,
  deleteAppointment,
  notifyAppointment,
  setAssigningSlotKey,
  defaultSessionMinutes = 50,
  defaultNotifyLocation = "Consultorio principal",
  notifyLocationOptions = [],
}) {
  const hasItems = items.length > 0;
  const isToday = getLocalDateKey(day) === getLocalDateKey(new Date());

  const hasConsultations = useMemo(() => {
    return items.some((item) => !!item.patient_id);
  }, [items]);

  const daySummary = useMemo(() => {
    const occupiedCount = items.filter((item) => !!item.patient_id).length;
    const freeCount = items.filter((item) => !item.patient_id).length;

    if (occupiedCount > 0) {
      return `${occupiedCount} turno${occupiedCount === 1 ? "" : "s"}`;
    }

    if (freeCount > 0) {
      return `${freeCount} libre${freeCount === 1 ? "" : "s"}`;
    }

    return "Sin turnos";
  }, [items]);

  const dayKey = getLocalDateKey(day);
  const [isOpen, setIsOpen] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [dayForm, setDayForm] = useState({
    patientId: "",
    time: "09:00",
    duration: "",
    repeatWeekly: false,
    location: defaultNotifyLocation,
  });

  const defaultDurationMinutes = useMemo(() => {
    return defaultSessionMinutes > 0 ? defaultSessionMinutes : 50;
  }, [defaultSessionMinutes]);

  const occupiedRanges = useMemo(() => {
    const byAppointment = new Map();

    items.forEach((item) => {
      const hasRealAppointment = item.appointment_id || item.patient_id || item.status === "scheduled";

      if (!hasRealAppointment || !item.start_at || !item.end_at) {
        return;
      }

      const key = item.appointment_id || `${item.start_at}-${item.end_at}`;

      if (!byAppointment.has(key)) {
        byAppointment.set(key, {
          start: new Date(item.start_at),
          end: new Date(item.end_at),
        });
      }
    });

    return Array.from(byAppointment.values());
  }, [items]);

  const getAvailableTimesForRange = (durationMinutes, excludedAppointmentId = null) => {
    return timeOptions.filter((time) => {
      const [hours, minutes] = time.split(":").map(Number);
      const candidateStart = new Date(day);
      candidateStart.setHours(hours, minutes, 0, 0);

      const candidateEnd = new Date(candidateStart);
      candidateEnd.setMinutes(candidateEnd.getMinutes() + durationMinutes);

      return items.every((item) => {
        const hasRealAppointment = item.appointment_id || item.patient_id || item.status === "scheduled";

        if (!hasRealAppointment || !item.start_at || !item.end_at) {
          return true;
        }

        if (excludedAppointmentId && item.appointment_id === excludedAppointmentId) {
          return true;
        }

        const start = new Date(item.start_at);
        const end = new Date(item.end_at);

        return candidateStart >= end || candidateEnd <= start;
      });
    });
  };

  const availableCreateTimes = useMemo(() => {
    const requestedDuration = Number(dayForm.duration);
    const durationMinutes =
      Number.isFinite(requestedDuration) && requestedDuration > 0
        ? requestedDuration
        : defaultDurationMinutes;

    return getAvailableTimesForRange(durationMinutes);
  }, [dayForm.duration, defaultDurationMinutes, items, timeOptions, day]);

  const handleCreateFromDay = async () => {
    if (!createAppointmentFromDay) return;

    await createAppointmentFromDay(
      formatDateForInput(day),
      dayForm.patientId,
      dayForm.time,
      dayForm.duration,
      {
        repeatWeekly: dayForm.repeatWeekly,
        location: dayForm.location,
      }
    );

    setDayForm({
      patientId: "",
      time: "09:00",
      duration: "",
      repeatWeekly: false,
      location: defaultNotifyLocation,
    });
    setIsCreateOpen(false);
  };

  useEffect(() => {
    setDayForm((prev) => ({
      ...prev,
      location: prev.location || defaultNotifyLocation,
    }));
  }, [defaultNotifyLocation]);

  useEffect(() => {
    if (availableCreateTimes.length === 0) {
      if (dayForm.time !== "") {
        setDayForm((prev) => ({ ...prev, time: "" }));
      }
      return;
    }

    if (!availableCreateTimes.includes(dayForm.time)) {
      setDayForm((prev) => ({ ...prev, time: availableCreateTimes[0] }));
    }
  }, [availableCreateTimes, dayForm.time]);

  const dayCardStyle = {
    ...styles.dayCard,
    ...(isToday ? styles.dayCardToday : {}),
    ...(isOpen ? styles.dayCardOpen : styles.dayCardClosed),
    ...(!isOpen && hasConsultations
      ? styles.dayCardHasConsultations
      : !isOpen
        ? styles.dayCardNoConsultations
        : {}),
  };

  return (
    <div style={dayCardStyle}>
      <div style={styles.dayHeader} onClick={() => setIsOpen((prev) => !prev)}>
        <div style={styles.dayHeaderLeft}>
          <div style={styles.dayTitleSection}>
            <span style={{ ...styles.dayTitleInline, ...(isToday ? styles.dayTitleInlineToday : {}) }}>
              {getDayLabel(day)}
            </span>
            {isToday && <span style={styles.todayBadge}>Hoy</span>}
          </div>
          <div style={styles.dayInfoRow}>
            <span style={styles.dayDateInline}>{formatDayDate(day)}</span>
            {!isOpen && <span style={{ ...styles.daySummary, marginLeft: "12px" }}>{daySummary}</span>}
          </div>
        </div>

        <span style={styles.chevron}>{isOpen ? "⌃" : "⌄"}</span>
      </div>

      {isOpen && (
        <>
          {hasItems && (
            <div style={styles.slotsList}>
              {items.map((slot, index) => {
                const slotKey =
                  slot.slot_key ||
                  slot.id ||
                  `${dayKey}-${slot.start_at || slot.time || index}`;
                const slotDuration = slot.start_at && slot.end_at
                  ? Math.max(10, Math.round((new Date(slot.end_at) - new Date(slot.start_at)) / 60000))
                  : defaultDurationMinutes;
                const editDuration =
                  editingAppointmentId === slot.appointment_id && Number(editForm.duration) > 0
                    ? Number(editForm.duration)
                    : slotDuration;
                const availableEditTimes = getAvailableTimesForRange(
                  editDuration,
                  slot.appointment_id
                );

                return (
                  <AppointmentSlotCard
                    key={slotKey}
                    slot={slot}
                    patients={patients}
                    assigningSlotKey={assigningSlotKey}
                    assignPatientId={assignPatientId}
                    setAssignPatientId={setAssignPatientId}
                    editingAppointmentId={editingAppointmentId}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    getPatientName={getPatientName}
                    getStatusLabel={getStatusLabel}
                    formatTime={formatTime}
                    timeOptions={timeOptions}
                    availableEditTimes={availableEditTimes}
                    openInlineAssign={openInlineAssign}
                    createInlineAppointment={createInlineAppointment}
                    startInlineEdit={startInlineEdit}
                    cancelInlineEdit={cancelInlineEdit}
                    updateAppointment={updateAppointment}
                    changeAppointmentStatus={changeAppointmentStatus}
                    deleteAppointment={deleteAppointment}
                    notifyAppointment={notifyAppointment}
                    setAssigningSlotKey={setAssigningSlotKey}
                    slotKey={slotKey}
                    defaultSessionMinutes={defaultSessionMinutes}
                    defaultNotifyLocation={defaultNotifyLocation}
                    notifyLocationOptions={notifyLocationOptions}
                  />
                );
              })}
            </div>
          )}

          <div
            style={{
              ...styles.createSlotCard,
              ...(hasItems ? styles.createSlotCardWithItems : {}),
            }}
          >
            <div
              style={styles.createSlotHeader}
              onClick={() => setIsCreateOpen((prev) => !prev)}
            >
              <div style={styles.createSlotLeft}>
                <div style={styles.createSlotTime}>＋</div>
                <div style={styles.createSlotName}>Crear turno</div>
              </div>
            </div>

            {isCreateOpen && (
              <div style={styles.inlineCreateBox}>
                <select
                  value={dayForm.patientId}
                  onChange={(e) =>
                    setDayForm((prev) => ({
                      ...prev,
                      patientId: e.target.value,
                    }))
                  }
                  style={styles.input}
                >
                  <option value="">Sin paciente</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </option>
                  ))}
                </select>

                <select
                  value={dayForm.time}
                  onChange={(e) =>
                    setDayForm((prev) => ({
                      ...prev,
                      time: e.target.value,
                    }))
                  }
                  style={styles.input}
                >
                  {availableCreateTimes.map((time) => (
                    <option key={time} value={time}>
                      {formatTime(`2000-01-01T${time}:00`)}
                    </option>
                  ))}
                </select>

                {availableCreateTimes.length === 0 && (
                  <div style={styles.defaultHint}>
                    No hay horarios disponibles que no se superpongan con otros turnos.
                  </div>
                )}

                <input
                  type="number"
                  min="10"
                  step="10"
                  placeholder={`Duración (default ${defaultDurationMinutes} min)`}
                  value={dayForm.duration}
                  onChange={(e) =>
                    setDayForm((prev) => ({
                      ...prev,
                      duration: e.target.value,
                    }))
                  }
                  style={styles.input}
                />

                <select
                  value={dayForm.location}
                  onChange={(e) =>
                    setDayForm((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                  style={styles.input}
                >
                  {notifyLocationOptions.filter(Boolean).map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                  {!notifyLocationOptions.includes(dayForm.location) && dayForm.location && (
                    <option value={dayForm.location}>{dayForm.location}</option>
                  )}
                </select>

                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={dayForm.repeatWeekly}
                    onChange={(e) =>
                      setDayForm((prev) => ({
                        ...prev,
                        repeatWeekly: e.target.checked,
                      }))
                    }
                  />
                  Repetir semanalmente
                </label>

                <div style={styles.defaultHint}>
                  Si lo dejás vacío, se usa la duración por defecto.
                </div>

                <div style={styles.createActions}>
                  <button
                    type="button"
                    style={styles.createButton}
                    onClick={handleCreateFromDay}
                  >
                    Crear turno
                  </button>

                  <button
                    type="button"
                    style={styles.cancelButton}
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function getDayLabel(day) {
  return day
    .toLocaleDateString("es-ES", { weekday: "long" })
    .replace(/^./, (c) => c.toUpperCase());
}

function formatDayDate(day) {
  const date = day.toLocaleDateString("es-ES");
  return date.replace(/(\d{4})$/, (match) => match.slice(-2));
}

const styles = {
  dayCard: {
    background: "rgba(255, 255, 255, 0.84)",
    borderRadius: "18px",
    border: "1px solid var(--color-border)",
    boxShadow: "0 10px 26px var(--color-shadow)",
    padding: "14px",
    transition: "all 0.2s ease",
    alignSelf: "start",
    width: "100%",
    boxSizing: "border-box",
  },

  dayCardToday: {
    border: "1px solid rgba(56, 207, 163, 0.85)",
    boxShadow: "0 14px 34px rgba(56, 207, 163, 0.18)",
    background: "linear-gradient(180deg, rgba(245,255,250,0.99), rgba(226,250,241,0.96))",
  },

  dayCardOpen: {
    padding: "14px",
    background: "rgba(255,255,255,0.62)",
    backdropFilter: "blur(10px)",
  },

  dayCardClosed: {
    padding: "10px 12px",
  },

  dayCardNoConsultations: {
    background: "rgba(255,255,255,0.52)",
  },

  dayCardHasConsultations: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,244,223,0.92))",
    border: "1px solid var(--color-warning)",
  },

  dayHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    background: "linear-gradient(135deg, #10183c 0%, #1f2a5f 100%)",
    borderRadius: "12px",
    padding: "12px 16px",
    marginBottom: "4px",
    transition: "all 0.2s ease",
    position: "relative",
  },

  dayHeaderLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
    flex: 1,
    alignItems: "center",
    textAlign: "center",
  },

  dayTitleSection: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },

  dayInfoRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },

  dayTitleInline: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#ffffff",
  },

  dayTitleInlineToday: {
    color: "#7ac7ff",
  },

  dayDateInline: {
    fontSize: "12px",
    color: "rgba(255, 255, 255, 0.7)",
  },

  daySummary: {
    fontSize: "11px",
    color: "rgba(255, 255, 255, 0.65)",
    background: "rgba(255, 255, 255, 0.1)",
    borderRadius: "999px",
    padding: "3px 8px",
    border: "1px solid rgba(255, 255, 255, 0.15)",
  },

  emptyDot: {
    color: "rgba(255, 255, 255, 0.3)",
    fontSize: "14px",
  },

  todayBadge: {
    background: "rgba(122, 199, 255, 0.25)",
    color: "#7ac7ff",
    border: "1px solid rgba(122, 199, 255, 0.5)",
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.02em",
  },

  chevron: {
    fontSize: "16px",
    color: "rgba(255, 255, 255, 0.6)",
    lineHeight: 1,
    flexShrink: 0,
    marginLeft: "12px",
    position: "absolute",
    right: "16px",
  },

  slotsList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "12px",
  },

  createSlotCard: {
    background: "rgba(255,255,255,0.66)",
    border: "1px dashed rgba(56, 207, 163, 0.85)",
    borderRadius: "16px",
    padding: "12px",
  },

  createSlotCardWithItems: {
    marginTop: "8px",
  },

  createSlotHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
  },

  createSlotLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },

  createSlotTime: {
    fontWeight: 700,
    fontSize: "16px",
    color: "var(--color-primary-strong)",
    flexShrink: 0,
  },

  createSlotName: {
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--color-text-strong)",
  },

  createSlotBadge: {
    background: "var(--color-primary-strong)",
    color: "#fff",
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: 700,
  },

  inlineCreateBox: {
    marginTop: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  input: {
    height: "40px",
    borderRadius: "10px",
    border: "1px solid var(--color-border)",
    padding: "0 10px",
    background: "#fff",
    color: "var(--color-text)",
  },

  defaultHint: {
    fontSize: "12px",
    color: "var(--color-text-muted)",
    marginTop: "-2px",
  },

  createActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "var(--color-text-strong)",
  },

  createButton: {
    border: "none",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-strong))",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },

  cancelButton: {
    border: "1px solid var(--color-border)",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "#fff",
    color: "var(--color-text-strong)",
    fontWeight: 600,
    cursor: "pointer",
  },
};
