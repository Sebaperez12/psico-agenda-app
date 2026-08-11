import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "./Availability.css";

const dayNames = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
const dayInitials = ["LU", "MA", "MI", "JU", "VI", "SA", "DO"];

function buildTimeOptions(step = 10) {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += step) {
      const hh = String(hour).padStart(2, "0");
      const mm = String(min).padStart(2, "0");
      times.push(`${hh}:${mm}`);
    }
  }
  return times;
}

export default function Availability() {
  const [rules, setRules] = useState([]);
  const [weekday, setWeekday] = useState(0);
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("22:00");
  const [visibleAgendaStartTime, setVisibleAgendaStartTime] = useState("06:00");
  const [visibleAgendaEndTime, setVisibleAgendaEndTime] = useState("22:00");
  const [savingVisibleRange, setSavingVisibleRange] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [savingRuleId, setSavingRuleId] = useState(null);
  const [msg, setMsg] = useState("");

  const timeOptions = useMemo(() => buildTimeOptions(10), []);
  const hourOptions = useMemo(() => buildTimeOptions(60), []);
  const availabilityTimeOptions = useMemo(
    () => timeOptions.filter((time) => time >= visibleAgendaStartTime && time <= visibleAgendaEndTime),
    [timeOptions, visibleAgendaEndTime, visibleAgendaStartTime]
  );

  async function loadRules() {
    setMsg("");
    try {
      const data = await api.get("/availability/rules");
      setRules(data.rules || []);
    } catch (e) {
      console.error(e);
      setRules([]);
      setMsg(e.message);
    }
  }

  async function loadProfileSettings() {
    try {
      const data = await api.get("/profile");
      const nextStartTime = data.visible_agenda_start_time || "06:00";
      const nextEndTime = data.visible_agenda_end_time || "22:00";
      setVisibleAgendaStartTime(nextStartTime);
      setVisibleAgendaEndTime(nextEndTime);
      setStartTime(nextStartTime);
      setEndTime(nextEndTime);
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function saveVisibleRange() {
    setMsg("");
    setSavingVisibleRange(true);
    try {
      await api.patch("/profile", {
        visible_agenda_start_time: visibleAgendaStartTime,
        visible_agenda_end_time: visibleAgendaEndTime,
      });
      setStartTime(visibleAgendaStartTime);
      setEndTime(visibleAgendaEndTime);
      setMsg("Rango visible actualizado");
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    } finally {
      setSavingVisibleRange(false);
    }
  }

  const rulesByWeekday = useMemo(() => {
    return dayNames.map((_, index) =>
      rules
        .filter((rule) => Number(rule.weekday) === index)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
    );
  }, [rules]);

  const configuredWeekdays = useMemo(
    () => rulesByWeekday
      .map((dayRules, index) => ({ dayRules, index }))
      .filter(({ dayRules }) => dayRules.length > 0),
    [rulesByWeekday]
  );

  function resetRuleForm() {
    setEditingRuleId(null);
    setWeekday(0);
    setStartTime(visibleAgendaStartTime);
    setEndTime(visibleAgendaEndTime);
  }

  function editRule(rule) {
    setMsg("");
    setEditingRuleId(rule.id);
    setWeekday(rule.weekday);
    setStartTime(rule.start_time);
    setEndTime(rule.end_time);
  }

  async function saveRule() {
    setMsg("");
    const payload = {
      weekday: Number(weekday),
      start_time: startTime,
      end_time: endTime,
      active: true,
    };

    try {
      if (editingRuleId) {
        await api.patch(`/availability/rules/${editingRuleId}`, payload);
        setMsg("Bloque actualizado");
      } else {
        await api.post("/availability/rules", payload);
        setMsg("Bloque creado");
      }

      await loadRules();
      resetRuleForm();
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function deleteRule(id) {
    setMsg("");
    try {
      await api.delete(`/availability/rules/${id}`);
      await loadRules();
      setMsg("Bloque eliminado");
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  async function toggleDayRules(dayRules) {
    const shouldDisable = dayRules.some((rule) => rule.active);
    setMsg("");
    try {
      for (const rule of dayRules) {
        if (rule.active === shouldDisable) {
          setSavingRuleId(rule.id);
          await api.patch(`/availability/rules/${rule.id}`, {
            active: !shouldDisable,
          });
        }
      }
      await loadRules();
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    } finally {
      setSavingRuleId(null);
    }
  }

  useEffect(() => {
    loadRules();
    loadProfileSettings();
  }, []);

  return (
    <div className="availability-page">
      <section className="availability-page__card availability-page__card--range">
        <div className="availability-page__section-head">
          <span className="availability-page__section-icon" aria-hidden="true">Cal</span>
          <div>
            <h1 className="availability-page__section-title">Horario general</h1>
            <p className="availability-page__section-help">
              Define el rango de horas en el que estas disponible.
            </p>
          </div>
        </div>

        <div className="availability-page__range-grid">
          <label className="availability-page__field">
            Desde
            <select
              className="availability-page__select"
              value={visibleAgendaStartTime}
              onChange={(e) => setVisibleAgendaStartTime(e.target.value)}
            >
              {hourOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>

          <label className="availability-page__field">
            Hasta
            <select
              className="availability-page__select"
              value={visibleAgendaEndTime}
              onChange={(e) => setVisibleAgendaEndTime(e.target.value)}
            >
              {hourOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>

          <button className="patients-page__btn patients-page__btn--primary" onClick={saveVisibleRange}>
            {savingVisibleRange ? "Guardando..." : "Guardar rango"}
          </button>
        </div>
      </section>

      <section className="availability-page__card">
        <div className="availability-page__section-toolbar">
          <div>
            <h2 className="availability-page__section-title">Bloques de disponibilidad</h2>
            <p className="availability-page__section-help">
              Configura los dias y horarios en los que atiendes.
            </p>
          </div>
          <button className="patients-page__btn availability-page__refresh" onClick={loadRules}>Refrescar</button>
        </div>

        <div className="availability-page__form">
          <label className="availability-page__field">
            Dia
            <select className="availability-page__select" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
              {dayNames.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </label>

          <label className="availability-page__field">
            Desde
            <select className="availability-page__select" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
              {availabilityTimeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>

          <label className="availability-page__field">
            Hasta
            <select className="availability-page__select" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
              {availabilityTimeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>

          <button className="patients-page__btn patients-page__btn--primary" onClick={saveRule}>
            {editingRuleId ? "Guardar" : "Agregar"}
          </button>
          {editingRuleId && (
            <button className="patients-page__btn" onClick={resetRuleForm}>Cancelar</button>
          )}
        </div>

        {configuredWeekdays.length === 0 ? (
          <p className="patients-page__empty">No hay bloques todavia.</p>
        ) : (
          <div className="availability-page__days">
            {configuredWeekdays.map(({ dayRules, index }) => {
              const day = dayNames[index];
              const hasActiveRule = dayRules.some((rule) => rule.active);

              return (
                <div className="availability-page__day-row" key={day}>
                  <div className="availability-page__day-badge">{dayInitials[index]}</div>
                  <strong className="availability-page__day-name">{day}</strong>
                  <div className="availability-page__day-hours">
                    {dayRules.map((rule) => (
                      <span
                        className={rule.active ? "availability-page__time-pill" : "availability-page__time-pill availability-page__time-pill--off"}
                        key={rule.id}
                      >
                        {rule.start_time} a {rule.end_time}
                      </span>
                    ))}
                  </div>
                  <div className="availability-page__day-actions">
                    <button
                      className={hasActiveRule ? "availability-page__switch availability-page__switch--on" : "availability-page__switch"}
                      onClick={() => toggleDayRules(dayRules)}
                      disabled={dayRules.some((rule) => savingRuleId === rule.id)}
                      aria-label={hasActiveRule ? `Desactivar ${day}` : `Activar ${day}`}
                      aria-pressed={hasActiveRule}
                    >
                      <span />
                    </button>
                    <button className="availability-page__icon-btn" onClick={() => editRule(dayRules[0])} aria-label={`Editar ${day}`}>
                      Editar
                    </button>
                    <button className="availability-page__icon-btn availability-page__icon-btn--danger" onClick={() => deleteRule(dayRules[0].id)} aria-label={`Eliminar ${day}`}>
                      Borrar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {msg && <p className="patients-page__msg"><b>{msg}</b></p>}
    </div>
  );
}
