import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../services/api";
import "./AdminPsychologistDetail.css";

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-UY").format(new Date(value));
}

function getDisplayName(psychologist) {
  return psychologist?.profile?.full_name || psychologist?.email || "Psicologo";
}

function buildForm(nextPsychologist) {
  const profile = nextPsychologist?.profile || {};
  return {
    email: nextPsychologist?.email || "",
    full_name: profile.full_name || "",
    professional_title: profile.professional_title || "",
    office_address: profile.office_address || "",
    notification_email: profile.notification_email || "",
    default_session_minutes: nextPsychologist?.default_session_minutes || 50,
    visible_agenda_start_time: profile.visible_agenda_start_time || "06:00",
    visible_agenda_end_time: profile.visible_agenda_end_time || "22:00",
  };
}

export default function AdminPsychologistDetail() {
  const { psychologistId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [psychologist, setPsychologist] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [editing, setEditing] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    professional_title: "",
    office_address: "",
    notification_email: "",
    default_session_minutes: 50,
    visible_agenda_start_time: "06:00",
    visible_agenda_end_time: "22:00",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [msg, setMsg] = useState("");

  const loadPsychologist = useCallback(async ({ clearMessage = true } = {}) => {
    setLoading(true);
    if (clearMessage) setMsg("");
    try {
      const data = await api.get(`/admin/psychologists/${psychologistId}`);
      const nextPsychologist = data.psychologist || null;
      setPsychologist(nextPsychologist);
      setForm(buildForm(nextPsychologist));
      setAuditLogs(data.audit_logs || []);
      if (searchParams.get("resetPassword") === "1") {
        setResettingPassword(true);
      }
    } catch (error) {
      setMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [psychologistId, searchParams]);

  useEffect(() => {
    loadPsychologist();
  }, [loadPsychologist]);

  async function updateStatus(isActive) {
    setMsg("");
    try {
      const data = await api.patch(`/admin/psychologists/${psychologistId}/status`, {
        is_active: isActive,
      });
      setPsychologist(data.psychologist);
      await loadPsychologist({ clearMessage: false });
      setMsg(data.msg || "Estado actualizado");
    } catch (error) {
      setMsg(error.message);
    }
  }

  async function verifyEmail() {
    const confirmed = window.confirm(`Marcar como verificado el email ${psychologist.email}?`);
    if (!confirmed) return;

    setMsg("");
    try {
      const data = await api.patch(`/admin/psychologists/${psychologistId}/verify-email`, {});
      setPsychologist(data.psychologist);
      await loadPsychologist({ clearMessage: false });
      setMsg(data.msg || "Email verificado");
    } catch (error) {
      setMsg(error.message);
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEditing() {
    setForm(buildForm(psychologist));
    setEditing(true);
  }

  function cancelEditing() {
    setForm(buildForm(psychologist));
    setEditing(false);
    setMsg("");
  }

  function cancelPasswordReset() {
    setPasswordForm({ password: "", confirm: "" });
    setResettingPassword(false);
    setMsg("");
  }

  async function resetPassword(event) {
    event.preventDefault();
    setMsg("");

    if (passwordForm.password !== passwordForm.confirm) {
      setMsg("Las contraseñas no coinciden");
      return;
    }

    setSavingPassword(true);
    try {
      const data = await api.patch(`/admin/psychologists/${psychologistId}/password`, {
        password: passwordForm.password,
      });
      setPasswordForm({ password: "", confirm: "" });
      setResettingPassword(false);
      navigate(`/admin/psychologists/${psychologistId}`, { replace: true });
      setMsg(data.msg || "Password actualizado");
    } catch (error) {
      setMsg(error.message);
    } finally {
      setSavingPassword(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const data = await api.patch(`/admin/psychologists/${psychologistId}`, {
        ...form,
        default_session_minutes: Number(form.default_session_minutes),
      });
      setPsychologist(data.psychologist);
      await loadPsychologist({ clearMessage: false });
      setMsg(data.msg || "Datos actualizados");
      setEditing(false);
    } catch (error) {
      setMsg(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="admin-detail__loading">Cargando...</div>;
  }

  if (!psychologist) {
    return (
      <section className="admin-detail">
        <button type="button" className="admin-detail__back" onClick={() => navigate("/admin")}>
          Volver
        </button>
        <div className="admin-detail__message">{msg || "No se encontro el psicologo."}</div>
      </section>
    );
  }

  const profile = psychologist.profile || {};

  return (
    <section className="admin-detail">
      <button type="button" className="admin-detail__back" onClick={() => navigate("/admin")}>
        Volver
      </button>

      <div className="admin-detail__hero">
        <div>
          <span className="admin-detail__eyebrow">Detalle profesional</span>
          <h1>{getDisplayName(psychologist)}</h1>
          <p>{psychologist.email}</p>
        </div>
        <div className="admin-detail__actions">
          <span
            className={
              psychologist.is_active
                ? "admin-detail__status admin-detail__status--active"
                : "admin-detail__status"
            }
          >
            {psychologist.is_active ? "Activo" : "Inactivo"}
          </span>
          <span
            className={
              psychologist.email_verified
                ? "admin-detail__status admin-detail__status--active"
                : "admin-detail__status admin-detail__status--pending"
            }
          >
            {psychologist.email_verified ? "Email verificado" : "Email pendiente"}
          </span>
          <button type="button" onClick={() => updateStatus(!psychologist.is_active)}>
            {psychologist.is_active ? "Desactivar" : "Activar"}
          </button>
          {!psychologist.email_verified && (
            <button type="button" onClick={verifyEmail}>
              Verificar email
            </button>
          )}
          <button type="button" onClick={startEditing}>
            Editar
          </button>
          <button type="button" onClick={() => setResettingPassword(true)}>
            Reset password
          </button>
        </div>
      </div>

      {msg && <div className="admin-detail__message">{msg}</div>}

      {resettingPassword && (
        <article className="admin-detail__card admin-detail__card--wide admin-detail__reset-card">
          <div className="admin-detail__card-head">
            <div>
              <h2>Reset password</h2>
              <p className="admin-detail__hint">
                Minimo 8 caracteres, con mayuscula, minuscula y numero.
              </p>
            </div>
            <div className="admin-detail__edit-actions">
              <button type="button" onClick={cancelPasswordReset}>
                Cancelar
              </button>
              <button type="submit" form="admin-password-form" disabled={savingPassword}>
                {savingPassword ? "Guardando..." : "Actualizar password"}
              </button>
            </div>
          </div>
          <form id="admin-password-form" className="admin-detail__form" onSubmit={resetPassword}>
            <label>
              Password temporal
              <input
                value={passwordForm.password}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, password: event.target.value }))
                }
                type="password"
              />
            </label>
            <label>
              Confirmar password
              <input
                value={passwordForm.confirm}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, confirm: event.target.value }))
                }
                type="password"
              />
            </label>
          </form>
        </article>
      )}

      <div className="admin-detail__stats">
        <div>
          <span>{psychologist.patient_count}</span>
          <strong>Pacientes</strong>
        </div>
        <div>
          <span>{psychologist.appointment_count}</span>
          <strong>Turnos</strong>
        </div>
        <div>
          <span>{psychologist.has_profile ? "Completo" : "Pendiente"}</span>
          <strong>Perfil</strong>
        </div>
      </div>

      <div className="admin-detail__grid">
        <article className="admin-detail__card">
          <h2>Cuenta</h2>
          <dl>
            <div>
              <dt>Email</dt>
              <dd>{psychologist.email}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>{psychologist.role}</dd>
            </div>
            <div>
              <dt>Verificacion email</dt>
              <dd>{psychologist.email_verified ? "Verificado" : "Pendiente"}</dd>
            </div>
            <div>
              <dt>Fecha de alta</dt>
              <dd>{formatDate(psychologist.created_at)}</dd>
            </div>
            <div>
              <dt>Duracion de sesion</dt>
              <dd>{psychologist.default_session_minutes} minutos</dd>
            </div>
          </dl>
        </article>

        <article className="admin-detail__card">
          <h2>Perfil publico</h2>
          <dl>
            <div>
              <dt>Nombre</dt>
              <dd>{profile.full_name || "-"}</dd>
            </div>
            <div>
              <dt>Titulo</dt>
              <dd>{profile.professional_title || "-"}</dd>
            </div>
            <div>
              <dt>Consultorio</dt>
              <dd>{profile.office_address || "-"}</dd>
            </div>
            <div>
              <dt>Email de notificaciones</dt>
              <dd>{profile.notification_email || "-"}</dd>
            </div>
          </dl>
        </article>

        {editing && (
        <article className="admin-detail__card admin-detail__card--wide">
          <div className="admin-detail__card-head">
            <h2>Editar datos basicos</h2>
            <div className="admin-detail__edit-actions">
              <button type="button" onClick={cancelEditing}>
                Cancelar
              </button>
              <button type="submit" form="admin-psychologist-form" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
          <form id="admin-psychologist-form" className="admin-detail__form" onSubmit={saveProfile}>
            <label>
              Email de cuenta
              <input
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
                type="email"
              />
            </label>
            <label>
              Nombre
              <input
                value={form.full_name}
                onChange={(event) => updateForm("full_name", event.target.value)}
              />
            </label>
            <label>
              Titulo profesional
              <input
                value={form.professional_title}
                onChange={(event) => updateForm("professional_title", event.target.value)}
              />
            </label>
            <label>
              Consultorio
              <input
                value={form.office_address}
                onChange={(event) => updateForm("office_address", event.target.value)}
              />
            </label>
            <label>
              Email de notificaciones
              <input
                value={form.notification_email}
                onChange={(event) => updateForm("notification_email", event.target.value)}
                type="email"
              />
            </label>
            <label>
              Duracion de sesion
              <input
                value={form.default_session_minutes}
                onChange={(event) => updateForm("default_session_minutes", event.target.value)}
                min="1"
                type="number"
              />
            </label>
            <label>
              Agenda desde
              <input
                value={form.visible_agenda_start_time}
                onChange={(event) => updateForm("visible_agenda_start_time", event.target.value)}
                type="time"
              />
            </label>
            <label>
              Agenda hasta
              <input
                value={form.visible_agenda_end_time}
                onChange={(event) => updateForm("visible_agenda_end_time", event.target.value)}
                type="time"
              />
            </label>
          </form>
        </article>
        )}

        <article className="admin-detail__card admin-detail__card--wide">
          <h2>Configuracion</h2>
          <dl>
            <div>
              <dt>Agenda visible</dt>
              <dd>
                {profile.visible_agenda_start_time || "06:00"} a{" "}
                {profile.visible_agenda_end_time || "22:00"}
              </dd>
            </div>
            <div>
              <dt>Recordatorios automaticos</dt>
              <dd>{profile.auto_reminders_enabled ? "Activados" : "Desactivados"}</dd>
            </div>
            <div>
              <dt>Metodo de recordatorio</dt>
              <dd>{profile.auto_reminder_method || "-"}</dd>
            </div>
            <div>
              <dt>Horas previas</dt>
              <dd>{profile.auto_reminder_hours_before || 24}</dd>
            </div>
          </dl>
        </article>

        <article className="admin-detail__card admin-detail__card--wide">
          <h2>Auditoria reciente</h2>
          {auditLogs.length === 0 ? (
            <p className="admin-detail__empty">Todavia no hay acciones administrativas registradas.</p>
          ) : (
            <div className="admin-detail__audit-list">
              {auditLogs.map((log) => (
                <div key={log.id} className="admin-detail__audit-item">
                  <strong>{log.detail || log.action}</strong>
                  <span>
                    {formatDate(log.created_at)} por {log.admin_email || "admin"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
