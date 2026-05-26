export default function PatientQuickCreate({
  fullName,
  phone,
  email,
  onFullNameChange,
  onPhoneChange,
  onEmailChange,
  onCreate,
  onRefresh,
}) {
  return (
    <div className="patients-page__form">
      <input
        className="patients-page__input"
        value={fullName}
        onChange={(e) => onFullNameChange(e.target.value)}
        placeholder="Nombre completo"
      />
      <input
        className="patients-page__input"
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        placeholder="Telefono (opcional)"
      />
      <input
        className="patients-page__input"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="Email"
      />
      <button className="patients-page__btn patients-page__btn--primary" onClick={onCreate}>
        Agregar
      </button>
      <button className="patients-page__btn" onClick={onRefresh}>
        Refrescar
      </button>
    </div>
  );
}
