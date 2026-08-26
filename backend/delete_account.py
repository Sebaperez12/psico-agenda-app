import sys

from app import app, db


def normalize_email(value):
    return (value or "").strip().lower()


def main():
    if len(sys.argv) != 3:
        print("Uso: python delete_account.py cuenta@email.com CONFIRMAR")
        return 1

    email = normalize_email(sys.argv[1])
    confirmation = sys.argv[2]
    if confirmation != "CONFIRMAR":
        print("Para borrar la cuenta, el segundo argumento debe ser CONFIRMAR")
        return 1

    with app.app_context():
        user_model = db.Model.registry._class_registry.get("User")
        admin_audit_log_model = db.Model.registry._class_registry.get("AdminAuditLog")
        password_reset_request_model = db.Model.registry._class_registry.get("PasswordResetRequest")
        recurring_exception_model = db.Model.registry._class_registry.get("RecurringAppointmentException")
        appointment_model = db.Model.registry._class_registry.get("Appointment")
        recurring_series_model = db.Model.registry._class_registry.get("RecurringAppointmentSeries")
        availability_rule_model = db.Model.registry._class_registry.get("AvailabilityRule")
        profile_model = db.Model.registry._class_registry.get("PsychologistProfile")
        patient_model = db.Model.registry._class_registry.get("Patient")

        user = user_model.query.filter_by(email=email).first()
        if not user:
            print("No existe un usuario con ese email")
            return 1

        user_id = user.id
        admin_audit_log_model.query.filter_by(target_user_id=user_id).update({"target_user_id": None})
        admin_audit_log_model.query.filter_by(admin_user_id=user_id).delete()
        password_reset_request_model.query.filter_by(user_id=user_id).delete()
        recurring_exception_model.query.filter_by(owner_user_id=user_id).delete()
        appointment_model.query.filter_by(owner_user_id=user_id).delete()
        recurring_series_model.query.filter_by(owner_user_id=user_id).delete()
        availability_rule_model.query.filter_by(owner_user_id=user_id).delete()
        profile_model.query.filter_by(owner_user_id=user_id).delete()
        patient_model.query.filter_by(owner_user_id=user_id).delete()
        db.session.delete(user)
        db.session.commit()

        print(f"Cuenta eliminada: {email}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
