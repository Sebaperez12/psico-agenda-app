import sys

from werkzeug.security import generate_password_hash

from app import app, db


def normalize_email(value):
    return (value or "").strip().lower()


def validate_password_strength(password):
    if len(password) < 8:
        return "La contraseña debe tener al menos 8 caracteres"
    if not any(char.islower() for char in password):
        return "La contraseña debe incluir una minuscula"
    if not any(char.isupper() for char in password):
        return "La contraseña debe incluir una mayuscula"
    if not any(char.isdigit() for char in password):
        return "La contraseña debe incluir un numero"
    return None


def main():
    if len(sys.argv) != 3:
        print("Uso: python reset_admin_password.py admin@email.com NuevaClave123")
        return 1

    email = normalize_email(sys.argv[1])
    password = sys.argv[2]
    password_error = validate_password_strength(password)
    if password_error:
        print(password_error)
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
            print("Ese usuario no tiene rol admin")
            return 1

        user.password_hash = generate_password_hash(password)
        user.is_active = True
        db.session.commit()
        print(f"Password actualizado para admin {email}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
