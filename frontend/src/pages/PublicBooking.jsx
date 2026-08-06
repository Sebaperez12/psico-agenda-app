import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import "./PublicBooking.css";

const dayFormatter = new Intl.DateTimeFormat("es-UY", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const weekdayFormatter = new Intl.DateTimeFormat("es-UY", {
  weekday: "short",
});

const dayNumberFormatter = new Intl.DateTimeFormat("es-UY", {
  day: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("es-UY", {
  month: "short",
});

const weekRangeFormatter = new Intl.DateTimeFormat("es-UY", {
  day: "numeric",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("es-UY", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default function PublicBooking() {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", notes: "" });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => {
    if (!availability?.days) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Object.entries(availability.days)
      .map(([date, slots]) => {
        const dateValue = new Date(`${date}T12:00:00`);
        return {
          date,
          dateValue,
          slots,
          weekday: weekdayFormatter.format(dateValue).replace(".", ""),
          dayNumber: dayNumberFormatter.format(dateValue),
          month: monthFormatter.format(dateValue).replace(".", ""),
        };
      })
      .filter((day) => weekOffset > 0 || day.dateValue >= today);
  }, [availability, weekOffset]);

  const weekLabel = useMemo(() => {
    if (!days.length) return "Horarios disponibles";
    const firstDay = days[0].dateValue;
    const lastDay = days[days.length - 1].dateValue;
    return `${weekRangeFormatter.format(firstDay)} - ${weekRangeFormatter.format(lastDay)}`;
  }, [days]);

  const selectedDay = useMemo(() => {
    return days.find((day) => day.date === selectedDate) || days.find((day) => day.slots.length > 0) || days[0] || null;
  }, [days, selectedDate]);

  const hasVisibleSlots = useMemo(() => days.some((day) => day.slots.length > 0), [days]);

  async function loadAvailability(nextWeekOffset = weekOffset) {
    setMsg("");
    setLoading(true);
    try {
      const data = await api.get(`/public/booking/${slug}?week_offset=${nextWeekOffset}`);
      setProfile(data.profile || null);
      setAvailability(data.availability || null);
      setSelectedSlot(null);
      setSelectedDate("");
    } catch (e) {
      console.error(e);
      setMsg(e.message);
      setProfile(null);
      setAvailability(null);
    } finally {
      setLoading(false);
    }
  }

  async function submitBooking(event) {
    event.preventDefault();
    if (!selectedSlot) {
      setMsg("Selecciona un horario disponible");
      return;
    }

    setMsg("");
    setSaving(true);
    try {
      const data = await api.post(`/public/booking/${slug}/appointments`, {
        ...form,
        start_at: selectedSlot.start_at,
      });
      setMsg(data.msg || "Solicitud enviada");
      setSelectedSlot(null);
      setForm({ full_name: "", email: "", phone: "", notes: "" });
      await loadAvailability(weekOffset);
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadAvailability(weekOffset);
  }, [slug, weekOffset]);

  useEffect(() => {
    if (!days.length) return;
    if (selectedDate && days.some((day) => day.date === selectedDate)) return;
    const nextSelectedDay = days.find((day) => day.slots.length > 0) || days[0];
    setSelectedDate(nextSelectedDay.date);
  }, [days, selectedDate]);

  return (
    <main className="booking-page">
      <section className="booking-page__profile">
        <div className="booking-page__avatar">
          {profile?.photo_data_url ? (
            <img src={profile.photo_data_url} alt={profile.full_name || "Profesional"} />
          ) : (
            <span>{profile?.full_name ? profile.full_name.slice(0, 1).toUpperCase() : "P"}</span>
          )}
        </div>
        <div>
          <p className="booking-page__eyebrow">Reserva de consulta</p>
          <h1>{profile?.full_name || "Agenda profesional"}</h1>
          {profile?.professional_title && <p className="booking-page__title">{profile.professional_title}</p>}
          {profile?.description && <p className="booking-page__description">{profile.description}</p>}
        </div>
      </section>

      <section className="booking-page__workspace">
        <div className="booking-page__calendar">
          <div className="booking-page__section-heading">
            <span className="booking-page__step">1</span>
            <div>
              <h2>Elige fecha y horario</h2>
              <p>Horario del consultorio</p>
            </div>
          </div>

          <div className="booking-page__toolbar">
            <button
              type="button"
              onClick={() => setWeekOffset((value) => Math.max(0, value - 1))}
              disabled={weekOffset === 0 || loading}
              aria-label="Semana anterior"
            >
              &lt;
            </button>
            <div className="booking-page__week">
              <span>Próximos horarios</span>
              <strong>{availability ? weekLabel : "Horarios disponibles"}</strong>
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset((value) => Math.min(12, value + 1))}
              disabled={weekOffset >= 12 || loading}
              aria-label="Semana siguiente"
            >
              &gt;
            </button>
          </div>

          {loading ? (
            <p className="booking-page__empty">Cargando horarios...</p>
          ) : !hasVisibleSlots ? (
            <p className="booking-page__empty">No hay horarios disponibles esta semana.</p>
          ) : (
            <>
              <div className="booking-page__picker">
                <div className="booking-page__days">
                  {days.map((day) => {
                    const isSelectedDay = selectedDay?.date === day.date;
                    const hasSlots = day.slots.length > 0;
                    return (
                      <button
                        type="button"
                        className={[
                          "booking-page__day",
                          isSelectedDay ? "booking-page__day--selected" : "",
                          hasSlots ? "booking-page__day--available" : "booking-page__day--empty",
                        ].filter(Boolean).join(" ")}
                        key={day.date}
                        onClick={() => {
                          setSelectedDate(day.date);
                          setSelectedSlot(null);
                        }}
                        disabled={!hasSlots}
                      >
                        <span>{day.weekday}</span>
                        <strong>{day.dayNumber}</strong>
                        <small>{day.month}</small>
                      </button>
                    );
                  })}
                </div>

                <div className="booking-page__time-panel">
                  <h3>{selectedDay ? dayFormatter.format(selectedDay.dateValue) : "Selecciona un día"}</h3>
                  <div className="booking-page__slots">
                    {selectedDay?.slots.length ? (
                      selectedDay.slots.map((slot) => {
                        const isSelected = selectedSlot?.start_at === slot.start_at;
                        return (
                          <button
                            type="button"
                            className={isSelected ? "booking-page__slot booking-page__slot--selected" : "booking-page__slot"}
                            key={slot.start_at}
                            onClick={() => setSelectedSlot(slot)}
                          >
                            {timeFormatter.format(new Date(slot.start_at))}
                          </button>
                        );
                      })
                    ) : (
                      <span className="booking-page__no-slots">Sin horarios</span>
                    )}
                  </div>
                </div>
              </div>

              <p className="booking-page__timezone">Horario mostrado en tu zona horaria</p>
            </>
          )}
        </div>

        <form className="booking-page__form" onSubmit={submitBooking}>
          <div className="booking-page__section-heading booking-page__section-heading--compact">
            <span className="booking-page__step">2</span>
            <div>
              <h2>Tus datos</h2>
            </div>
          </div>
          <p className="booking-page__selected">
            {selectedSlot
              ? `${dayFormatter.format(new Date(selectedSlot.start_at))} - ${timeFormatter.format(new Date(selectedSlot.start_at))}`
              : "Selecciona un horario"}
          </p>
          <input
            value={form.full_name}
            onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
            placeholder="Nombre y apellido"
            required
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Email"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Telefono"
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Motivo de consulta (opcional)"
            rows="4"
          />
          <button type="submit" disabled={saving || !selectedSlot}>
            {saving ? "Enviando..." : "Solicitar consulta"}
          </button>
          <p className="booking-page__privacy">Tus datos están protegidos y solo serán usados para esta reserva.</p>
          {msg && <p className="booking-page__msg">{msg}</p>}
        </form>
      </section>

      <section className="booking-page__notice-card">
        <span>i</span>
        <p>El turno queda pendiente hasta que el profesional lo confirme. Recibirás un email con la confirmación.</p>
      </section>
    </main>
  );
}
