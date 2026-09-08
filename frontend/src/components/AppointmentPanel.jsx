import { useEffect, useMemo, useRef, useState } from "react";
import mailIcon from "../assets/mail.png";

const TIME_HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const TIME_MINUTES = Array.from({ length: 6 }, (_, index) => index * 10);
const TIME_MERIDIEMS = ["AM", "PM"];

function getTimeParts(value) {
  const [hourValue = "09", minuteValue = "00"] = (value || "09:00").split(":");
  const hour24 = Number(hourValue);
  const minute = Number(minuteValue);

  return {
    hour12: hour24 % 12 || 12,
    minute: Number.isNaN(minute) ? 0 : Math.min(Math.round(minute / 10) * 10, 50),
    meridiem: hour24 >= 12 ? "PM" : "AM",
  };
}

function buildTimeValue(hour12, minute, meridiem) {
  const normalizedHour = meridiem === "PM" ? (hour12 % 12) + 12 : hour12 % 12;

  return `${String(normalizedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTimeLabel(value) {
  const { hour12, minute, meridiem } = getTimeParts(value);

  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

function openPicker(inputRef) {
  const input = inputRef.current;
  if (!input) return;

  if (typeof input.showPicker === "function") {
    input.showPicker();
  } else {
    input.focus();
  }
}

export default function AppointmentPanel({
  form,
  setForm,
  patients,
  defaultSessionMinutes,
  profileOfficeAddress,
  profileOfficeAddresses,
  onClose,
  onSave,
  onDelete,
  onStatus,
  onNotify,
  onPaymentStatusChange,
}) {
  const locations = profileOfficeAddresses.length > 0 ? profileOfficeAddresses : [profileOfficeAddress];
  const dateInputRef = useRef(null);
  const timePickerRef = useRef(null);
  const timeParts = useMemo(() => getTimeParts(form.time), [form.time]);
  const selectedPatient = useMemo(
    () => patients.find((patient) => String(patient.id) === String(form.patientId)),
    [form.patientId, patients]
  );
  const notifyMethod = form.notifyMethod || "email";
  const canNotifyByEmail = Boolean(selectedPatient?.email);
  const canNotifyPatient = Boolean(selectedPatient && canNotifyByEmail);
  const canUseNotifyMethod = notifyMethod === "email" ? canNotifyByEmail : false;
  const shouldNotifyOnSave = canNotifyPatient && canUseNotifyMethod && form.notifyOnSave;
  const [isNotifying, setIsNotifying] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const paymentSaveRef = useRef(false);

  async function handleStatusChange(status) {
    setIsSavingStatus(true);
    setStatusMessage("Guardando estado...");
    try {
      await onStatus(status);
      setStatusMessage("Estado guardado sin enviar notificaciones.");
    } catch {
      setStatusMessage("No se pudo guardar. Volvé a seleccionar el estado para reintentar.");
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function handlePaymentStatusChange(paymentStatus) {
    if (!form.appointmentId) {
      setForm((prev) => ({ ...prev, paymentStatus }));
      return;
    }
    if (paymentSaveRef.current) return;
    paymentSaveRef.current = true;
    setIsSavingPayment(true);
    setPaymentMessage("Guardando estado de pago...");
    try {
      await onPaymentStatusChange(paymentStatus);
      setPaymentMessage("Estado de pago guardado. No se envió ninguna notificación.");
    } catch {
      setPaymentMessage("No se pudo guardar el estado de pago. Volvé a seleccionarlo para reintentar.");
    } finally {
      paymentSaveRef.current = false;
      setIsSavingPayment(false);
    }
  }

  function updateTime(nextParts) {
    const nextHour = nextParts.hour12 ?? timeParts.hour12;
    const nextMinute = nextParts.minute ?? timeParts.minute;
    const nextMeridiem = nextParts.meridiem ?? timeParts.meridiem;

    setForm((prev) => ({
      ...prev,
      time: buildTimeValue(nextHour, nextMinute, nextMeridiem),
    }));
  }

  async function handleNotify() {
    setNotifyMessage("");
    setIsNotifying(true);
    try {
      const result = await onNotify(notifyMethod);
      setNotifyMessage(result?.message || "");
    } finally {
      setIsNotifying(false);
    }
  }

  useEffect(() => {
    if (!isTimePickerOpen) return undefined;

    function closeTimePicker(event) {
      if (timePickerRef.current?.contains(event.target)) return;
      setIsTimePickerOpen(false);
    }

    function closeTimePickerWithEscape(event) {
      if (event.key === "Escape") {
        setIsTimePickerOpen(false);
      }
    }

    document.addEventListener("mousedown", closeTimePicker);
    document.addEventListener("keydown", closeTimePickerWithEscape);

    return () => {
      document.removeEventListener("mousedown", closeTimePicker);
      document.removeEventListener("keydown", closeTimePickerWithEscape);
    };
  }, [isTimePickerOpen]);

  return (
    <div className="appointment-panel" role="dialog" aria-modal="true">
      <div className="appointment-panel__overlay" onClick={onClose} />
      <aside className="appointment-panel__body">
        <div className="appointment-panel__header">
          <div>
            <h2>{form.appointmentId ? "Editar turno" : "Nuevo turno"}</h2>
            <p>{form.date || "Selecciona fecha y hora"}</p>
          </div>
          <button type="button" className="appointment-panel__close" onClick={onClose}>
            x
          </button>
        </div>

        <label className="appointment-panel__field">
          Paciente
          <select
            value={form.patientId}
            onChange={(e) => {
              const patientId = e.target.value;
              const patient = patients.find((item) => String(item.id) === String(patientId));
              const nextMethod = patient?.email ? "email" : "";

              setForm((prev) => ({
                ...prev,
                patientId,
                feeAmount: prev.feeAmount || patient?.session_fee_amount || "",
                notifyMethod: nextMethod || prev.notifyMethod || "email",
                notifyOnSave: prev.appointmentId ? prev.notifyOnSave : Boolean(patient?.email),
              }));
            }}
          >
            <option value="">Sin paciente</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.full_name}
              </option>
            ))}
          </select>
        </label>

        <div className="appointment-panel__grid">
          <label className="appointment-panel__field" onClick={() => openPicker(dateInputRef)}>
            Fecha
            <input
              ref={dateInputRef}
              type="date"
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
            />
          </label>
          <label className="appointment-panel__field">
            Hora
            <div className="appointment-panel__time-picker" ref={timePickerRef}>
              <button
                type="button"
                className="appointment-panel__time-trigger"
                onClick={() => setIsTimePickerOpen((prev) => !prev)}
                aria-expanded={isTimePickerOpen}
              >
                <span>{formatTimeLabel(form.time)}</span>
                <span className="appointment-panel__time-icon" aria-hidden="true" />
              </button>

              {isTimePickerOpen && (
                <div className="appointment-panel__time-menu" role="listbox" aria-label="Seleccionar hora">
                  <div className="appointment-panel__time-column" aria-label="Hora">
                    {TIME_HOURS.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        className={hour === timeParts.hour12 ? "appointment-panel__time-option appointment-panel__time-option--active" : "appointment-panel__time-option"}
                        onClick={() => updateTime({ hour12: hour })}
                      >
                        {String(hour).padStart(2, "0")}
                      </button>
                    ))}
                  </div>

                  <div className="appointment-panel__time-column" aria-label="Minutos">
                    {TIME_MINUTES.map((minute) => (
                      <button
                        key={minute}
                        type="button"
                        className={minute === timeParts.minute ? "appointment-panel__time-option appointment-panel__time-option--active" : "appointment-panel__time-option"}
                        onClick={() => updateTime({ minute })}
                      >
                        {String(minute).padStart(2, "0")}
                      </button>
                    ))}
                  </div>

                  <div className="appointment-panel__time-column appointment-panel__time-column--meridiem" aria-label="Periodo">
                    {TIME_MERIDIEMS.map((meridiem) => (
                      <button
                        key={meridiem}
                        type="button"
                        className={meridiem === timeParts.meridiem ? "appointment-panel__time-option appointment-panel__time-option--active" : "appointment-panel__time-option"}
                        onClick={() => updateTime({ meridiem })}
                      >
                        {meridiem}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </label>
        </div>

        <label className="appointment-panel__field">
          Duracion
          <input
            type="number"
            min="10"
            step="10"
            placeholder={`${defaultSessionMinutes} min`}
            value={form.duration}
            onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
          />
        </label>

        <label className="appointment-panel__field">
          Lugar
          <select value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}>
            {locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>

        <div className="appointment-panel__billing">
          <div className="appointment-panel__section-title">Pagos</div>
          <div className="appointment-panel__grid">
            <label className="appointment-panel__field">
              Monto
              <input
                type="number"
                min="0"
                step="100"
                value={form.feeAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, feeAmount: e.target.value }))}
                placeholder={selectedPatient?.session_fee_amount ? String(selectedPatient.session_fee_amount) : "0"}
              />
            </label>
            <label className="appointment-panel__field">
              Estado de pago
              <select
                value={form.paymentStatus || "pending"}
                disabled={isSavingPayment || isSavingStatus}
                onChange={(e) => handlePaymentStatusChange(e.target.value)}
              >
                <option value="pending">Pendiente</option>
                <option value="paid">Pagado</option>
                <option value="waived">Bonificado</option>
              </select>
            </label>
          </div>
          <p className="appointment-panel__notify-message" role="status" aria-live="polite">
            {paymentMessage || (form.appointmentId
              ? "El estado de pago se guarda automáticamente al cambiarlo, sin notificar al paciente."
              : "El estado de pago se guardará al crear el turno.")}
          </p>
        </div>

        <label className="appointment-panel__field">
          Notas
          <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows="3" />
        </label>

        <label className="appointment-panel__check">
          <input
            type="checkbox"
            checked={form.repeatWeekly}
            onChange={(e) => setForm((prev) => ({ ...prev, repeatWeekly: e.target.checked }))}
          />
          Repetir semanalmente
        </label>

        {form.appointmentId && (
          <div className="appointment-panel__status-card">
            <label className="appointment-panel__field">
              Estado del turno
              <select value={form.status || "scheduled"} disabled={isSavingStatus || isSavingPayment} onChange={(e) => handleStatusChange(e.target.value)}>
                <option value="pending">Pendiente de confirmación</option>
                <option value="scheduled">Programado</option>
                <option value="attended">Atendido</option>
                <option value="no_show">Ausencia</option>
                <option value="cancelled">Cancelado</option>
                {form.status === "free" && <option value="free">Disponible</option>}
              </select>
            </label>
            <p className="appointment-panel__hint" role="status">
              {statusMessage || "Se guarda automáticamente al cambiarlo, sin notificar."}
            </p>
          </div>
        )}

        <div className="appointment-panel__notify">
          <div className="appointment-panel__section-title">
            {form.appointmentId ? "Notificar turno" : "Notificar al guardar"}
          </div>
          <label className="appointment-panel__check appointment-panel__check--compact">
            <input
              type="checkbox"
              checked={form.notifyOnSave}
              disabled={!canNotifyPatient}
              onChange={(e) => setForm((prev) => ({ ...prev, notifyOnSave: e.target.checked }))}
            />
            {form.appointmentId ? "Notificar al guardar cambios" : "Enviar notificacion"}
          </label>
          <div className="appointment-panel__email-label">
              <img className="appointment-panel__choice-icon" src={mailIcon} alt="" aria-hidden="true" />
              Por email
          </div>
          {!selectedPatient && (
            <p className="appointment-panel__notify-message">
              Elegi un paciente para poder enviar la notificacion.
            </p>
          )}
          {selectedPatient && !canNotifyPatient && (
            <p className="appointment-panel__notify-message">
              Este paciente no tiene email cargado.
            </p>
          )}
        </div>

        <div className="appointment-panel__actions">
          <button type="button" className="appointment-panel__save" onClick={onSave} disabled={isSavingPayment || isSavingStatus || isNotifying}>
            {shouldNotifyOnSave ? "Guardar y notificar" : "Guardar"}
          </button>
          <button type="button" className="appointment-panel__ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {form.appointmentId && (
          <details className="appointment-panel__more">
            <summary>Más opciones</summary>
            <div className="appointment-panel__more-content">
              <button type="button" className="appointment-panel__text-action" disabled={isNotifying || !canNotifyPatient || !canUseNotifyMethod} onClick={handleNotify}>
                {isNotifying ? "Enviando..." : "Reenviar aviso por email"}
              </button>
              <p className="appointment-panel__hint">Envía el aviso del turno sin guardar los cambios del formulario.</p>
              {notifyMessage && <p className="appointment-panel__notify-message" role="status">{notifyMessage}</p>}
              <button type="button" className="appointment-panel__text-action appointment-panel__text-action--danger" disabled={isSavingPayment || isSavingStatus || isNotifying} onClick={onDelete}>Eliminar turno</button>
            </div>
          </details>
        )}
      </aside>
    </div>
  );
}
