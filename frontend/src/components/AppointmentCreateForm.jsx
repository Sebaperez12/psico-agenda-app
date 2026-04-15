import "./AppointmentCreateForm.css";

export default function AppointmentCreateForm({
  patients = [],
  createForm,
  setCreateForm,
  timeOptions = [],
  onCreateAppointment,
}) {
  return (
    <div className="appointment-create-form">
      <h3 className="appointment-create-form__title">Crear turno</h3>

      <div className="appointment-create-form__grid">
        <select
          className="appointment-create-form__field"
          value={createForm.patientId}
          onChange={(e) =>
            setCreateForm({ ...createForm, patientId: e.target.value })
          }
        >
          <option value="">Sin paciente</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>

        <input
          className="appointment-create-form__field"
          type="date"
          value={createForm.date}
          onChange={(e) =>
            setCreateForm({ ...createForm, date: e.target.value })
          }
        />

        <select
          className="appointment-create-form__field"
          value={createForm.time}
          onChange={(e) =>
            setCreateForm({ ...createForm, time: e.target.value })
          }
        >
          {timeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <input
          className="appointment-create-form__field"
          type="number"
          placeholder="Duración"
          value={createForm.duration}
          onChange={(e) =>
            setCreateForm({ ...createForm, duration: e.target.value })
          }
        />

        <button
          className="appointment-create-form__button"
          onClick={onCreateAppointment}
        >
          Crear
        </button>
      </div>
    </div>
  );
}