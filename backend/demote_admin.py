import sys

from app import app, db


def normalize_email(value):
    return (value or "").strip().lower()


def main():
    if len(sys.argv) != 3:
        print("Uso: python demote_admin.py cuenta@email.com CONFIRMAR")
        return 1

    email = normalize_email(sys.argv[1])
    confirmation = sys.argv[2]
    if confirmation != "CONFIRMAR":
        print("Para quitar el rol admin, el segundo argumento debe ser CONFIRMAR")
        return 1

    with app.app_context():
        user_model = db.Model.registry._class_registry.get("User")
        if not user_model:
            print("No se pudo cargar el modelo User")
            return 1

        user = user_model.query.filter_by(email=email).first()
        if not user:
            print("No existe un usuario con ese email")
            return 1

        if user.role != "admin":
            print(f"Esa cuenta ya no es admin: {email}")
            return 0

        user.role = "psychologist"
        db.session.commit()
        print(f"Rol admin quitado: {email}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
