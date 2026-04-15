import { useEffect, useMemo, useState } from "react";

const STATUS_STYLES = {
  attended: {
    background: "linear-gradient(180deg, rgba(223, 240, 255, 0.96), rgba(210, 227, 255, 0.92))",
    border: "1px solid rgba(59, 130, 246, 0.32)",
    badgeBg: "#2563eb",
    badgeColor: "#fff",
  },
  cancelled: {
    background: "linear-gradient(180deg, rgba(254, 243, 243, 0.96), rgba(254, 229, 229, 0.92))",
    border: "1px solid rgba(239, 68, 68, 0.28)",
    badgeBg: "#dc2626",
    badgeColor: "#fff",
  },
  no_show: {
    background: "linear-gradient(180deg, rgba(236, 239, 255, 0.96), rgba(229, 231, 255, 0.92))",
    border: "1px solid rgba(79, 70, 229, 0.34)",
    badgeBg: "#4338ca",
    badgeColor: "#fff",
  },
  default: {
    background: "linear-gradient(180deg, rgba(255, 243, 217, 0.96), rgba(255, 230, 214, 0.92))",
    border: "1px solid rgba(245, 158, 11, 0.32)",
    badgeBg: "#ea580c",
    badgeColor: "#fff",
  },
};

const STATUS_BUTTON_STYLES = {
  attended: {
    background: "#10b981",
    border: "1px solid #10b981",
    color: "#fff",
  },
  no_show: {
    background: "#ea580c",
    border: "1px solid #ea580c",
    color: "#fff",
  },
  cancelled: {
    background: "#b91c1c",
    border: "1px solid #b91c1c",
    color: "#fff",
  },
};

const getStatusStyle = (status) => STATUS_STYLES[status] || STATUS_STYLES.default;

const getStatusButtonStyle = (type, baseStyle = {}) => ({
  ...baseStyle,
  minWidth: "70px",
  ...STATUS_BUTTON_STYLES[type],
});

