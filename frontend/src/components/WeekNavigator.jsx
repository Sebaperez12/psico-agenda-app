import "./WeekNavigator.css";

export default function WeekNavigator({
  weekLabel,
  onPrevWeek,
  onNextWeek,
  onToday,
}) {
  return (
    <div className="week-navigator">
      <div className="week-navigator__controls">
        <button
          type="button"
          className="week-navigator__icon-button"
          onClick={onPrevWeek}
        >
          ←
        </button>

        <button
          type="button"
          className="week-navigator__today-button"
          onClick={onToday}
        >
          Hoy
        </button>

        <button
          type="button"
          className="week-navigator__icon-button"
          onClick={onNextWeek}
        >
          →
        </button>
      </div>

      <div className="week-navigator__label">{weekLabel}</div>
    </div>
  );
}
