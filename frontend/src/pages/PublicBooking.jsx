import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import "./PublicBooking.css";

const dayFormatter = new Intl.DateTimeFormat("es-UY", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const monthTitleFormatter = new Intl.DateTimeFormat("es-UY", {
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("es-UY", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const calendarWeekdays = ["LU", "MA", "MI", "JU", "VI", "SA", "DO"];
const maxWeekOffset = 12;

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getCalendarStart(monthDate) {
  const firstDay = getMonthStart(monthDate);
  const weekday = (firstDay.getDay() + 6) % 7;
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(firstDay.getDate() - weekday);
  return calendarStart;
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

export default function PublicBooking() {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [availabilityDays, setAvailabilityDays] = useState({});
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(new Date()));
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", notes: "" });
  const [msg, setMsg] = useState("");
  const [submittedRequest, setSubmittedRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Object.entries(availabilityDays)
      .map(([date, slots]) => {
        const dateValue = new Date(`${date}T12:00:00`);
        return { date, dateValue, slots };
      })
      .filter((day) => day.dateValue >= today)
      .sort((a, b) => a.dateValue - b.dateValue);
  }, [availabilityDays]);

  const availabilityByDate = useMemo(() => {
    return days.reduce((acc, day) => {
      acc[day.date] = day;
      return acc;
    }, {});
  }, [days]);

  const calendarDays = useMemo(() => {
    const start = getCalendarStart(visibleMonth);
    const todayKey = getDateKey(new Date());

    return Array.from({ length: 42 }, (_, index) => {
      const dateValue = new Date(start);
      dateValue.setDate(start.getDate() + index);
      const date = getDateKey(dateValue);
      const availableDay = availabilityByDate[date];

      return {
        date,
        dateValue,
        dayNumber: dateValue.getDate(),
        isCurrentMonth: dateValue.getMonth() === visibleMonth.getMonth(),
        isPast: date < todayKey,
        slots: availableDay?.slots || [],
      };
    });
  }, [availabilityByDate, visibleMonth]);

  const monthLabel = useMemo(() => capitalize(monthTitleFormatter.format(visibleMonth)), [visibleMonth]);

  const visibleMonthDays = useMemo(() => {
    return days.filter((day) => (
      day.dateValue.getFullYear() === visibleMonth.getFullYear()
      && day.dateValue.getMonth() === visibleMonth.getMonth()
    ));
  }, [days, visibleMonth]);

  const selectedDay = useMemo(() => {
    return visibleMonthDays.find((day) => day.date === selectedDate)
      || visibleMonthDays.find((day) => day.slots.length > 0)
      || null;
  }, [selectedDate, visibleMonthDays]);

  const hasVisibleSlots = useMemo(() => visibleMonthDays.some((day) => day.slots.length > 0), [visibleMonthDays]);

  const minMonth = useMemo(() => getMonthStart(new Date()), []);

  const maxMonth = useMemo(() => {
    if (!days.length) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + maxWeekOffset * 7);
      return getMonthStart(fallback);
    }

    return getMonthStart(days[days.length - 1].dateValue);
  }, [days]);

  const canGoPreviousMonth = visibleMonth > minMonth;
  const canGoNextMonth = visibleMonth < maxMonth;

  async function loadAvailability() {
    setMsg("");
    setLoading(true);
    try {
      const responses = await Promise.all(
        Array.from({ length: maxWeekOffset + 1 }, (_, weekOffset) =>
          api.get(`/public/booking/${slug}?week_offset=${weekOffset}`)
        )
      );
      const mergedDays = responses.reduce((acc, data) => {
        Object.entries(data.availability?.days || {}).forEach(([date, slots]) => {
          acc[date] = slots;
        });
        return acc;
      }, {});

      setProfile(responses[0]?.profile || null);
      setAvailabilityDays(mergedDays);
      setSelectedSlot(null);
      setSelectedDate("");
      setVisibleMonth(getMonthStart(new Date()));
    } catch (e) {
      console.error(e);
      setMsg(e.message);
      setProfile(null);
      setAvailabilityDays({});
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
      const requestedSlot = selectedSlot;
      const patientName = form.full_name;
      const data = await api.post(`/public/booking/${slug}/appointments`, {
        ...form,
        start_at: requestedSlot.start_at,
      });
      setSubmittedRequest({
        patientName,
        startAt: requestedSlot.start_at,
        message: data.msg || "Solicitud enviada",
      });
      setSelectedSlot(null);
      setForm({ full_name: "", email: "", phone: "", notes: "" });
      await loadAvailability();
    } catch (e) {
      console.error(e);
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadAvailability();
  }, [slug]);

  useEffect(() => {
    if (!submittedRequest) return;
    window.setTimeout(() => {
      document.querySelector(".booking-page__success")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
  }, [submittedRequest]);

  useEffect(() => {
    if (!visibleMonthDays.length) {
      setSelectedDate("");
      return;
    }
    if (selectedDate && visibleMonthDays.some((day) => day.date === selectedDate)) return;
    const nextSelectedDay = visibleMonthDays.find((day) => day.slots.length > 0);
    setSelectedDate(nextSelectedDay?.date || "");
  }, [selectedDate, visibleMonthDays]);

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
              onClick={() => {
                setVisibleMonth((value) => getMonthStart(new Date(value.getFullYear(), value.getMonth() - 1, 1)));
                setSelectedSlot(null);
                setSelectedDate("");
              }}
              disabled={!canGoPreviousMonth || loading}
              aria-label="Mes anterior"
            >
              &lt;
            </button>
            <div className="booking-page__week">
              <span>Proximos horarios</span>
              <strong>{loading ? "Cargando..." : monthLabel}</strong>
            </div>
            <button
              type="button"
              onClick={() => {
                setVisibleMonth((value) => getMonthStart(new Date(value.getFullYear(), value.getMonth() + 1, 1)));
                setSelectedSlot(null);
                setSelectedDate("");
              }}
              disabled={!canGoNextMonth || loading}
              aria-label="Mes siguiente"
            >
              &gt;
            </button>
          </div>

          {loading ? (
            <p className="booking-page__empty">Cargando horarios...</p>
          ) : !hasVisibleSlots ? (
            <p className="booking-page__empty">No hay horarios disponibles este mes.</p>
          ) : (
            <>
              <div className="booking-page__picker">
                <div className="booking-page__month">
                  <div className="booking-page__weekday-row">
                    {calendarWeekdays.map((weekday) => (
                      <span key={weekday}>{weekday}</span>
                    ))}
                  </div>
                  <div className="booking-page__days">
                    {calendarDays.map((day) => {
                      const isSelectedDay = selectedDay?.date === day.date;
                      const hasSlots = day.slots.length > 0;
                      const isSelectable = day.isCurrentMonth && hasSlots && !day.isPast;
                      return (
                        <button
                          type="button"
                          className={[
                            "booking-page__day",
                            isSelectedDay ? "booking-page__day--selected" : "",
                            isSelectable ? "booking-page__day--available" : "booking-page__day--empty",
                            day.isCurrentMonth ? "" : "booking-page__day--outside",
                          ].filter(Boolean).join(" ")}
                          key={day.date}
                          onClick={() => {
                            setSelectedDate(day.date);
                            setSelectedSlot(null);
                          }}
                          disabled={!isSelectable}
                        >
                          <strong>{day.dayNumber}</strong>
                          {isSelectable && <span className="booking-page__day-dot" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="booking-page__time-panel">
                  <h3>{selectedDay ? dayFormatter.format(selectedDay.dateValue) : "Selecciona un dia"}</h3>
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

        {submittedRequest ? (
          <section className="booking-page__success" aria-live="polite">
            <div className="booking-page__success-mark" aria-hidden="true">
              <span />
            </div>
            <p className="booking-page__success-kicker">Solicitud enviada</p>
            <h2>Tu pedido de turno fue recibido</h2>
            <p className="booking-page__success-copy">
              El profesional va a revisar la solicitud y recibiras un email cuando confirme el turno.
            </p>
            <div className="booking-page__success-summary">
              <span>Fecha</span>
              <strong>{capitalize(dayFormatter.format(new Date(submittedRequest.startAt)))}</strong>
              <span>Hora</span>
              <strong>{timeFormatter.format(new Date(submittedRequest.startAt))}</strong>
              <span>Paciente</span>
              <strong>{submittedRequest.patientName}</strong>
            </div>
            <button
              type="button"
              className="booking-page__success-button"
              onClick={() => {
                setSubmittedRequest(null);
                setMsg("");
              }}
            >
              Solicitar otro turno
            </button>
          </section>
        ) : (
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
            <p className="booking-page__privacy">Tus datos estan protegidos y solo seran usados para esta reserva.</p>
            {msg && <p className="booking-page__msg">{msg}</p>}
          </form>
        )}
      </section>

      <section className="booking-page__notice-card">
        <span>i</span>
        <p>El turno queda pendiente hasta que el profesional lo confirme. Recibiras un email con la confirmacion.</p>
      </section>

      <p className="booking-page__brand-credit">
        Gestionado con <strong>Therapy<span>Desk</span></strong>
      </p>
    </main>
  );
}
