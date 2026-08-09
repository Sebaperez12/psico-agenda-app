import PatientEditor from "./PatientEditor";
import mailIcon from "../assets/mail.png";
import { formatAppointmentSummary } from "../utils/appointmentFormatters";

function formatMoney(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PatientCard({
  patient,
  isExpanded,
  profileForm,
  nextAppointmentForm,
  setProfileForm,
  setNextAppointmentForm,
  onToggleEditor,
  onOpenHistory,
  onDeletePatient,
  onSaveProfile,
  onSaveNextAppointment,
  onDeleteNextAppointment,
  profileStatus,
  isSavingProfile,
}) {
  return (
    <li className="patients-page__card">
      <div className="patients-page__card-header">
        <div className="patients-page__upcoming">
          <span className="patients-page__upcoming-label">Proxima hora</span>
          <strong>{formatAppointmentSummary(patient.next_appointment)}</strong>
          {patient.next_appointment?.location && <span>{patient.next_appointment.location}</span>}
        </div>

        <div className="patients-page__item-info">
          <strong>{patient.full_name}</strong>
          <span>{patient.phone || "Sin telefono"}</span>
          <span className="patients-page__contact-line">
            <img src={mailIcon} alt="" aria-hidden="true" />
            {patient.email || "Sin email"}
          </span>
          <span className="patients-page__billing-line">
            Honorario: {patient.session_fee_amount ? formatMoney(patient.session_fee_amount) : "Sin definir"}
          </span>
          <span className={patient.billing_summary?.balance_due > 0 ? "patients-page__billing-line patients-page__billing-line--due" : "patients-page__billing-line"}>
            Saldo: {formatMoney(patient.billing_summary?.balance_due)}
          </span>
        </div>

        <div className="patients-page__card-actions">
          <button className="patients-page__btn" onClick={() => onOpenHistory(patient)}>
            Historial
          </button>
          <button className="patients-page__btn" onClick={() => onToggleEditor(patient)}>
            {isExpanded ? "Cerrar" : "Editar"}
          </button>
          <button className="patients-page__item-delete" onClick={() => onDeletePatient(patient.id)}>
            borrar
          </button>
        </div>
      </div>

      {(patient.insurance || patient.occupation || patient.dni) && (
        <div className="patients-page__meta">
          {patient.dni && <span>DNI: {patient.dni}</span>}
          {patient.insurance && <span>Obra social: {patient.insurance}</span>}
          {patient.occupation && <span>Ocupacion: {patient.occupation}</span>}
        </div>
      )}

      {isExpanded && (
        <PatientEditor
          patient={patient}
          profileForm={profileForm}
          nextAppointmentForm={nextAppointmentForm}
          setProfileForm={setProfileForm}
          setNextAppointmentForm={setNextAppointmentForm}
          onSaveProfile={onSaveProfile}
          onSaveNextAppointment={onSaveNextAppointment}
          onDeleteNextAppointment={onDeleteNextAppointment}
          profileStatus={profileStatus}
          isSavingProfile={isSavingProfile}
        />
      )}
    </li>
  );
}
