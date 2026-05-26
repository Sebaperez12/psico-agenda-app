export default function PatientEditor({
  patient,
  profileForm,
  nextAppointmentForm,
  setProfileForm,
  setNextAppointmentForm,
  onSaveProfile,
  onSaveNextAppointment,
  onDeleteNextAppointment,
  profileStatus,
  isSavingProfile,
}) {
  return (
    <div className="patients-page__editor">
      <section className="patients-page__section patients-page__section--agenda">
        <div className="patients-page__section-head">
          <h2>Proxima hora</h2>
          <p>Lo que edites aca se guarda sobre el mismo turno de la agenda.</p>
        </div>

        <div className="patients-page__grid patients-page__grid--appointment">
          <input
            className="patients-page__input"
            type="date"
            value={nextAppointmentForm.date}
            onChange={(e) => setNextAppointmentForm((current) => ({ ...current, date: e.target.value }))}
          />
          <input
            className="patients-page__input"
            type="time"
            value={nextAppointmentForm.time}
            onChange={(e) => setNextAppointmentForm((current) => ({ ...current, time: e.target.value }))}
          />
          <input
            className="patients-page__input"
            type="number"
            min="10"
            step="5"
            value={nextAppointmentForm.duration}
            onChange={(e) => setNextAppointmentForm((current) => ({ ...current, duration: e.target.value }))}
            placeholder="Duracion en minutos"
          />
          <input
            className="patients-page__input"
            value={nextAppointmentForm.location}
            onChange={(e) => setNextAppointmentForm((current) => ({ ...current, location: e.target.value }))}
            placeholder="Lugar"
          />
          <textarea
            className="patients-page__input patients-page__textarea"
            value={nextAppointmentForm.notes}
            onChange={(e) => setNextAppointmentForm((current) => ({ ...current, notes: e.target.value }))}
            placeholder="Notas del turno"
          />
        </div>

        <div className="patients-page__section-actions">
          <button className="patients-page__btn patients-page__btn--primary" onClick={() => onSaveNextAppointment(patient.id)}>
            {patient.next_appointment ? "Actualizar proxima hora" : "Crear proxima hora"}
          </button>
          {patient.next_appointment && (
            <button className="patients-page__btn" onClick={() => onDeleteNextAppointment(patient)}>
              Eliminar de agenda
            </button>
          )}
        </div>
      </section>

      <section className="patients-page__section">
        <div className="patients-page__section-head">
          <h2>Perfil del paciente</h2>
          <p>Podes guardar datos clinicos y de contacto extra.</p>
        </div>

        <div className="patients-page__grid">
          <input
            className="patients-page__input"
            value={profileForm.full_name}
            onChange={(e) => setProfileForm((current) => ({ ...current, full_name: e.target.value }))}
            placeholder="Nombre completo"
          />
          <input
            className="patients-page__input"
            value={profileForm.phone}
            onChange={(e) => setProfileForm((current) => ({ ...current, phone: e.target.value }))}
            placeholder="Telefono"
          />
          <input
            className="patients-page__input"
            value={profileForm.email}
            onChange={(e) => setProfileForm((current) => ({ ...current, email: e.target.value }))}
            placeholder="Email"
          />
          <input
            className="patients-page__input"
            value={profileForm.dni}
            onChange={(e) => setProfileForm((current) => ({ ...current, dni: e.target.value }))}
            placeholder="DNI"
          />
          <input
            className="patients-page__input"
            type="date"
            value={profileForm.date_of_birth}
            onChange={(e) => setProfileForm((current) => ({ ...current, date_of_birth: e.target.value }))}
          />
          <input
            className="patients-page__input"
            value={profileForm.occupation}
            onChange={(e) => setProfileForm((current) => ({ ...current, occupation: e.target.value }))}
            placeholder="Ocupacion"
          />
          <input
            className="patients-page__input"
            value={profileForm.insurance}
            onChange={(e) => setProfileForm((current) => ({ ...current, insurance: e.target.value }))}
            placeholder="Obra social / cobertura"
          />
          <input
            className="patients-page__input"
            value={profileForm.address}
            onChange={(e) => setProfileForm((current) => ({ ...current, address: e.target.value }))}
            placeholder="Direccion"
          />
          <input
            className="patients-page__input"
            value={profileForm.emergency_contact_name}
            onChange={(e) => setProfileForm((current) => ({ ...current, emergency_contact_name: e.target.value }))}
            placeholder="Contacto de emergencia"
          />
          <input
            className="patients-page__input"
            value={profileForm.emergency_contact_phone}
            onChange={(e) => setProfileForm((current) => ({ ...current, emergency_contact_phone: e.target.value }))}
            placeholder="Telefono de emergencia"
          />
          <textarea
            className="patients-page__input patients-page__textarea"
            value={profileForm.notes}
            onChange={(e) => setProfileForm((current) => ({ ...current, notes: e.target.value }))}
            placeholder="Notas del paciente"
          />
        </div>

        <button
          className="patients-page__btn patients-page__btn--primary"
          onClick={() => onSaveProfile(patient.id)}
          disabled={isSavingProfile}
        >
          {isSavingProfile ? "Guardando..." : "Guardar perfil"}
        </button>
        {profileStatus && (
          <p className="patients-page__inline-msg">
            <b>{profileStatus}</b>
          </p>
        )}
      </section>
    </div>
  );
}
