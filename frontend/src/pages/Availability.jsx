import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "./Availability.css";

const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

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
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [msg, setMsg] = useState("");

  const timeOptions = useMemo(() => buildTimeOptions(10), []);

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
      setMsg("Bloque creado ✅");
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
      setMsg("Bloque eliminado ✅");
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    }
  }

  useEffect(() => {
    loadRules();
  }, []);

  return (
    <div className="availability-page">
      <h1 className="availability-page__title">Disponibilidad</h1>
      <p className="availability-page__description">
        Configura tus horarios de disponibilidad semanal. Define bloques de tiempo por día de la semana.
      </p>

      <div className="availability-page__form">
        <select className="availability-page__select" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
          {dayNames.map((day, index) => (
            <option key={index} value={index}>
              {day}
            </option>
          ))}
        </select>

        <select className="availability-page__select" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
          {timeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select className="availability-page__select" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
          {timeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <button className="patients-page__btn patients-page__btn--primary" onClick={createRule}>Agregar</button>
        <button className="patients-page__btn" onClick={loadRules}>Refrescar</button>
      </div>

      {rules.length === 0 ? (
        <p className="patients-page__empty">No hay bloques todavía.</p>
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