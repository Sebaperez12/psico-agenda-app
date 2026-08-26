import sys

from werkzeug.security import generate_password_hash

from app import app, db


def normalize_email(value):
    return (value or "").strip().lower()


def validate_password_strength(password):
    if not password:
        return None
    if len(password) < 8:
        return "La contrasena debe tener al menos 8 caracteres"
    if not any(char.islower() for char in password):
        return "La contrasena debe incluir una minuscula"
    if not any(char.isupper() for char in password):
        return "La contrasena debe incluir una mayuscula"
    if not any(char.isdigit() for char in password):
        return "La contrasena debe incluir un numero"
    return None


def main():
    if len(sys.argv) not in (2, 3):
        print("Uso: python promote_admin.py admin@email.com [NuevaClave123]")
        return 1

    email = normalize_email(sys.argv[1])
    password = sys.argv[2] if len(sys.argv) == 3 else ""
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
            if not password:
                print("No existe ese usuario. Pasa una contrasena para crearlo como admin.")
                return 1

            user = user_model(
                email=email,
                password_hash=generate_password_hash(password),
                role="admin",
                is_active=True,
            )
            db.session.add(user)
            action = "creado"
        else:
            user.role = "admin"
            user.is_active = True
            if password:
                user.password_hash = generate_password_hash(password)
            action = "actualizado"

        db.session.commit()
        print(f"Admin {action}: {email}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
