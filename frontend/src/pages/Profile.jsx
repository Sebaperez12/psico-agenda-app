import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./Profile.css";

export default function Profile() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [autoRemindersEnabled, setAutoRemindersEnabled] = useState(false);
  const [autoReminderMethod, setAutoReminderMethod] = useState("email");
  const [autoReminderHoursBefore, setAutoReminderHoursBefore] = useState(24);
  const [publicBookingEnabled, setPublicBookingEnabled] = useState(false);
  const [publicBookingMinNoticeHours, setPublicBookingMinNoticeHours] = useState(24);
  const [bookingSlug, setBookingSlug] = useState("");
  const [officeAddresses, setOfficeAddresses] = useState(["", "", "", "", ""]);
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [isCreate, setIsCreate] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailTestRecipient, setEmailTestRecipient] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [sendingEmailTest, setSendingEmailTest] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMsg("La foto debe ser una imagen");
      return;
    }
    if (file.size > 1_800_000) {
      setMsg("La foto es demasiado grande. Usa una imagen menor a 1.8 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(String(reader.result || ""));
    reader.onerror = () => setMsg("No se pudo leer la foto");
    reader.readAsDataURL(file);
  };

  async function loadProfile() {
    setMsg("");
    setLoading(true);
    try {
      const data = await api.get("/profile");
      setEmail(data.email || "");
      setEmailVerified(!!data.email_verified);
      setNotificationEmail(data.notification_email || "");
      setAutoRemindersEnabled(!!data.auto_reminders_enabled);
      setAutoReminderMethod(data.auto_reminder_method || "email");
      setAutoReminderHoursBefore(data.auto_reminder_hours_before || 24);
      setPublicBookingEnabled(!!data.public_booking_enabled);
      setPublicBookingMinNoticeHours(data.public_booking_min_notice_hours ?? 24);
      setBookingSlug(data.booking_slug || "");
      setFullName(data.full_name || "");
      setTitle(data.professional_title || "");
      setDescription(data.description || "");
      setOfficeAddresses(buildOfficeAddresses(data.office_addresses, data.office_address));
      setPhotoDataUrl(data.photo_data_url || "");
      setIsCreate(false);
    } catch (e) {
      if (e.status === 404) {
        const me = await api.get("/me");
        setEmail(me?.user?.email || "");
        setEmailVerified(!!me?.user?.email_verified);
        setNotificationEmail("");
        setAutoRemindersEnabled(false);
        setAutoReminderMethod("email");
        setAutoReminderHoursBefore(24);
        setPublicBookingEnabled(false);
        setPublicBookingMinNoticeHours(24);
        setBookingSlug("");
        setFullName("");
        setTitle("");
        setDescription("");
        setOfficeAddresses(["", "", "", "", ""]);
        setPhotoDataUrl("");
        setIsCreate(true);
      } else {
        console.error(e);
        setMsg(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadEmailStatus() {
    setCheckingEmail(true);
    try {
      const data = await api.get("/email/status");
      setEmailStatus(data);
      setEmailTestRecipient((prev) => prev || notificationEmail || email || "");
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    } finally {
      setCheckingEmail(false);
    }
  }

  async function sendEmailTest() {
    setMsg("");
    setSendingEmailTest(true);
    try {
      const data = await api.post("/email/test", {
        recipient: emailTestRecipient.trim() || notificationEmail || email,
      });
      setMsg(data.msg || "Email de prueba enviado");
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    } finally {
      setSendingEmailTest(false);
    }
  }

  async function resendVerificationEmail() {
    setMsg("");
    setResendingVerification(true);
    try {
      const data = await api.post("/auth/resend-verification", {});
      setMsg(data.msg || "Email de verificacion reenviado");
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    } finally {
      setResendingVerification(false);
    }
  }

  async function saveProfile() {
    setMsg("");
    setSaving(true);
    try {
      const cleanedOfficeAddresses = officeAddresses
        .map((address) => address.trim())
        .filter(Boolean)
        .slice(0, 5);

      const payload = {
        full_name: fullName.trim(),
        professional_title: title.trim(),
        description: description.trim() || null,
        office_address: cleanedOfficeAddresses[0] || "",
        office_addresses: cleanedOfficeAddresses,
        notification_email: notificationEmail.trim().toLowerCase() || null,
        auto_reminders_enabled: autoRemindersEnabled,
        auto_reminder_method: autoReminderMethod,
        auto_reminder_hours_before: Number(autoReminderHoursBefore) || 24,
        public_booking_enabled: publicBookingEnabled,
        public_booking_min_notice_hours: Number(publicBookingMinNoticeHours) || 0,
        booking_slug: bookingSlug.trim(),
        photo_data_url: photoDataUrl || null,
      };

      if (isCreate) {
        await api.post("/profile", payload);
        setMsg("Perfil creado exitosamente");
        setIsCreate(false);
      } else {
        await api.patch("/profile", payload);
        setMsg("Perfil actualizado exitosamente");
      }

      await loadProfile();
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    setMsg("");
    if (deleteConfirmEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      setMsg("Para eliminar la cuenta, escribe tu email de registro.");
      return;
    }
    const confirmed = window.confirm(
      "Esta accion elimina tu cuenta, pacientes, turnos y disponibilidad. No se puede deshacer.",
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await api.delete("/account", { confirm_email: deleteConfirmEmail });
      localStorage.removeItem("token");
      navigate("/login", { replace: true });
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    } finally {
      setDeleting(false);
    }
  }

  async function copyBookingLink() {
    const link = `${window.location.origin}/reservar/${bookingSlug}`;
    try {
      await navigator.clipboard.writeText(link);
      setMsg("Link de reservas copiado");
    } catch {
      setMsg(link);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadEmailStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (loading) {
    return <div className="profile-page">Cargando...</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-page__header">
        <h1 className="profile-page__title">Mi Perfil</h1>
        <p className="profile-page__description">
          Completa y edita tu información profesional. Si cargas un email de notificaciones, ese se usará como respuesta en los mails; si lo dejas vacío, se usará tu email de registro.
        </p>
      </div>

      <div className="profile-page__form">
        <div className="profile-page__photo-section">
          <div className="profile-page__photo-frame">
            {photoDataUrl ? (
              <img src={photoDataUrl} alt="Foto profesional" className="profile-page__photo" />
            ) : (
              <div className="profile-page__photo-placeholder">
                {fullName ? fullName.slice(0, 1).toUpperCase() : "P"}
              </div>
            )}
          </div>

          <div className="profile-page__photo-actions">
            <label className="profile-page__btn profile-page__btn--file">
              Subir foto
              <input type="file" accept="image/*" onChange={handlePhotoChange} hidden />
            </label>
            {photoDataUrl && (
              <button
                type="button"
                className="profile-page__btn"
                onClick={() => setPhotoDataUrl("")}
              >
                Quitar foto
              </button>
            )}
          </div>
        </div>

        <input className="profile-page__input" value={email} readOnly placeholder="Email" />
        <div className={`profile-page__verify-banner${emailVerified ? " profile-page__verify-banner--ok" : ""}`}>
          <span>{emailVerified ? "Email verificado" : "Email pendiente de verificacion"}</span>
          {!emailVerified && (
            <button
              type="button"
              className="profile-page__btn"
              onClick={resendVerificationEmail}
              disabled={resendingVerification}
            >
              {resendingVerification ? "Enviando..." : "Reenviar confirmacion"}
            </button>
          )}
        </div>
        <input
          className="profile-page__input"
          value={notificationEmail}
          onChange={(e) => setNotificationEmail(e.target.value)}
          placeholder="Email para notificaciones (opcional)"
        />
        <div className="profile-page__section profile-page__email-section">
          <p className="profile-page__section-label">Email</p>
          <div className="profile-page__email-status">
            <span>Modo: {emailStatus?.email_mode || "-"}</span>
            <span>Sender: {emailStatus?.mail_default_sender || "Sin configurar"}</span>
            <span>Brevo API: {emailStatus?.brevo_api_key_configured ? "Configurado" : "Sin configurar"}</span>
          </div>
          <div className="profile-page__email-test">
            <input
              className="profile-page__input"
              value={emailTestRecipient}
              onChange={(e) => setEmailTestRecipient(e.target.value)}
              placeholder="Email de prueba"
            />
            <button
              type="button"
              className="profile-page__btn"
              onClick={sendEmailTest}
              disabled={sendingEmailTest}
            >
              {sendingEmailTest ? "Enviando..." : "Probar email"}
            </button>
            <button
              type="button"
              className="profile-page__btn"
              onClick={loadEmailStatus}
              disabled={checkingEmail}
            >
              {checkingEmail ? "Revisando..." : "Actualizar estado"}
            </button>
          </div>
        </div>
        <div className="profile-page__section">
          <p className="profile-page__section-label">Recordatorios automáticos</p>
          <label className="profile-page__toggle">
            <input
              type="checkbox"
              checked={autoRemindersEnabled}
              onChange={(e) => setAutoRemindersEnabled(e.target.checked)}
            />
            Activar recordatorios automáticos
          </label>

          {autoRemindersEnabled && (
            <div className="profile-page__reminder-card">
              <p className="profile-page__reminder-help">
                La app enviará el recordatorio automáticamente antes del turno.
              </p>
              <div className="profile-page__reminder-grid">
                <select
                  className="profile-page__input"
                  value={autoReminderMethod}
                  onChange={(e) => setAutoReminderMethod(e.target.value)}
                >
                  <option value="email">Por email</option>
                  <option value="whatsapp">Por WhatsApp</option>
                </select>
                <select
                  className="profile-page__input"
                  value={autoReminderHoursBefore}
                  onChange={(e) => setAutoReminderHoursBefore(Number(e.target.value))}
                >
                  <option value={24}>24 horas antes</option>
                  <option value={2}>2 horas antes</option>
                </select>
              </div>
            </div>
          )}
        </div>
        <div className="profile-page__section profile-page__booking-section">
          <p className="profile-page__section-label">Reservas online</p>
          <label className="profile-page__toggle">
            <input
              type="checkbox"
              checked={publicBookingEnabled}
              onChange={(e) => setPublicBookingEnabled(e.target.checked)}
            />
            Permitir que pacientes reserven desde un link publico
          </label>

          <div className="profile-page__booking-grid">
            <label>
              Link publico
              <input
                className="profile-page__input"
                value={bookingSlug}
                onChange={(e) => setBookingSlug(e.target.value)}
                placeholder="mi-agenda"
              />
            </label>
            <label>
              Anticipacion minima
              <select
                className="profile-page__input"
                value={publicBookingMinNoticeHours}
                onChange={(e) => setPublicBookingMinNoticeHours(Number(e.target.value))}
              >
                <option value={0}>Sin anticipacion</option>
                <option value={2}>2 horas</option>
                <option value={12}>12 horas</option>
                <option value={24}>24 horas</option>
                <option value={48}>48 horas</option>
                <option value={72}>72 horas</option>
              </select>
            </label>
          </div>

          {bookingSlug && (
            <div className="profile-page__booking-link">
              <span>{`${window.location.origin}/reservar/${bookingSlug}`}</span>
              <button type="button" className="profile-page__btn" onClick={copyBookingLink}>
                Copiar
              </button>
            </div>
          )}
        </div>
        <input
          className="profile-page__input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nombre y apellido"
        />
        <input
          className="profile-page__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título profesional (ej: Psicólogo Clínico)"
        />
        <textarea
          className="profile-page__textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción breve (ej: Especializado en terapia cognitivo-conductual)"
          rows="4"
        />
        <div className="profile-page__addresses">
          <p className="profile-page__section-label">Direcciones de atención</p>
          {officeAddresses.map((address, index) => (
            <input
              key={index}
              className="profile-page__input"
              value={address}
              onChange={(e) =>
                setOfficeAddresses((prev) =>
                  prev.map((item, itemIndex) => (itemIndex === index ? e.target.value : item))
                )
              }
              placeholder={`Dirección ${index + 1}${index === 0 ? " (principal)" : " (opcional)"}`}
            />
          ))}
        </div>

        <div className="profile-page__actions">
          <button
            className="profile-page__btn profile-page__btn--primary"
            onClick={saveProfile}
            disabled={saving}
          >
            {saving ? "Guardando..." : isCreate ? "Crear Perfil" : "Guardar Cambios"}
          </button>
          <button className="profile-page__btn" onClick={loadProfile} disabled={saving}>
            Cancelar
          </button>
        </div>

        <div className="profile-page__danger-zone">
          <div>
            <p className="profile-page__section-label">Eliminar cuenta</p>
            <p className="profile-page__danger-help">
              Borra tu cuenta, pacientes, turnos, disponibilidad y perfil profesional.
            </p>
          </div>
          <input
            className="profile-page__input profile-page__danger-input"
            value={deleteConfirmEmail}
            onChange={(e) => setDeleteConfirmEmail(e.target.value)}
            placeholder="Escribe tu email para confirmar"
          />
          <button
            type="button"
            className="profile-page__btn profile-page__btn--danger"
            onClick={deleteAccount}
            disabled={deleting}
          >
            {deleting ? "Eliminando..." : "Eliminar mi cuenta"}
          </button>
        </div>

        {msg && <p className="profile-page__msg">{msg}</p>}
      </div>
    </div>
  );
}

function buildOfficeAddresses(officeAddresses = [], fallbackAddress = "") {
  const normalized = Array.isArray(officeAddresses)
    ? officeAddresses.map((address) => String(address || "").trim()).filter(Boolean).slice(0, 5)
    : [];

  if (!normalized.length && fallbackAddress) {
    normalized.push(String(fallbackAddress).trim());
  }

  while (normalized.length < 5) {
    normalized.push("");
  }

  return normalized;
}