export default function AppointmentSlotCard({
  slot,
  patients = [],
  assigningSlotKey,
  assignPatientId,
  setAssignPatientId,
  editingAppointmentId,
  editForm,
  setEditForm,
  getPatientName,
  getStatusLabel,
  formatTime,
  timeOptions = [],
  availableEditTimes = [],
  openInlineAssign,
  createInlineAppointment,
  startInlineEdit,
  cancelInlineEdit,
  updateAppointment,
  changeAppointmentStatus,
  deleteAppointment,
  notifyAppointment,
  setAssigningSlotKey,
  slotKey,
  defaultNotifyLocation = "Consultorio principal",
  notifyLocationOptions = [],
}) {
  const [showReservedActions, setShowReservedActions] = useState(false);
  const [notifyMethod, setNotifyMethod] = useState([]);
  const [notifyLocation, setNotifyLocation] = useState(defaultNotifyLocation);
  const [isNotifying, setIsNotifying] = useState(false);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [assignLocation, setAssignLocation] = useState(defaultNotifyLocation);
  const [isPatientInfoHovering, setIsPatientInfoHovering] = useState(false);
  const [isRowHovering, setIsRowHovering] = useState(false);

  const isAssignedOpen = assigningSlotKey === slotKey;
  const isEditing = editingAppointmentId === slot.appointment_id;

  const hasPatient = !!slot.patient_id;
  const isAvailable = !hasPatient;

  const patientName = useMemo(
    () => (slot.patient_id ? getPatientName(slot.patient_id) : ""),
    [slot.patient_id, getPatientName]
  );

  const locationLabel = useMemo(
    () => slot.location || defaultNotifyLocation,
    [slot.location, defaultNotifyLocation]
  );

  const isRecurring = !!slot.recurring_series_id;

  const timeLabel = useMemo(() => {
    if (slot.start_at) {
      return formatTime(slot.start_at);
    }
    if (slot.time) {
      return formatTime(`2000-01-01T${slot.time}:00`);
    }
    return "--:--";
  }, [slot.start_at, slot.time, formatTime]);

  const statusLabel = useMemo(
    () => (getStatusLabel ? getStatusLabel(slot.status || "reserved") : ""),
    [slot.status, getStatusLabel]
  );

  const shouldShowBadge = useMemo(
    () => isAvailable || ["attended", "no_show", "cancelled"].includes(slot.status),
    [isAvailable, slot.status]
  );

  const statusStyle = useMemo(() => getStatusStyle(slot.status), [slot.status]);


  useEffect(() => {
    if (!isEditing) {
      return;
    }

    if (availableEditTimes.length === 0) {
      if (editForm.time !== "") {
        setEditForm((prev) => ({ ...prev, time: "" }));
      }
      return;
    }

    if (!availableEditTimes.includes(editForm.time)) {
      setEditForm((prev) => ({ ...prev, time: availableEditTimes[0] }));
    }
  }, [availableEditTimes, editForm.time, isEditing, setEditForm]);

  useEffect(() => {
    if (!isAssignedOpen) {
      setRepeatWeekly(false);
      setAssignLocation(defaultNotifyLocation);
    }
  }, [defaultNotifyLocation, isAssignedOpen]);

  const handleCardClick = () => {
    if (isAvailable) {
      openInlineAssign(slotKey);
    } else {
      if (isEditing) {
        cancelInlineEdit();
      }
      setShowReservedActions((prev) => !prev);
    }
  };

  return (
    <div
      style={{
        ...styles.card,
        ...(isAvailable ? styles.availableCard : statusStyle),
        ...(!isAvailable && !showReservedActions ? styles.closedReservedCard : {}),
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          ...styles.row,
          cursor: "pointer",
          ...(!isAvailable ? { opacity: showReservedActions || isRowHovering ? 1 : 0.85 } : {}),
        }}
        onClick={handleCardClick}
        onMouseEnter={() => setIsRowHovering(true)}
        onMouseLeave={() => setIsRowHovering(false)}
      >
        <div style={styles.left}>
          {isAvailable ? (
            <>
              <div style={styles.time}>{timeLabel}</div>
              <div style={styles.name}>Disponible</div>
            </>
          ) : (
            <div
              style={{
                ...styles.patientInfo,
                ...(isPatientInfoHovering ? { background: "rgba(75, 93, 255, 0.08)" } : {}),
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowReservedActions(false);
                startInlineEdit(slot);
              }}
              onMouseEnter={() => setIsPatientInfoHovering(true)}
              onMouseLeave={() => setIsPatientInfoHovering(false)}
              title="Click para editar el turno"
            >
              <div style={styles.nameRow}>
                <div style={styles.name}>{patientName}</div>
                {isRecurring && <div style={styles.recurringIcon}>↻</div>}
              </div>
              <div style={styles.timeInline}>{timeLabel}</div>
              <div style={styles.location}>{locationLabel}</div>
            </div>
          )}
        </div>

        <div style={styles.right}>
          {shouldShowBadge && (
            <span
              style={{
                ...styles.badge,
                background: isAvailable ? styles.freeBadge.background : statusStyle.badgeBg,
                color: isAvailable ? styles.freeBadge.color : statusStyle.badgeColor,
              }}
            >
              {isAvailable ? "libre" : statusLabel}
            </span>
          )}
          {!isAvailable && !isEditing && (
            <div style={styles.expandChevron}>
              {showReservedActions ? "▲" : "▼"}
            </div>
          )}
        </div>
      </div>

      {isAssignedOpen && isAvailable && (
        <div style={styles.form} onClick={(e) => e.stopPropagation()}>
          <select
            value={assignPatientId}
            onChange={(e) => setAssignPatientId(e.target.value)}
            style={styles.input}
          >
            <option value="">Sin paciente</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.full_name}
              </option>
            ))}
          </select>

          <div style={styles.actions}>
            <button
              type="button"
              style={styles.saveButton}
              onClick={() =>
                createInlineAppointment(slot, assignPatientId, {
                  repeatWeekly,
                  location: assignLocation,
                })
              }
            >
              Guardar
            </button>

            <button
              type="button"
              style={styles.cancelButton}
              onClick={() => {
                setAssigningSlotKey(null);
                setAssignPatientId("");
                setRepeatWeekly(false);
                setAssignLocation(defaultNotifyLocation);
              }}
            >
              Cancelar
            </button>

            {slot.appointment_id && (
              <button
                type="button"
                style={styles.smallDangerButton}
                onClick={() => deleteAppointment(slot.appointment_id)}
              >
                Eliminar
              </button>
            )}
          </div>

          <select
            value={assignLocation}
            onChange={(e) => setAssignLocation(e.target.value)}
            style={styles.input}
          >
            {notifyLocationOptions.filter(Boolean).map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
            {!notifyLocationOptions.includes(assignLocation) && assignLocation && (
              <option value={assignLocation}>{assignLocation}</option>
            )}
          </select>

          <label style={styles.checkboxLabelInline}>
            <input
              type="checkbox"
              checked={repeatWeekly}
              onChange={(e) => setRepeatWeekly(e.target.checked)}
            />
            Repetir semanalmente
          </label>
        </div>
      )}

      {isEditing && (
        <div style={styles.form} onClick={(e) => e.stopPropagation()}>
          <select
            value={editForm.patientId}
            onChange={(e) =>
              setEditForm((prev) => ({
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
            value={editForm.time}
            onChange={(e) =>
              setEditForm((prev) => ({
                ...prev,
                time: e.target.value,
              }))
            }
            style={styles.input}
          >
            {availableEditTimes.map((time) => (
              <option key={time} value={time}>
                {formatTime(`2000-01-01T${time}:00`)}
              </option>
            ))}
          </select>

          <select
            value={editForm.location}
            onChange={(e) =>
              setEditForm((prev) => ({
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
            {!notifyLocationOptions.includes(editForm.location) && editForm.location && (
              <option value={editForm.location}>{editForm.location}</option>
            )}
          </select>

          <label style={styles.checkboxLabelInline}>
            <input
              type="checkbox"
              checked={!!editForm.repeatWeekly}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  repeatWeekly: e.target.checked,
                }))
              }
            />
            Repetir semanalmente
          </label>

          {availableEditTimes.length === 0 && (
            <div style={styles.hint}>
              No hay horarios disponibles para mover este turno sin superponerlo.
            </div>
          )}

          <div style={styles.editActions}>
            <button
              type="button"
              style={styles.editActionButtonPrimary}
              disabled={availableEditTimes.length === 0 || !editForm.time}
              onClick={() => updateAppointment(slot.appointment_id)}
            >
              Guardar
            </button>

            <button
              type="button"
              style={styles.editActionButtonSecondary}
              onClick={cancelInlineEdit}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!isAvailable && !isEditing && showReservedActions && (
        <div style={styles.secondaryActions}>
          <div style={styles.actionsHeader}>Acciones del turno</div>
          <div style={styles.statusActions}>
            <button
              type="button"
              style={getStatusButtonStyle("attended", styles.statusButton)}
              onClick={() => changeAppointmentStatus(slot.appointment_id, "attended")}
            >
              ✓ Atendido
            </button>
            <button
              type="button"
              style={getStatusButtonStyle("no_show", styles.statusButton)}
              onClick={() => changeAppointmentStatus(slot.appointment_id, "no_show")}
            >
              ⊘ Ausencia
            </button>
            <button
              type="button"
              style={getStatusButtonStyle("cancelled", styles.statusButton)}
              onClick={() => changeAppointmentStatus(slot.appointment_id, "cancelled")}
            >
              ✕ Cancelado
            </button>
          </div>

          <div style={styles.notifySettings}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={notifyMethod.includes("email")}
                onChange={(e) => {
                  if (e.target.checked) {
                    setNotifyMethod(["email"]);
                  } else {
                    setNotifyMethod([]);
                  }
                }}
                style={{ marginRight: "8px" }}
              />
              Email
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={notifyMethod.includes("whatsapp")}
                onChange={(e) => {
                  if (e.target.checked) {
                    setNotifyMethod(["whatsapp"]);
                  } else {
                    setNotifyMethod([]);
                  }
                }}
                style={{ marginRight: "8px" }}
              />
              WhatsApp
            </label>
          </div>

          <button
            type="button"
            style={styles.smallButton}
            disabled={isNotifying || notifyMethod.length === 0}
            onClick={async () => {
              setIsNotifying(true);
              await notifyAppointment(slot, notifyMethod, notifyLocation);
              setIsNotifying(false);
            }}
          >
            {isNotifying ? "Enviando..." : "Notificar"}
          </button>

          <button
            type="button"
            style={styles.smallDangerButton}
            onClick={() => deleteAppointment(slot.appointment_id)}
          >
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    width: "100%",
    minWidth: 0,
    borderRadius: "14px",
    padding: "10px",
    background: "#fff",
    border: "1px solid var(--color-border)",
    transition: "all 0.2s ease",
    overflow: "hidden",
  },

  availableCard: {
    background: "linear-gradient(180deg, rgba(230, 237, 255, 0.96), rgba(242, 247, 255, 0.92))",
    border: "1px solid rgba(75, 93, 255, 0.18)",
  },

  reservedCard: {
    background: "linear-gradient(180deg, rgba(243, 246, 255, 0.98), rgba(233, 238, 255, 0.94))",
    border: "1px solid rgba(75, 93, 255, 0.22)",
  },

  closedReservedCard: {
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.05)",
    cursor: "pointer",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
    width: "100%",
    minWidth: 0,
  },

  left: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
    flex: 1,
  },

  time: {
    fontWeight: 600,
    fontSize: "15px",
    color: "var(--color-text-strong)",
    flexShrink: 0,
  },

  name: {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--color-text-strong)",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  patientInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "0px",
    lineHeight: 1.08,
    minWidth: 0,
    cursor: "pointer",
    padding: "4px 6px",
    borderRadius: "6px",
    transition: "all 0.2s ease",
    position: "relative",
  },

  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
  },

  timeInline: {
    fontWeight: 400,
    fontSize: "15px",
    color: "var(--color-text-strong)",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  location: {
    fontSize: "12px",
    lineHeight: 1.02,
    color: "var(--color-text-muted)",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  recurringIcon: {
    flexShrink: 0,
    color: "var(--color-primary-strong)",
    fontSize: "14px",
    lineHeight: 1,
  },

  right: {
    flexShrink: 0,
  },

  badge: {
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    letterSpacing: "0.04em",
  },

  freeBadge: {
    background: "var(--color-primary)",
    color: "#fff",
  },

  expandChevron: {
    fontSize: "14px",
    color: "var(--color-text-muted)",
    marginLeft: "8px",
    transition: "all 0.2s ease",
    fontWeight: 700,
    opacity: 0.7,
  },

  actionsHeader: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--color-text-strong)",
    marginBottom: "8px",
    letterSpacing: "0.01em",
  },

  form: {
    marginTop: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  },

  input: {
    height: "40px",
    borderRadius: "10px",
    border: "1px solid var(--color-border)",
    padding: "0 10px",
    background: "#fff",
    maxHeight: "40px",
  },

  hint: {
    fontSize: "12px",
    color: "var(--color-text-muted)",
  },

  actions: {
    display: "flex",
    flexDirection: "row",
    gap: "8px",
    flexWrap: "wrap",
  },

  editActions: {
    display: "flex",
    flexDirection: "row",
    gap: "8px",
    flexWrap: "nowrap",
  },

  saveButton: {
    background: "var(--color-primary-strong)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(75, 93, 255, 0.18)",
  },

  cancelButton: {
    background: "#fff",
    border: "1px solid rgba(75, 93, 255, 0.16)",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    color: "var(--color-primary-strong)",
  },

  editActionButtonPrimary: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--color-primary-strong)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(75, 93, 255, 0.14)",
  },

  editActionButtonSecondary: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff",
    border: "1px solid rgba(75, 93, 255, 0.16)",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    color: "var(--color-primary-strong)",
  },

  secondaryActions: {
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "1px solid rgba(75, 93, 255, 0.15)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    animation: "slideDown 0.2s ease",
  },
  statusActions: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    padding: "8px 0",
  },

  statusButton: {
    padding: "4px 8px",
    borderRadius: "6px",
    border: "1px solid var(--color-border)",
    background: "#fff",
    color: "var(--color-text-strong)",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  notifySettings: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
  },

  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    cursor: "pointer",
    fontSize: "14px",
    userSelect: "none",
    margin: "0 8px 0 0",
  },

  checkboxLabelInline: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "var(--color-text-strong)",
  },

  smallButton: {
    border: "1px solid rgba(75, 93, 255, 0.22)",
    background: "#4b5bff",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.2s",
    color: "#fff",
    boxShadow: "0 6px 10px rgba(75, 93, 255, 0.18)",
  },

  smallButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },

  smallDangerButton: {
    border: "1px solid rgba(239, 68, 68, 0.2)",
    background: "rgba(248, 113, 113, 0.14)",
    color: "#b91c1c",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    cursor: "pointer",
  },
};
