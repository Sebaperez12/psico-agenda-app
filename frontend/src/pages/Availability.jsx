import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "./Availability.css";

const dayNames = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

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

  async function createRule() {
    setMsg("");
    try {
      await api.post("/availability/rules", {
        weekday: Number(weekday),
        start_time: startTime,
        end_time: endTime,
        active: true,
      });

      await loadRules();
      setMsg("Bloque creado");
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

  useEffect(() => {
    loadRules();
    loadProfileSettings();
  }, []);

  return (
    <div className="availability-page">
      <h1 className="availability-page__title">Disponibilidad</h1>
      <p className="availability-page__description">
        Configura el rango visible de la agenda y tus bloques de atencion semanal.
      </p>

      <section className="availability-page__card">
        <div>
          <h2 className="availability-page__section-title">Rango visible de agenda</h2>
          <p className="availability-page__section-help">
            El calendario de Turnos se mostrara desde esta hora hasta esta hora.
          </p>
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

      <h2 className="availability-page__section-title">Bloques de disponibilidad</h2>
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

        <button className="patients-page__btn patients-page__btn--primary" onClick={createRule}>Agregar</button>
        <button className="patients-page__btn" onClick={loadRules}>Refrescar</button>
      </div>

      {rules.length === 0 ? (
        <p className="patients-page__empty">No hay bloques todavia.</p>
      ) : (
        <ul className="patients-page__list">
          {rules.map((rule) => (
            <li className="patients-page__item" key={rule.id}>
              <div className="patients-page__item-info">
                <strong>{dayNames[rule.weekday]}</strong>
                <span>{rule.start_time} a {rule.end_time}</span>
              </div>
              <button
                className="patients-page__item-delete"
                onClick={() => deleteRule(rule.id)}
              >
                borrar
              </button>
            </li>
          ))}
        </ul>
      )}

      {msg && <p className="patients-page__msg"><b>{msg}</b></p>}
    </div>
  );
}
