import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./AdminPsychologists.css";

function getDisplayName(psychologist) {
  return psychologist?.profile?.full_name || psychologist?.email || "Sin nombre";
}

export default function AdminPsychologists() {
  const navigate = useNavigate();
  const [psychologists, setPsychologists] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [passwordResetRequests, setPasswordResetRequests] = useState([]);
  const [siteVisitStats, setSiteVisitStats] = useState({
    total_visits: 0,
    unique_visitors: 0,
    today_visits: 0,
  });
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    full_name: "",
    professional_title: "",
    office_address: "",
    notification_email: "",
    visible_agenda_start_time: "06:00",
    visible_agenda_end_time: "22:00",
    is_active: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadPsychologists();
  }, []);

  async function loadPsychologists() {
    setLoading(true);
    setMsg("");
    try {
      const data = await api.get("/admin/psychologists");
      setPsychologists(data.psychologists || []);
      setAdminUsers(data.admin_users || []);
      setPasswordResetRequests(data.password_reset_requests || []);
      setSiteVisitStats(data.site_visit_stats || {
        total_visits: 0,
        unique_visitors: 0,
        today_visits: 0,
      });
    } catch (error) {
      setMsg(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(psychologist, isActive) {
    setMsg("");
    try {
      const data = await api.patch(`/admin/psychologists/${psychologist.id}/status`, {
        is_active: isActive,
      });
      setPsychologists((current) =>
        current.map((item) => (item.id === psychologist.id ? data.psychologist : item))
      );
    } catch (error) {
      setMsg(error.message);
    }
  }

  async function demoteAdmin(adminUser) {
    const confirmed = window.confirm(`Quitar rol admin a ${adminUser.email}?`);
    if (!confirmed) return;

    setMsg("");
    try {
      const data = await api.patch(`/admin/users/${adminUser.id}/demote`, {});
      setMsg(data.msg || "Rol admin actualizado");
      await loadPsychologists();
    } catch (error) {
      setMsg(error.message);
    }
  }

  async function deletePsychologist(psychologist) {
    const displayName = getDisplayName(psychologist);
    const confirmed = window.confirm(
      `Vas a borrar a ${displayName} y todos sus pacientes, turnos y configuraciones. Esta accion no se puede deshacer.`
    );
    if (!confirmed) return;

    const confirmEmail = window.prompt(`Para confirmar, escribi el email del psicologo: ${psychologist.email}`);
    if (!confirmEmail) return;
    if (confirmEmail.trim().toLowerCase() !== psychologist.email.trim().toLowerCase()) {
      setMsg("El email no coincide. No se elimino el psicologo.");
      return;
    }

    setDeletingId(psychologist.id);
    setMsg("");
    try {
      const data = await api.delete(`/admin/psychologists/${psychologist.id}`, {
        confirm_email: confirmEmail,
      });
      setPsychologists((current) => current.filter((item) => item.id !== psychologist.id));
      setMsg(data.msg || "Psicologo eliminado");
    } catch (error) {
      setMsg(error.message);
    } finally {
      setDeletingId(null);
    }
  }

  function updateCreateForm(field, value) {
    setCreateForm((current) => ({ ...current, [field]: value }));
  }

  function resetCreateForm() {
    setCreateForm({
      email: "",
      password: "",
      full_name: "",
      professional_title: "",
      office_address: "",
      notification_email: "",
      visible_agenda_start_time: "06:00",
      visible_agenda_end_time: "22:00",
      is_active: true,
    });
  }

  async function createPsychologist(event) {
    event.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const data = await api.post("/admin/psychologists", createForm);
      setPsychologists((current) => [data.psychologist, ...current]);
      resetCreateForm();
      setCreating(false);
      setMsg(data.msg || "Psicologo creado");
    } catch (error) {
      setMsg(error.message);
    } finally {
      setSaving(false);
    }
  }

  const filteredPsychologists = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return psychologists;
    return psychologists.filter((psychologist) => {
      const profile = psychologist.profile || {};
      return [psychologist.email, profile.full_name, profile.professional_title]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [psychologists, query]);

  const totals = useMemo(() => {
    return psychologists.reduce(
      (acc, psychologist) => {
        acc.total += 1;
        if (psychologist.is_active) acc.active += 1;
        if (!psychologist.has_profile) acc.incomplete += 1;
        return acc;
      },
      { total: 0, active: 0, incomplete: 0 }
    );
  }, [psychologists]);

  return (
    <section className="admin-psychologists">
      <div className="admin-psychologists__hero">
        <div>
          <span className="admin-psychologists__eyebrow">Panel administrador</span>
          <h1>Psicologos</h1>
          <p>Gestion de cuentas profesionales, estado operativo y datos de perfil.</p>
        </div>
        <div className="admin-psychologists__hero-actions">
          <button type="button" onClick={() => setCreating((value) => !value)}>
            {creating ? "Cerrar" : "Nuevo psicologo"}
          </button>
          <button type="button" onClick={loadPsychologists}>
            Actualizar
          </button>
        </div>
      </div>

      {creating && (
        <form className="admin-psychologists__create" onSubmit={createPsychologist}>
          <div className="admin-psychologists__create-head">
            <h2>Nuevo psicologo</h2>
            <label>
              <input
                checked={createForm.is_active}
                onChange={(event) => updateCreateForm("is_active", event.target.checked)}
                type="checkbox"
              />
              Activo
            </label>
          </div>
          <div className="admin-psychologists__create-grid">
            <label>
              Email
              <input
                value={createForm.email}
                onChange={(event) => updateCreateForm("email", event.target.value)}
                type="email"
              />
            </label>
            <label>
              Password temporal
              <input
                value={createForm.password}
                onChange={(event) => updateCreateForm("password", event.target.value)}
                type="password"
              />
              <small>Minimo 8 caracteres, con mayuscula, minuscula y numero.</small>
            </label>
            <label>
              Nombre
              <input
                value={createForm.full_name}
                onChange={(event) => updateCreateForm("full_name", event.target.value)}
              />
            </label>
            <label>
              Titulo profesional
              <input
                value={createForm.professional_title}
                onChange={(event) => updateCreateForm("professional_title", event.target.value)}
              />
            </label>
            <label>
              Consultorio
              <input
                value={createForm.office_address}
                onChange={(event) => updateCreateForm("office_address", event.target.value)}
              />
            </label>
            <label>
              Email de notificaciones
              <input
                value={createForm.notification_email}
                onChange={(event) => updateCreateForm("notification_email", event.target.value)}
                type="email"
              />
            </label>
            <label>
              Agenda desde
              <input
                value={createForm.visible_agenda_start_time}
                onChange={(event) => updateCreateForm("visible_agenda_start_time", event.target.value)}
                type="time"
              />
            </label>
            <label>
              Agenda hasta
              <input
                value={createForm.visible_agenda_end_time}
                onChange={(event) => updateCreateForm("visible_agenda_end_time", event.target.value)}
                type="time"
              />
            </label>
          </div>
          <div className="admin-psychologists__create-actions">
            <button type="button" onClick={() => { resetCreateForm(); setCreating(false); }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Creando..." : "Crear psicologo"}
            </button>
          </div>
        </form>
      )}

      <section className="admin-psychologists__admins">
        <div className="admin-psychologists__reset-head">
          <h2>Administradores</h2>
          <span>{adminUsers.length}</span>
        </div>
        <div className="admin-psychologists__admin-list">
          {adminUsers.map((adminUser) => (
            <div key={adminUser.id} className="admin-psychologists__admin-item">
              <div>
                <strong>{adminUser.email}</strong>
                <span>{adminUser.configured ? "Configurado en Render" : "Guardado en base de datos"}</span>
              </div>
              <button
                type="button"
                disabled={adminUser.configured}
                onClick={() => demoteAdmin(adminUser)}
              >
                Quitar admin
              </button>
            </div>
          ))}
          {adminUsers.length === 0 && (
            <p className="admin-psychologists__empty">No hay administradores para mostrar.</p>
          )}
        </div>
      </section>

      <div className="admin-psychologists__stats">
        <div>
          <span>{totals.total}</span>
          <strong>Total</strong>
        </div>
        <div>
          <span>{totals.active}</span>
          <strong>Activos</strong>
        </div>
        <div>
          <span>{totals.incomplete}</span>
          <strong>Perfil pendiente</strong>
        </div>
        <div>
          <span>{siteVisitStats.total_visits}</span>
          <strong>Visitas landing</strong>
        </div>
        <div>
          <span>{siteVisitStats.unique_visitors}</span>
          <strong>Visitantes unicos</strong>
        </div>
        <div>
          <span>{siteVisitStats.today_visits}</span>
          <strong>Visitas hoy</strong>
        </div>
      </div>

      {passwordResetRequests.length > 0 && (
        <section className="admin-psychologists__reset-alert">
          <div className="admin-psychologists__reset-head">
            <h2>Solicitudes de recuperacion</h2>
            <span>{passwordResetRequests.length}</span>
          </div>
          <div className="admin-psychologists__reset-list">
            {passwordResetRequests.map((request) => (
              <div key={request.id} className="admin-psychologists__reset-item">
                <div>
                  <strong>{request.user_name}</strong>
                  <span>{request.user_email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/psychologists/${request.user_id}?resetPassword=1`)}
                >
                  Reset password
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="admin-psychologists__toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre, email o titulo"
        />
      </div>

      {msg && <div className="admin-psychologists__message">{msg}</div>}

      <div className="admin-psychologists__panel">
        {loading ? (
          <div className="admin-psychologists__empty">Cargando...</div>
        ) : filteredPsychologists.length === 0 ? (
          <div className="admin-psychologists__empty">No hay psicologos para mostrar.</div>
        ) : (
          <div className="admin-psychologists__table-wrap">
            <table className="admin-psychologists__table">
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th>Estado</th>
                  <th>Pacientes</th>
                  <th>Turnos</th>
                  <th>Alta</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {filteredPsychologists.map((psychologist) => (
                  <tr key={psychologist.id}>
                    <td>
                      <strong>{getDisplayName(psychologist)}</strong>
                      <span>{psychologist.email}</span>
                      {psychologist.profile?.professional_title && (
                        <small>{psychologist.profile.professional_title}</small>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          psychologist.is_active
                            ? "admin-psychologists__status admin-psychologists__status--active"
                            : "admin-psychologists__status"
                        }
                      >
                        {psychologist.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>{psychologist.patient_count}</td>
                    <td>{psychologist.appointment_count}</td>
                    <td>
                      {psychologist.created_at
                        ? new Intl.DateTimeFormat("es-UY").format(new Date(psychologist.created_at))
                        : "-"}
                    </td>
                    <td>
                      <div className="admin-psychologists__actions">
                        <button
                          type="button"
                          className="admin-psychologists__status-btn"
                          onClick={() => navigate(`/admin/psychologists/${psychologist.id}`)}
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          className="admin-psychologists__status-btn admin-psychologists__status-btn--secondary"
                          onClick={() => updateStatus(psychologist, !psychologist.is_active)}
                          disabled={deletingId === psychologist.id}
                        >
                          {psychologist.is_active ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          className="admin-psychologists__status-btn admin-psychologists__status-btn--danger"
                          onClick={() => deletePsychologist(psychologist)}
                          disabled={deletingId === psychologist.id}
                        >
                          {deletingId === psychologist.id ? "Borrando..." : "Borrar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
