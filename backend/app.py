import os
import json
import re
import secrets
import threading
from datetime import timedelta, datetime
from pathlib import Path
from urllib.parse import quote, urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, request, send_from_directory, has_request_context
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)
from flask_mail import Mail, Message
from markupsafe import escape
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from sqlalchemy import inspect, text, or_, func

load_dotenv(override=True)

db = SQLAlchemy()
jwt = JWTManager()
mail = Mail()


def get_env(name, default=None):
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value


EMAIL_ASSET_FILENAMES = {
    "calendario.png",
    "hora.png",
    "usuario.png",
    "ubicacion.png",
    "mail.png",
    "ilustracion calendario.png",
    "logo 6 baja max.png",
    "logo 6 baja.png",
    "logo 6.png",
}


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def parse_cors_origins(value):
    origins = [origin.strip() for origin in (value or "").split(",") if origin.strip()]
    return origins or ["http://127.0.0.1:5173", "http://localhost:5173"]


def configure_security(app):
    app_env = get_env("APP_ENV", "development").lower()
    is_production = app_env == "production"
    database_url = get_env("DATABASE_URL", "sqlite:///dev.db")
    if database_url and database_url.startswith("postgres://"):
        database_url = "postgresql://" + database_url[len("postgres://"):]
    if database_url and database_url.startswith("postgresql://") and "sslmode=" not in database_url:
        database_url = f"{database_url}{'&' if '?' in database_url else '?'}sslmode=require"
    jwt_secret = get_env("JWT_SECRET_KEY")
    cors_origins = parse_cors_origins(get_env("CORS_ORIGINS"))

    if is_production:
        if not jwt_secret or jwt_secret in {"change-me", "your-secret-key-here"}:
            raise RuntimeError("JWT_SECRET_KEY is required and must be changed in production")
        if database_url.startswith("sqlite") and not env_bool("ALLOW_SQLITE_IN_PRODUCTION", False):
            raise RuntimeError("DATABASE_URL must point to a production database")
        if "*" in cors_origins:
            raise RuntimeError("CORS_ORIGINS cannot include * in production")

    app.config["APP_ENV"] = app_env
    app.config["IS_PRODUCTION"] = is_production
    app.config["CORS_ORIGINS"] = cors_origins
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_DATABASE_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}
    app.config["JWT_SECRET_KEY"] = jwt_secret or "dev-only-change-me"
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)


def create_app():
    app = Flask(__name__)

    configure_security(app)

    # Email configuration
    app.config["BREVO_API_KEY"] = get_env("BREVO_API_KEY", "")
    app.config["MAIL_SERVER"] = get_env("MAIL_SERVER", "smtp-relay.brevo.com")
    app.config["MAIL_PORT"] = int(get_env("MAIL_PORT", 587))
    app.config["MAIL_USE_TLS"] = env_bool("MAIL_USE_TLS", True)
    app.config["MAIL_TIMEOUT"] = int(get_env("MAIL_TIMEOUT", 10))
    app.config["MAIL_USERNAME"] = get_env("MAIL_USERNAME", "")
    app.config["MAIL_PASSWORD"] = get_env("MAIL_PASSWORD", "")
    app.config["MAIL_DEFAULT_SENDER"] = get_env("MAIL_DEFAULT_SENDER", "")

    CORS(
        app,
        resources={r"/*": {"origins": app.config["CORS_ORIGINS"]}},
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin in app.config["CORS_ORIGINS"]:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers.setdefault("Vary", "Origin")
        response.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        return response

    @app.get("/email-assets/<path:filename>")
    def get_email_asset(filename):
        if filename not in EMAIL_ASSET_FILENAMES:
            return jsonify({"msg": "Asset no encontrado"}), 404
        return send_from_directory(
            Path(__file__).resolve().parent.parent / "frontend" / "src" / "assets",
            filename,
            max_age=60 * 60 * 24 * 30,
        )

    # -------- HELPERS --------
    def send_email(
        recipient,
        subject,
        body,
        html_body=None,
        inline_attachments=None,
        sender_email=None,
        sender_name=None,
        reply_to=None,
    ):
        """Enviar email usando Brevo API HTTPS si está configurada, con fallback SMTP."""
        brevo_api_key = clean_text(app.config.get("BREVO_API_KEY"))
        mail_server = clean_text(app.config.get("MAIL_SERVER")).lower()
        username = clean_text(app.config.get("MAIL_USERNAME"))
        password = clean_text(app.config.get("MAIL_PASSWORD"))
        sender_default = clean_text(app.config.get("MAIL_DEFAULT_SENDER"))
        api_sender_email = sender_default or username or clean_text(sender_email)

        placeholder_values = {
            "",
            "noreply@psico-agenda.com",
            "your-email@gmail.com",
            "your-app-password",
            "tu-email@gmail.com",
            "xxxx-xxxx-xxxx-xxxx",
            "tu-clave-brevo-api",
            "your-brevo-api-key",
            "your-brevo-login",
            "your-brevo-smtp-key",
            "tu-login-brevo",
            "tu-clave-smtp-brevo",
        }

        def explain_brevo_error(raw_message):
            try:
                error_data = json.loads(raw_message)
            except (TypeError, ValueError):
                return raw_message

            message = clean_text(error_data.get("message")) if isinstance(error_data, dict) else ""
            code = clean_text(error_data.get("code")) if isinstance(error_data, dict) else ""
            if not message:
                return raw_message
            if code:
                return f"{message} ({code})"
            return message

        if brevo_api_key:
            if api_sender_email in placeholder_values:
                return False, (
                    "Configuración de email incompleta. Revisá MAIL_DEFAULT_SENDER en backend/.env"
                )

            payload = {
                "sender": {
                    "name": sender_name or "TherapyDesk",
                    "email": api_sender_email,
                },
                "to": [{"email": recipient}],
                "subject": subject,
                "textContent": body,
            }
            if html_body:
                payload["htmlContent"] = html_body

            reply_to_email = clean_text(reply_to) or clean_text(sender_email) or api_sender_email
            if reply_to_email:
                payload["replyTo"] = {
                    "email": reply_to_email,
                    "name": sender_name or "TherapyDesk",
                }

            try:
                request_data = json.dumps(payload).encode("utf-8")
                request = Request(
                    "https://api.brevo.com/v3/smtp/email",
                    data=request_data,
                    headers={
                        "accept": "application/json",
                        "content-type": "application/json",
                        "api-key": brevo_api_key,
                    },
                    method="POST",
                )
                with urlopen(request, timeout=int(app.config.get("MAIL_TIMEOUT", 10))) as response:
                    response_body = response.read().decode("utf-8", errors="ignore")
                print(f"[EMAIL SENT VIA BREVO API] to {recipient}: {subject} {response_body}")
                return True, None
            except HTTPError as e:
                error_body = ""
                try:
                    error_body = e.read().decode("utf-8", errors="ignore")
                except Exception:
                    error_body = ""
                error_message = explain_brevo_error(error_body) or e.reason or str(e)
                print(f"[EMAIL API ERROR] {e.code} {error_message}")
                return False, f"No se pudo enviar el email por API: {error_message}"
            except URLError as e:
                error_message = getattr(e, "reason", None) or str(e)
                print(f"[EMAIL API ERROR] {error_message}")
                return False, f"No se pudo conectar con el proveedor de email: {error_message}"

        if username in placeholder_values or password in placeholder_values:
            return False, (
                "Configuración de email incompleta. Revisá MAIL_USERNAME y MAIL_PASSWORD "
                "en backend/.env"
            )
        if username == "apikey" and "sendgrid" not in mail_server:
            return False, (
                "MAIL_USERNAME=apikey solo corresponde a SendGrid. Revisá MAIL_SERVER "
                "en backend/.env"
            )

        try:
            sender = None
            effective_sender = sender_default or username
            if effective_sender:
                sender = (sender_name or effective_sender, effective_sender)

            msg = Message(
                subject=subject,
                recipients=[recipient],
                body=body,
                sender=sender,
                reply_to=reply_to or sender_email or username or None,
            )
            if html_body:
                msg.html = html_body
            for attachment in inline_attachments or []:
                msg.attach(
                    filename=attachment["filename"],
                    content_type=attachment["content_type"],
                    data=attachment["data"],
                    disposition="inline",
                    headers=[["Content-ID", f"<{attachment['content_id']}>"]],
                )
            mail.send(msg)
            print(f"[EMAIL SENT] to {recipient}: {subject}")
            return True, None
        except Exception as e:
            error_message = str(e)
            print(f"[EMAIL ERROR] {error_message}")
            if "Username and Password not accepted" in error_message:
                return False, (
                    "El proveedor SMTP rechazó las credenciales. Revisá MAIL_SERVER, "
                    "MAIL_USERNAME y MAIL_PASSWORD en backend/.env"
                )
            if "Unauthorized" in error_message or "authentication" in error_message.lower():
                return False, (
                    "Brevo rechazó la autenticación SMTP. Revisá MAIL_USERNAME y MAIL_PASSWORD "
                    "en backend/.env"
                )
            return False, f"No se pudo enviar el email: {error_message}"

    def load_inline_image_bytes(image_path):
        try:
            with open(image_path, "rb") as image_file:
                return image_file.read()
        except OSError:
            return None

    def get_public_asset_path(filename):
        return Path(__file__).resolve().parent.parent / "frontend" / "public" / filename

    def get_frontend_asset_path(filename):
        return Path(__file__).resolve().parent.parent / "frontend" / "src" / "assets" / filename

    def get_backend_base_url():
        configured_url = clean_text(get_env("BACKEND_BASE_URL")).rstrip("/")
        if is_public_http_url(configured_url):
            return configured_url
        if not has_request_context():
            return ""

        forwarded_proto = clean_text(request.headers.get("X-Forwarded-Proto")).split(",")[0].strip()
        forwarded_host = clean_text(request.headers.get("X-Forwarded-Host")).split(",")[0].strip()
        scheme = forwarded_proto or request.scheme
        host = forwarded_host or request.host
        if not scheme or not host:
            return ""
        return f"{scheme}://{host}".rstrip("/")

    def is_public_http_url(value):
        parsed = urlparse(value or "")
        hostname = (parsed.hostname or "").lower()
        if parsed.scheme not in {"http", "https"} or not hostname:
            return False
        if hostname in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
            return False
        if hostname.startswith(("10.", "192.168.", "172.16.", "172.17.", "172.18.", "172.19.", "172.2", "172.30.", "172.31.")):
            return False
        return True

    def get_email_asset_url(filename):
        base_url = get_backend_base_url()
        if not is_public_http_url(base_url):
            return None
        return f"{base_url}/email-assets/{quote(filename)}"

    def normalize_email(value):
        return (value or "").strip().lower()

    def clean_text(value):
        return (value or "").strip()

    def parse_money_amount(value, default=None):
        if value in ("", None):
            return default
        try:
            amount = float(str(value).replace(",", "."))
        except (TypeError, ValueError):
            return default
        return round(max(amount, 0), 2)

    def slugify(value):
        normalized = clean_text(value).lower()
        normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
        normalized = re.sub(r"-+", "-", normalized).strip("-")
        return normalized or "profesional"

    def generate_unique_booking_slug(profile_name=None):
        base = slugify(profile_name)
        for index in range(20):
            suffix = secrets.token_urlsafe(4).lower().replace("_", "-")
            candidate = f"{base}-{suffix}" if index else f"{base}-{suffix}"
            exists = PsychologistProfile.query.filter_by(booking_slug=candidate).first()
            if not exists:
                return candidate
        return secrets.token_urlsafe(12).lower().replace("_", "-")

    def normalize_booking_slug(value):
        return slugify(value)[:80]

    def normalize_time_string(value, fallback):
        raw_value = clean_text(value) or fallback
        try:
            parsed = datetime.strptime(raw_value, "%H:%M")
            return parsed.strftime("%H:%M")
        except (TypeError, ValueError):
            return None

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

    def get_app_timezone():
        timezone_name = clean_text(os.getenv("APP_TIMEZONE")) or "America/Montevideo"
        try:
            return ZoneInfo(timezone_name)
        except Exception:
            return ZoneInfo("America/Montevideo")

    def get_local_now():
        return datetime.now(get_app_timezone()).replace(tzinfo=None)

    def validate_profile_payload(body, require_required_fields=False):
        office_addresses_raw = body.get("office_addresses")
        office_addresses = []
        if isinstance(office_addresses_raw, list):
            office_addresses = [clean_text(address) for address in office_addresses_raw[:5] if clean_text(address)]
        else:
            legacy_address = clean_text(body.get("office_address"))
            if legacy_address:
                office_addresses = [legacy_address]

        profile_data = {
            "full_name": clean_text(body.get("full_name")),
            "professional_title": clean_text(body.get("professional_title")),
            "description": clean_text(body.get("description")),
            "office_address": office_addresses[0] if office_addresses else "",
            "office_addresses": office_addresses,
            "photo_data_url": clean_text(body.get("photo_data_url")),
            "notification_email": normalize_email(body.get("notification_email")) or None,
            "visible_agenda_start_time": normalize_time_string(body.get("visible_agenda_start_time"), "06:00"),
            "visible_agenda_end_time": normalize_time_string(body.get("visible_agenda_end_time"), "22:00"),
        }

        if not profile_data["visible_agenda_start_time"] or not profile_data["visible_agenda_end_time"]:
            return None, "El rango visible de agenda debe usar formato HH:MM"

        if profile_data["visible_agenda_start_time"] >= profile_data["visible_agenda_end_time"]:
            return None, "La hora final de agenda debe ser posterior a la hora inicial"

        if require_required_fields:
            if not profile_data["full_name"]:
                return None, "El nombre completo es obligatorio"
            if not profile_data["professional_title"]:
                return None, "El título profesional es obligatorio"
            if not profile_data["office_address"]:
                return None, "La dirección del consultorio es obligatoria"

        if profile_data["photo_data_url"]:
            if not profile_data["photo_data_url"].startswith("data:image/"):
                return None, "La foto debe ser una imagen válida"
            if len(profile_data["photo_data_url"]) > 2_500_000:
                return None, "La foto es demasiado grande"
        else:
            profile_data["photo_data_url"] = None

        profile_data["description"] = profile_data["description"] or None
        return profile_data, None

    def production_column_sql(column_sql):
        if db.engine.dialect.name != "postgresql":
            return column_sql

        replacements = {
            "DATETIME": "TIMESTAMP",
            "BOOLEAN DEFAULT 0": "BOOLEAN DEFAULT FALSE",
            "BOOLEAN DEFAULT 1": "BOOLEAN DEFAULT TRUE",
        }
        for sqlite_sql, postgres_sql in replacements.items():
            column_sql = column_sql.replace(sqlite_sql, postgres_sql)
        return column_sql

    def ensure_column(table_name, column_name, column_sql):
        inspector = inspect(db.engine)
        columns = {column["name"] for column in inspector.get_columns(table_name)}
        if column_name not in columns:
            db.session.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {production_column_sql(column_sql)}"))
            db.session.commit()

    def get_default_appointment_location(user_id):
        profile = PsychologistProfile.query.filter_by(owner_user_id=user_id).first()
        if profile and profile.office_address:
            return clean_text(profile.office_address)
        return None

    def parse_iso_date(value, field_name):
        if value in (None, ""):
            return None, None
        try:
            return datetime.fromisoformat(value).date(), None
        except Exception:
            return None, f"{field_name} inválido. Usá formato YYYY-MM-DD"

    def build_occurrence_datetimes(series, occurrence_date):
        start_hour, start_minute = map(int, series.start_time.split(":"))
        start_at = datetime.combine(occurrence_date, datetime.min.time()).replace(
            hour=start_hour,
            minute=start_minute,
        )
        end_at = start_at + timedelta(minutes=series.duration_minutes)
        return start_at, end_at

    def serialize_public_profile(profile, user):
        office_addresses = []
        if profile.office_addresses_json:
            try:
                office_addresses = json.loads(profile.office_addresses_json)
            except (TypeError, json.JSONDecodeError):
                office_addresses = []
        if not office_addresses and profile.office_address:
            office_addresses = [profile.office_address]

        return {
            "slug": profile.booking_slug,
            "full_name": profile.full_name,
            "professional_title": profile.professional_title,
            "description": profile.description,
            "office_addresses": office_addresses[:5],
            "photo_data_url": profile.photo_data_url,
            "contact_email": profile.notification_email or (user.email if user else None),
            "session_minutes": user.default_session_minutes if user else 50,
            "min_notice_hours": (
                profile.public_booking_min_notice_hours
                if profile.public_booking_min_notice_hours is not None
                else 24
            ),
        }

    def get_public_booking_profile(slug):
        normalized_slug = normalize_booking_slug(slug)
        profile = PsychologistProfile.query.filter_by(booking_slug=normalized_slug).first()
        if not profile or not profile.public_booking_enabled:
            return None, None
        user = User.query.get(profile.owner_user_id)
        if not user or user.role != "psychologist" or not user.is_active:
            return None, None
        return profile, user

    def is_slot_inside_availability(owner_user_id, start_at, end_at):
        start_minutes = start_at.hour * 60 + start_at.minute
        end_minutes = end_at.hour * 60 + end_at.minute
        return db.session.query(
            AvailabilityRule.query.filter(
                AvailabilityRule.owner_user_id == owner_user_id,
                AvailabilityRule.weekday == start_at.weekday(),
                AvailabilityRule.active.is_(True),
                AvailabilityRule.start_time <= f"{start_minutes // 60:02d}:{start_minutes % 60:02d}",
                AvailabilityRule.end_time >= f"{end_minutes // 60:02d}:{end_minutes % 60:02d}",
            ).exists()
        ).scalar()

    def build_public_booking_slots(profile, user, week_offset=0):
        slot_minutes = user.default_session_minutes or 50
        gap_minutes = 10
        step_minutes = slot_minutes + gap_minutes
        week_start = get_week_start(get_local_now(), week_offset)
        week_end = week_start + timedelta(days=7)
        min_notice_hours = (
            profile.public_booking_min_notice_hours
            if profile.public_booking_min_notice_hours is not None
            else 24
        )
        min_start_at = get_local_now() + timedelta(hours=min_notice_hours)

        materialize_recurring_appointments(user.id, week_start, week_end)

        rules = (
            AvailabilityRule.query
            .filter_by(owner_user_id=user.id, active=True)
            .order_by(AvailabilityRule.weekday.asc(), AvailabilityRule.start_time.asc())
            .all()
        )
        appointments = (
            Appointment.query
            .filter(
                Appointment.owner_user_id == user.id,
                Appointment.start_at >= week_start,
                Appointment.start_at < week_end,
                Appointment.status != "cancelled",
            )
            .order_by(Appointment.start_at.asc())
            .all()
        )

        days = {}
        for i in range(7):
            day_date = week_start + timedelta(days=i)
            day_key = day_date.strftime("%Y-%m-%d")
            days[day_key] = []

            for rule in [r for r in rules if r.weekday == day_date.weekday()]:
                cursor = hhmm_to_minutes(rule.start_time)
                end_minutes = hhmm_to_minutes(rule.end_time)

                while cursor + slot_minutes <= end_minutes:
                    slot_start = day_date.replace(
                        hour=cursor // 60,
                        minute=cursor % 60,
                        second=0,
                        microsecond=0,
                    )
                    slot_end = slot_start + timedelta(minutes=slot_minutes)
                    blocked = any(a.start_at < slot_end and a.end_at > slot_start for a in appointments)

                    if slot_start >= min_start_at and not blocked:
                        days[day_key].append({
                            "start_at": slot_start.isoformat(),
                            "end_at": slot_end.isoformat(),
                        })

                    cursor += step_minutes

        return {
            "week_start": week_start.strftime("%Y-%m-%d"),
            "week_end": (week_end - timedelta(days=1)).strftime("%Y-%m-%d"),
            "slot_minutes": slot_minutes,
            "days": days,
        }

    def materialize_recurring_appointments(owner_user_id, range_start, range_end):
        if range_end <= range_start:
            return 0

        series_list = (
            RecurringAppointmentSeries.query
            .filter(
                RecurringAppointmentSeries.owner_user_id == owner_user_id,
                RecurringAppointmentSeries.active.is_(True),
                RecurringAppointmentSeries.start_date <= range_end.date(),
                or_(
                    RecurringAppointmentSeries.end_date.is_(None),
                    RecurringAppointmentSeries.end_date >= range_start.date(),
                ),
            )
            .all()
        )

        if not series_list:
            return 0

        existing_occurrences = {
            (row.recurring_series_id, row.recurrence_origin_date)
            for row in Appointment.query.filter(
                Appointment.owner_user_id == owner_user_id,
                Appointment.recurring_series_id.isnot(None),
                Appointment.recurrence_origin_date.isnot(None),
                Appointment.start_at >= range_start - timedelta(days=1),
                Appointment.start_at < range_end + timedelta(days=1),
            ).all()
        }

        skipped_occurrences = {
            (row.recurring_series_id, row.occurrence_date)
            for row in RecurringAppointmentException.query.filter(
                RecurringAppointmentException.owner_user_id == owner_user_id,
                RecurringAppointmentException.occurrence_date >= range_start.date(),
                RecurringAppointmentException.occurrence_date < range_end.date(),
            ).all()
        }

        created_count = 0

        for series in series_list:
            series_patient = Patient.query.filter_by(
                id=series.patient_id,
                owner_user_id=owner_user_id,
            ).first() if series.patient_id else None
            cursor_date = max(series.start_date, range_start.date())
            last_date = min(series.end_date, range_end.date() - timedelta(days=1)) if series.end_date else range_end.date() - timedelta(days=1)

            while cursor_date <= last_date:
                if cursor_date.weekday() != series.weekday:
                    cursor_date += timedelta(days=1)
                    continue

                occurrence_key = (series.id, cursor_date)
                if occurrence_key in existing_occurrences or occurrence_key in skipped_occurrences:
                    cursor_date += timedelta(days=7)
                    continue

                start_at, end_at = build_occurrence_datetimes(series, cursor_date)
                if range_start <= start_at < range_end and not overlaps_existing_appointment(owner_user_id, start_at, end_at):
                    db.session.add(Appointment(
                        owner_user_id=owner_user_id,
                        patient_id=series.patient_id,
                        recurring_series_id=series.id,
                        recurrence_origin_date=cursor_date,
                        start_at=start_at,
                        end_at=end_at,
                        status="scheduled" if series.patient_id else "free",
                        location=series.location,
                        notes=series.notes,
                        fee_amount=(series_patient.session_fee_amount or 0) if series_patient else 0,
                        payment_status="pending",
                    ))
                    existing_occurrences.add(occurrence_key)
                    created_count += 1

                cursor_date += timedelta(days=7)

        if created_count:
            db.session.commit()

        return created_count

    def normalize_whatsapp_phone(value):
        """Normalize common local formatting into Twilio's E.164-like format."""
        raw = clean_text(value)
        if not raw:
            return ""

        if raw.startswith("+"):
            normalized = "+" + "".join(ch for ch in raw[1:] if ch.isdigit())
        elif raw.startswith("00"):
            normalized = "+" + "".join(ch for ch in raw[2:] if ch.isdigit())
        else:
            digits = "".join(ch for ch in raw if ch.isdigit())
            normalized = f"+598{digits[1:]}" if digits.startswith("0") else digits

        if normalized.startswith("+5980"):
            normalized = "+598" + normalized[5:]

        return normalized

    def send_whatsapp(phone, message):
        """Enviar WhatsApp usando Twilio"""
        try:
            account_sid = os.getenv("TWILIO_ACCOUNT_SID")
            auth_token = os.getenv("TWILIO_AUTH_TOKEN")
            from_number = os.getenv("TWILIO_WHATSAPP_FROM")
            to_number = normalize_whatsapp_phone(phone)
            
            if not all([account_sid, auth_token, from_number]):
                print("[WHATSAPP SKIP] Credenciales de Twilio no configuradas")
                return False, "Credenciales de Twilio no configuradas"

            if not to_number.startswith("+"):
                return False, "El teléfono debe estar en formato internacional, por ejemplo +59895098123"
            
            client = Client(account_sid, auth_token)
            msg = client.messages.create(
                from_=f"whatsapp:{from_number}",
                body=message,
                to=f"whatsapp:{to_number}"
            )
            print(f"[WHATSAPP SENT] to {to_number}: {msg.sid}")
            return True, None
        except TwilioRestException as e:
            error_message = f"Twilio {e.code}: {e.msg}"
            print(f"[WHATSAPP ERROR] {error_message}")
            return False, error_message
        except Exception as e:
            error_message = str(e)
            print(f"[WHATSAPP ERROR] {error_message}")
            return False, error_message

    def is_hhmm(s: str) -> bool:
        if not isinstance(s, str) or len(s) != 5 or s[2] != ":":
            return False
        hh, mm = s.split(":")
        if not (hh.isdigit() and mm.isdigit()):
            return False
        h = int(hh)
        m = int(mm)
        return 0 <= h <= 23 and 0 <= m <= 59

    def hhmm_to_minutes(s: str) -> int:
        hh, mm = s.split(":")
        return int(hh) * 60 + int(mm)

    def format_date_in_spanish(dt, include_year=True):
        weekdays = [
            "lunes",
            "martes",
            "miércoles",
            "jueves",
            "viernes",
            "sábado",
            "domingo",
        ]
        months = [
            "enero",
            "febrero",
            "marzo",
            "abril",
            "mayo",
            "junio",
            "julio",
            "agosto",
            "septiembre",
            "octubre",
            "noviembre",
            "diciembre",
        ]
        date_text = f"{weekdays[dt.weekday()]} {dt.day} de {months[dt.month - 1]}"
        return f"{date_text} de {dt.year}" if include_year else date_text

    def format_time_12h(dt):
        hours24 = dt.hour
        minutes = dt.minute
        meridiem = "pm" if hours24 >= 12 else "am"
        hours12 = hours24 % 12 or 12
        return f"{hours12}:{minutes:02d} {meridiem}"

    def format_time_24h(dt):
        return f"{dt.hour:02d}:{dt.minute:02d} hs"

    def build_appointment_notification_payload(user, profile, patient, appointment, method_override=None, location_override=None):
        start_at = appointment.start_at
        date_str = format_date_in_spanish(start_at)
        date_short_str = format_date_in_spanish(start_at, include_year=False)
        time_str = format_time_12h(start_at)
        time_display_str = format_time_24h(start_at)
        subject_date_str = date_short_str[:1].upper() + date_short_str[1:]
        psychologist_name = (
            profile.full_name if profile and profile.full_name else user.email
        )
        email_subject = f"{subject_date_str} - {time_display_str} | {psychologist_name} | Confirmación de turno"
        psychologist_title = (
            f" ({profile.professional_title})"
            if profile and profile.professional_title
            else ""
        )
        profile_office_address = (
            clean_text(profile.office_address)
            if profile and profile.office_address
            else None
        )
        appointment_location = clean_text(appointment.location) or location_override or profile_office_address or "No informado"
        notification_email = (
            normalize_email(profile.notification_email)
            if profile and profile.notification_email
            else (normalize_email(user.email) if user and user.email else None)
        )
        patient_phone = clean_text(patient.phone) if patient and patient.phone else None

        message = (
            "Hola "
            f"{patient.full_name},\n\n"
            "Te recordamos tu próximo turno.\n\n"
            "Resumen del turno:\n"
            f"- Paciente: {patient.full_name}\n"
            f"- Profesional: {psychologist_name}{psychologist_title}\n"
            f"- Fecha: {date_str}\n"
            f"- Hora: {time_str}\n"
            f"- Lugar: {appointment_location}\n"
            f"- Contacto: {notification_email or 'No informado'}\n"
            "Si necesitas reprogramar o hacer una consulta, puedes responder este mensaje.\n\n"
            "Te esperamos."
        )

        return {
            "date_str": date_str,
            "date_short_str": date_short_str,
            "time_str": time_str,
            "time_display_str": time_display_str,
            "email_subject": email_subject,
            "psychologist_name": psychologist_name,
            "psychologist_title": psychologist_title,
            "patient_phone": patient_phone,
            "appointment_location": appointment_location,
            "notification_email": notification_email,
            "message": message,
            "method": (method_override or "email").lower(),
        }

    def overlaps_existing_rule(owner_user_id, weekday, start_time, end_time, exclude_id=None):
        query = AvailabilityRule.query.filter(
            AvailabilityRule.owner_user_id == owner_user_id,
            AvailabilityRule.weekday == weekday,
            AvailabilityRule.active.is_(True),
            AvailabilityRule.start_time < end_time,
            AvailabilityRule.end_time > start_time,
        )

        if exclude_id is not None:
            query = query.filter(AvailabilityRule.id != exclude_id)

        return db.session.query(query.exists()).scalar()

    def overlaps_existing_appointment(owner_user_id, start_at, end_at, exclude_id=None):
        query = Appointment.query.filter(
            Appointment.owner_user_id == owner_user_id,
            Appointment.status != "cancelled",
            Appointment.start_at < end_at,
            Appointment.end_at > start_at,
        )

        if exclude_id is not None:
            query = query.filter(Appointment.id != exclude_id)

        return db.session.query(query.exists()).scalar()

    def get_week_start(base_date=None, week_offset=0):
        base = base_date or get_local_now()
        monday = base - timedelta(days=base.weekday())  # lunes=0
        monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
        monday = monday + timedelta(days=week_offset * 7)
        return monday

    def get_day_start(dt):
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)

    def serialize_appointment_summary(appointment):
        if not appointment:
            return None
        return {
            "id": appointment.id,
            "patient_id": appointment.patient_id,
            "start_at": appointment.start_at.isoformat() if appointment.start_at else None,
            "end_at": appointment.end_at.isoformat() if appointment.end_at else None,
            "status": appointment.status,
            "location": appointment.location,
            "notes": appointment.notes,
            "fee_amount": appointment.fee_amount or 0,
            "payment_status": appointment.payment_status or "pending",
            "paid_at": appointment.paid_at.isoformat() if appointment.paid_at else None,
            "recurring_series_id": appointment.recurring_series_id,
        }

    def serialize_patient_with_next_appointment(patient, next_appointment=None):
        patient_data = patient.serialize()
        patient_data["next_appointment"] = serialize_appointment_summary(next_appointment)
        return patient_data

    def build_patient_billing_summary(patient_id, appointments=None):
        items = appointments or []
        due_items = [
            appointment for appointment in items
            if (
                appointment.patient_id == patient_id
                and appointment.status not in {"cancelled", "free"}
                and (appointment.payment_status or "pending") == "pending"
                and (appointment.fee_amount or 0) > 0
            )
        ]
        paid_items = [
            appointment for appointment in items
            if (
                appointment.patient_id == patient_id
                and appointment.status not in {"cancelled", "free"}
                and (appointment.payment_status or "pending") == "paid"
                and (appointment.fee_amount or 0) > 0
            )
        ]
        return {
            "balance_due": round(sum((item.fee_amount or 0) for item in due_items), 2),
            "pending_count": len(due_items),
            "paid_total": round(sum((item.fee_amount or 0) for item in paid_items), 2),
        }

    # -------- MODELOS --------
    class User(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        email = db.Column(db.String(120), unique=True, nullable=False)
        password_hash = db.Column(db.String(255), nullable=False)
        created_at = db.Column(db.DateTime, server_default=db.func.now())
        default_session_minutes = db.Column(db.Integer, nullable=False, default=50)
        role = db.Column(db.String(20), nullable=False, default="psychologist")
        is_active = db.Column(db.Boolean, nullable=False, default=True)

        def serialize(self):
            return {
                "id": self.id,
                "email": self.email,
                "default_session_minutes": self.default_session_minutes,
                "role": self.role or "psychologist",
                "is_active": bool(self.is_active),
            }

    class AdminAuditLog(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        admin_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
        target_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
        action = db.Column(db.String(80), nullable=False)
        detail = db.Column(db.Text, nullable=True)
        created_at = db.Column(db.DateTime, server_default=db.func.now())

        def serialize(self):
            return {
                "id": self.id,
                "admin_user_id": self.admin_user_id,
                "target_user_id": self.target_user_id,
                "action": self.action,
                "detail": self.detail,
                "created_at": self.created_at.isoformat() if self.created_at else None,
            }

    class PasswordResetRequest(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
        email = db.Column(db.String(120), nullable=False)
        status = db.Column(db.String(20), nullable=False, default="pending")
        mail_sent = db.Column(db.Boolean, nullable=False, default=False)
        mail_error = db.Column(db.Text, nullable=True)
        created_at = db.Column(db.DateTime, server_default=db.func.now())
        resolved_at = db.Column(db.DateTime, nullable=True)

        def serialize(self):
            return {
                "id": self.id,
                "user_id": self.user_id,
                "email": self.email,
                "status": self.status,
                "mail_sent": bool(self.mail_sent),
                "mail_error": self.mail_error,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            }

    class PageVisit(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        page = db.Column(db.String(80), nullable=False, default="home")
        visitor_key = db.Column(db.String(80), nullable=False)
        created_at = db.Column(db.DateTime, server_default=db.func.now())

    class Patient(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        owner_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

        full_name = db.Column(db.String(120), nullable=False)
        phone = db.Column(db.String(40), nullable=True)
        email = db.Column(db.String(120), nullable=True)
        dni = db.Column(db.String(40), nullable=True)
        date_of_birth = db.Column(db.Date, nullable=True)
        address = db.Column(db.Text, nullable=True)
        occupation = db.Column(db.String(120), nullable=True)
        insurance = db.Column(db.String(120), nullable=True)
        emergency_contact_name = db.Column(db.String(120), nullable=True)
        emergency_contact_phone = db.Column(db.String(40), nullable=True)
        notes = db.Column(db.Text, nullable=True)
        session_fee_amount = db.Column(db.Float, nullable=True)
        billing_notes = db.Column(db.Text, nullable=True)

        created_at = db.Column(db.DateTime, server_default=db.func.now())

        def serialize(self):
            return {
                "id": self.id,
                "owner_user_id": self.owner_user_id,
                "full_name": self.full_name,
                "phone": self.phone,
                "email": self.email,
                "dni": self.dni,
                "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
                "address": self.address,
                "occupation": self.occupation,
                "insurance": self.insurance,
                "emergency_contact_name": self.emergency_contact_name,
                "emergency_contact_phone": self.emergency_contact_phone,
                "notes": self.notes,
                "session_fee_amount": self.session_fee_amount or 0,
                "billing_notes": self.billing_notes,
                "created_at": self.created_at.isoformat() if self.created_at else None,
            }

    class AvailabilityRule(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        owner_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

        weekday = db.Column(db.Integer, nullable=False)  # 0=lunes ... 6=domingo
        start_time = db.Column(db.String(5), nullable=False)  # "HH:MM"
        end_time = db.Column(db.String(5), nullable=False)    # "HH:MM"

        active = db.Column(db.Boolean, default=True, nullable=False)
        created_at = db.Column(db.DateTime, server_default=db.func.now())

        def serialize(self):
            return {
                "id": self.id,
                "owner_user_id": self.owner_user_id,
                "weekday": self.weekday,
                "start_time": self.start_time,
                "end_time": self.end_time,
                "active": self.active,
            }

    class PsychologistProfile(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        owner_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, unique=True)
        full_name = db.Column(db.String(255), nullable=True)
        professional_title = db.Column(db.String(255), nullable=True)
        description = db.Column(db.Text, nullable=True)
        office_address = db.Column(db.Text, nullable=True)
        office_addresses_json = db.Column(db.Text, nullable=True)
        notification_email = db.Column(db.String(120), nullable=True)
        auto_reminders_enabled = db.Column(db.Boolean, nullable=False, default=False)
        auto_reminder_method = db.Column(db.String(20), nullable=True, default="email")
        auto_reminder_hours_before = db.Column(db.Integer, nullable=False, default=24)
        visible_agenda_start_time = db.Column(db.String(5), nullable=False, default="06:00")
        visible_agenda_end_time = db.Column(db.String(5), nullable=False, default="22:00")
        public_booking_enabled = db.Column(db.Boolean, nullable=False, default=False)
        public_booking_min_notice_hours = db.Column(db.Integer, nullable=False, default=24)
        booking_slug = db.Column(db.String(100), nullable=True, unique=True)
        photo_data_url = db.Column(db.Text, nullable=True)
        created_at = db.Column(db.DateTime, server_default=db.func.now())
        updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

        def serialize(self, user_email=None):
            office_addresses = []
            if self.office_addresses_json:
                try:
                    office_addresses = json.loads(self.office_addresses_json)
                except (TypeError, json.JSONDecodeError):
                    office_addresses = []
            if not office_addresses and self.office_address:
                office_addresses = [self.office_address]

            return {
                "id": self.id,
                "owner_user_id": self.owner_user_id,
                "email": user_email,
                "notification_email": self.notification_email,
                "auto_reminders_enabled": bool(self.auto_reminders_enabled),
                "auto_reminder_method": self.auto_reminder_method or "email",
                "auto_reminder_hours_before": self.auto_reminder_hours_before or 24,
                "visible_agenda_start_time": self.visible_agenda_start_time or "06:00",
                "visible_agenda_end_time": self.visible_agenda_end_time or "22:00",
                "public_booking_enabled": bool(self.public_booking_enabled),
                "public_booking_min_notice_hours": (
                    self.public_booking_min_notice_hours
                    if self.public_booking_min_notice_hours is not None
                    else 24
                ),
                "booking_slug": self.booking_slug,
                "full_name": self.full_name,
                "professional_title": self.professional_title,
                "description": self.description,
                "office_address": self.office_address,
                "office_addresses": office_addresses[:5],
                "photo_data_url": self.photo_data_url,
                "is_complete": bool(self.full_name and self.professional_title and self.office_address),
            }

    class Appointment(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        owner_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
        patient_id = db.Column(db.Integer, db.ForeignKey("patient.id"), nullable=True)
        recurring_series_id = db.Column(db.Integer, db.ForeignKey("recurring_appointment_series.id"), nullable=True)
        recurrence_origin_date = db.Column(db.Date, nullable=True)

        start_at = db.Column(db.DateTime, nullable=False)
        end_at = db.Column(db.DateTime, nullable=False)

        status = db.Column(db.String(20), nullable=False, default="scheduled")
        location = db.Column(db.Text, nullable=True)
        notes = db.Column(db.Text, nullable=True)
        fee_amount = db.Column(db.Float, nullable=True)
        payment_status = db.Column(db.String(20), nullable=False, default="pending")
        paid_at = db.Column(db.DateTime, nullable=True)
        booking_confirm_token = db.Column(db.String(120), nullable=True, unique=True)
        last_auto_reminder_sent_at = db.Column(db.DateTime, nullable=True)

        created_at = db.Column(db.DateTime, server_default=db.func.now())

        def serialize(self):
            return {
                "id": self.id,
                "owner_user_id": self.owner_user_id,
                "patient_id": self.patient_id,
                "recurring_series_id": self.recurring_series_id,
                "recurrence_origin_date": self.recurrence_origin_date.isoformat() if self.recurrence_origin_date else None,
                "start_at": self.start_at.isoformat() if self.start_at else None,
                "end_at": self.end_at.isoformat() if self.end_at else None,
                "status": self.status,
                "location": self.location,
                "notes": self.notes,
                "fee_amount": self.fee_amount or 0,
                "payment_status": self.payment_status or "pending",
                "paid_at": self.paid_at.isoformat() if self.paid_at else None,
                "last_auto_reminder_sent_at": self.last_auto_reminder_sent_at.isoformat() if self.last_auto_reminder_sent_at else None,
            }

    class RecurringAppointmentSeries(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        owner_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
        patient_id = db.Column(db.Integer, db.ForeignKey("patient.id"), nullable=True)
        weekday = db.Column(db.Integer, nullable=False)
        start_time = db.Column(db.String(5), nullable=False)
        duration_minutes = db.Column(db.Integer, nullable=False)
        start_date = db.Column(db.Date, nullable=False)
        end_date = db.Column(db.Date, nullable=True)
        location = db.Column(db.Text, nullable=True)
        notes = db.Column(db.Text, nullable=True)
        active = db.Column(db.Boolean, nullable=False, default=True)
        created_at = db.Column(db.DateTime, server_default=db.func.now())

        def serialize(self):
            return {
                "id": self.id,
                "owner_user_id": self.owner_user_id,
                "patient_id": self.patient_id,
                "weekday": self.weekday,
                "start_time": self.start_time,
                "duration_minutes": self.duration_minutes,
                "start_date": self.start_date.isoformat() if self.start_date else None,
                "end_date": self.end_date.isoformat() if self.end_date else None,
                "location": self.location,
                "notes": self.notes,
                "active": self.active,
            }

    class RecurringAppointmentException(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        owner_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
        recurring_series_id = db.Column(db.Integer, db.ForeignKey("recurring_appointment_series.id"), nullable=False)
        occurrence_date = db.Column(db.Date, nullable=False)
        created_at = db.Column(db.DateTime, server_default=db.func.now())

    with app.app_context():
        db.create_all()
        ensure_column("user", "default_session_minutes", "INTEGER DEFAULT 50")
        ensure_column("user", "role", "VARCHAR(20) DEFAULT 'psychologist'")
        ensure_column("user", "is_active", "BOOLEAN DEFAULT 1")
        ensure_column("admin_audit_log", "target_user_id", "INTEGER")
        ensure_column("password_reset_request", "mail_sent", "BOOLEAN DEFAULT 0")
        ensure_column("password_reset_request", "mail_error", "TEXT")
        ensure_column("password_reset_request", "resolved_at", "DATETIME")
        ensure_column("psychologist_profile", "full_name", "VARCHAR(255)")
        ensure_column("psychologist_profile", "professional_title", "VARCHAR(255)")
        ensure_column("psychologist_profile", "description", "TEXT")
        ensure_column("psychologist_profile", "office_address", "TEXT")
        ensure_column("psychologist_profile", "photo_data_url", "TEXT")
        ensure_column("psychologist_profile", "office_addresses_json", "TEXT")
        ensure_column("psychologist_profile", "notification_email", "VARCHAR(120)")
        ensure_column("psychologist_profile", "auto_reminders_enabled", "BOOLEAN DEFAULT 0")
        ensure_column("psychologist_profile", "auto_reminder_method", "VARCHAR(20) DEFAULT 'email'")
        ensure_column("psychologist_profile", "auto_reminder_hours_before", "INTEGER DEFAULT 24")
        ensure_column("psychologist_profile", "visible_agenda_start_time", "VARCHAR(5) DEFAULT '06:00'")
        ensure_column("psychologist_profile", "visible_agenda_end_time", "VARCHAR(5) DEFAULT '22:00'")
        ensure_column("psychologist_profile", "public_booking_enabled", "BOOLEAN DEFAULT 0")
        ensure_column("psychologist_profile", "public_booking_min_notice_hours", "INTEGER DEFAULT 24")
        ensure_column("psychologist_profile", "booking_slug", "VARCHAR(100)")
        ensure_column("psychologist_profile", "updated_at", "DATETIME")
        ensure_column("appointment", "location", "TEXT")
        ensure_column("appointment", "recurring_series_id", "INTEGER")
        ensure_column("appointment", "recurrence_origin_date", "DATE")
        ensure_column("appointment", "booking_confirm_token", "VARCHAR(120)")
        ensure_column("appointment", "last_auto_reminder_sent_at", "DATETIME")
        ensure_column("appointment", "created_at", "DATETIME")
        ensure_column("appointment", "fee_amount", "FLOAT")
        ensure_column("appointment", "payment_status", "VARCHAR(20) DEFAULT 'pending'")
        ensure_column("appointment", "paid_at", "DATETIME")
        ensure_column("patient", "dni", "VARCHAR(40)")
        ensure_column("patient", "date_of_birth", "DATE")
        ensure_column("patient", "address", "TEXT")
        ensure_column("patient", "occupation", "VARCHAR(120)")
        ensure_column("patient", "insurance", "VARCHAR(120)")
        ensure_column("patient", "emergency_contact_name", "VARCHAR(120)")
        ensure_column("patient", "emergency_contact_phone", "VARCHAR(40)")
        ensure_column("patient", "created_at", "DATETIME")
        ensure_column("patient", "session_fee_amount", "FLOAT")
        ensure_column("patient", "billing_notes", "TEXT")

    def configured_admin_emails():
        raw = get_env("ADMIN_EMAILS", "")
        admin_emails = {normalize_email(email) for email in raw.split(",") if normalize_email(email)}
        if admin_emails:
            return admin_emails

        fallback = normalize_email(app.config.get("MAIL_USERNAME"))
        if fallback and fallback != "apikey":
            print("[REGISTRATION EMAIL] ADMIN_EMAILS no configurado; usando MAIL_USERNAME para avisos admin")
            return {fallback}

        print("[REGISTRATION EMAIL] ADMIN_EMAILS no configurado; no se enviaran avisos admin")
        return set()

    def send_registration_welcome_email(user_email, full_name):
        subject = "Bienvenido/a a TherapyDesk"
        display_name = full_name or user_email
        login_url = get_env("FRONTEND_BASE_URL", "https://therapydesk.onrender.com")
        body = (
            f"Hola {display_name},\n\n"
            "Tu cuenta en TherapyDesk ya fue creada.\n"
            f"Podés ingresar desde: {login_url}\n\n"
            "Gracias por sumarte.\n"
            "TherapyDesk"
        )
        html_body = f"""
        <div style="font-family:Arial,sans-serif;color:#10204a;line-height:1.5">
          <h2 style="margin:0 0 12px">Bienvenido/a a TherapyDesk</h2>
          <p>Hola <strong>{escape(display_name)}</strong>,</p>
          <p>Tu cuenta ya fue creada y podés ingresar a tu agenda clínica.</p>
          <p>
            <a href="{escape(login_url)}" style="display:inline-block;background:#0f8f68;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">
              Ingresar a TherapyDesk
            </a>
          </p>
          <p style="color:#5f6f9f">Gracias por sumarte.</p>
        </div>
        """
        sent, error_message = send_email(user_email, subject, body, html_body=html_body, sender_name="TherapyDesk")
        if not sent:
            print(f"[REGISTRATION EMAIL ERROR] welcome to {user_email}: {error_message}")

    def notify_admins_about_registration(user_email, full_name, professional_title, office_address):
        admin_emails = configured_admin_emails()
        if not admin_emails:
            return

        subject = "Nuevo profesional registrado en TherapyDesk"
        body = (
            "Se registró un nuevo profesional.\n\n"
            f"Nombre: {full_name or '-'}\n"
            f"Email: {user_email}\n"
            f"Título: {professional_title or '-'}\n"
            f"Consultorio: {office_address or '-'}\n"
        )
        html_body = f"""
        <div style="font-family:Arial,sans-serif;color:#10204a;line-height:1.5">
          <h2 style="margin:0 0 12px">Nuevo profesional registrado</h2>
          <p><strong>Nombre:</strong> {escape(full_name or "-")}</p>
          <p><strong>Email:</strong> {escape(user_email)}</p>
          <p><strong>Título:</strong> {escape(professional_title or "-")}</p>
          <p><strong>Consultorio:</strong> {escape(office_address or "-")}</p>
        </div>
        """

        for admin_email in admin_emails:
            sent, error_message = send_email(
                admin_email,
                subject,
                body,
                html_body=html_body,
                sender_name="TherapyDesk",
            )
            if not sent:
                print(f"[REGISTRATION EMAIL ERROR] admin notice to {admin_email}: {error_message}")

    def send_registration_emails_async(user, profile):
        user_email = user.email
        full_name = profile.full_name
        professional_title = profile.professional_title
        office_address = profile.office_address

        def worker():
            with app.app_context():
                try:
                    send_registration_welcome_email(user_email, full_name)
                    notify_admins_about_registration(
                        user_email,
                        full_name,
                        professional_title,
                        office_address,
                    )
                    print(f"[REGISTRATION EMAIL] flujo completado para {user_email}")
                except Exception as exc:
                    print(f"[REGISTRATION EMAIL ERROR] flujo para {user_email}: {exc}")

        threading.Thread(target=worker, daemon=True).start()

    def sync_configured_admin(user):
        if user and user.email in configured_admin_emails() and user.role != "admin":
            user.role = "admin"
            db.session.commit()

    def get_current_user():
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if user:
            sync_configured_admin(user)
        return user

    def require_admin_user():
        user = get_current_user()
        if not user:
            return None, (jsonify({"msg": "Usuario no existe"}), 404)
        if not user.is_active:
            return None, (jsonify({"msg": "Usuario inactivo"}), 403)
        if user.role != "admin":
            return None, (jsonify({"msg": "No autorizado"}), 403)
        return user, None

    def serialize_admin_psychologist(user, profile=None, patient_count=None, appointment_count=None):
        profile = profile or PsychologistProfile.query.filter_by(owner_user_id=user.id).first()
        patient_count = patient_count if patient_count is not None else Patient.query.filter_by(owner_user_id=user.id).count()
        appointment_count = (
            appointment_count
            if appointment_count is not None
            else Appointment.query.filter_by(owner_user_id=user.id).count()
        )
        profile_data = profile.serialize(user.email) if profile else None
        return {
            **user.serialize(),
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "has_profile": bool(profile),
            "profile": profile_data,
            "patient_count": patient_count,
            "appointment_count": appointment_count,
        }

    def add_admin_audit_log(admin_user, target_user, action, detail=None):
        db.session.add(AdminAuditLog(
            admin_user_id=admin_user.id,
            target_user_id=target_user.id if target_user else None,
            action=action,
            detail=detail,
        ))

    def serialize_admin_audit_log(log):
        data = log.serialize()
        admin = User.query.get(log.admin_user_id)
        target = User.query.get(log.target_user_id) if log.target_user_id else None
        data["admin_email"] = admin.email if admin else None
        data["target_email"] = target.email if target else None
        return data

    def serialize_password_reset_request(reset_request):
        data = reset_request.serialize()
        user = User.query.get(reset_request.user_id)
        profile = PsychologistProfile.query.filter_by(owner_user_id=reset_request.user_id).first()
        data["user_email"] = user.email if user else reset_request.email
        data["user_name"] = profile.full_name if profile and profile.full_name else data["user_email"]
        return data

    def get_site_visit_stats():
        today_start = get_local_now().replace(hour=0, minute=0, second=0, microsecond=0)
        return {
            "total_visits": PageVisit.query.count(),
            "unique_visitors": db.session.query(func.count(func.distinct(PageVisit.visitor_key))).scalar() or 0,
            "today_visits": PageVisit.query.filter(PageVisit.created_at >= today_start).count(),
        }

    # -------- RUTAS --------
    @app.get("/")
    def health():
        return {"msg": "Backend OK"}

    @app.post("/site-visits")
    def record_site_visit():
        body = request.get_json(silent=True) or {}
        visitor_key = clean_text(body.get("visitor_key"))
        page = clean_text(body.get("page")) or "home"

        if not visitor_key or len(visitor_key) > 80:
            return jsonify({"msg": "visitor_key invalido"}), 400
        if not re.fullmatch(r"[A-Za-z0-9_-]{8,80}", visitor_key):
            return jsonify({"msg": "visitor_key invalido"}), 400
        if len(page) > 80:
            page = page[:80]

        db.session.add(PageVisit(page=page, visitor_key=visitor_key))
        db.session.commit()

        return jsonify({"visit_stats": get_site_visit_stats()}), 201

    @app.get("/debug/mail-config")
    def debug_mail_config():
        if get_env("APP_ENV", "development") == "production":
            return jsonify({"msg": "No disponible"}), 404

        brevo_api_key = clean_text(app.config.get("BREVO_API_KEY"))
        password = clean_text(app.config.get("MAIL_PASSWORD"))
        return jsonify({
            "email_mode": "brevo_api" if brevo_api_key else "smtp",
            "brevo_api_key_configured": bool(brevo_api_key),
            "mail_server": app.config.get("MAIL_SERVER"),
            "mail_username": app.config.get("MAIL_USERNAME"),
            "mail_password_length": len(password),
            "mail_password_starts_with_sg": password.startswith("SG."),
            "mail_default_sender": app.config.get("MAIL_DEFAULT_SENDER"),
            "admin_emails_count": len(configured_admin_emails()),
        }), 200

    @app.post("/debug/send-test-email")
    def debug_send_test_email():
        if get_env("APP_ENV", "development") == "production":
            return jsonify({"msg": "No disponible"}), 404

        body = request.get_json(silent=True) or {}
        recipient = normalize_email(body.get("recipient")) or normalize_email(app.config.get("MAIL_DEFAULT_SENDER"))
        if not recipient:
            return jsonify({"msg": "recipient es obligatorio"}), 400

        sent, error_message = send_email(
            recipient=recipient,
            subject="Prueba de email TherapyDesk",
            body="Si recibiste este email, la configuracion de envio esta funcionando.",
            html_body="<p>Si recibiste este email, la configuracion de envio esta funcionando.</p>",
            sender_name="TherapyDesk",
        )
        if not sent:
            return jsonify({"sent": False, "msg": error_message}), 502
        return jsonify({"sent": True, "msg": f"Email de prueba enviado a {recipient}"}), 200

    @app.get("/email/status")
    @jwt_required()
    def email_status():
        brevo_api_key = clean_text(app.config.get("BREVO_API_KEY"))
        username = clean_text(app.config.get("MAIL_USERNAME"))
        password = clean_text(app.config.get("MAIL_PASSWORD"))
        sender = clean_text(app.config.get("MAIL_DEFAULT_SENDER"))

        return jsonify({
            "email_mode": "brevo_api" if brevo_api_key else "smtp",
            "brevo_api_key_configured": bool(brevo_api_key),
            "mail_server": app.config.get("MAIL_SERVER"),
            "mail_username_configured": bool(username),
            "mail_password_configured": bool(password),
            "mail_default_sender": sender,
            "mail_default_sender_configured": bool(sender),
        }), 200

    @app.post("/email/test")
    @jwt_required()
    def send_authenticated_test_email():
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        body = request.get_json(silent=True) or {}
        recipient = normalize_email(body.get("recipient")) or normalize_email(user.email if user else "")

        if not recipient:
            return jsonify({"sent": False, "msg": "No hay email destinatario para la prueba"}), 400

        sent, error_message = send_email(
            recipient=recipient,
            subject="Prueba de email TherapyDesk",
            body="Si recibiste este email, la configuracion de envio esta funcionando.",
            html_body="<p>Si recibiste este email, la configuracion de envio esta funcionando.</p>",
            sender_name="TherapyDesk",
        )
        if not sent:
            return jsonify({"sent": False, "msg": error_message}), 502
        return jsonify({"sent": True, "msg": f"Email de prueba enviado a {recipient}"}), 200

    # --- PUBLIC BOOKING ---
    @app.get("/public/booking/<slug>")
    def public_booking_profile(slug):
        profile, user = get_public_booking_profile(slug)
        if not profile:
            return jsonify({"msg": "Agenda no disponible"}), 404

        week_offset = request.args.get("week_offset", default=0, type=int)
        if week_offset < 0 or week_offset > 12:
            return jsonify({"msg": "Solo se pueden consultar las proximas 12 semanas"}), 400

        return jsonify({
            "profile": serialize_public_profile(profile, user),
            "availability": build_public_booking_slots(profile, user, week_offset),
        }), 200

    @app.post("/public/booking/<slug>/appointments")
    def public_create_booking(slug):
        profile, user = get_public_booking_profile(slug)
        if not profile:
            return jsonify({"msg": "Agenda no disponible"}), 404

        body = request.get_json(silent=True) or {}
        full_name = clean_text(body.get("full_name"))
        email = normalize_email(body.get("email"))
        phone = clean_text(body.get("phone"))
        start_at_str = clean_text(body.get("start_at"))
        location = clean_text(body.get("location")) or get_default_appointment_location(user.id)
        notes = clean_text(body.get("notes")) or None

        if not full_name:
            return jsonify({"msg": "Ingresa tu nombre completo"}), 400
        if not email and not phone:
            return jsonify({"msg": "Ingresa email o telefono para confirmar el turno"}), 400
        if email and "@" not in email:
            return jsonify({"msg": "Email invalido"}), 400
        if not start_at_str:
            return jsonify({"msg": "Selecciona un horario"}), 400

        try:
            start_at = datetime.fromisoformat(start_at_str)
        except Exception:
            return jsonify({"msg": "Horario invalido"}), 400

        minutes = user.default_session_minutes or 50
        end_at = start_at + timedelta(minutes=minutes)
        min_notice_hours = (
            profile.public_booking_min_notice_hours
            if profile.public_booking_min_notice_hours is not None
            else 24
        )
        min_start_at = get_local_now() + timedelta(hours=min_notice_hours)
        if start_at < min_start_at:
            return jsonify({"msg": "Ese horario ya no esta disponible"}), 409
        if not is_slot_inside_availability(user.id, start_at, end_at):
            return jsonify({"msg": "Ese horario no esta dentro de la disponibilidad"}), 409

        existing_appointment = Appointment.query.filter(
            Appointment.owner_user_id == user.id,
            Appointment.start_at == start_at,
            Appointment.end_at == end_at,
            Appointment.status == "free",
            Appointment.patient_id.is_(None),
        ).first()

        has_conflict = overlaps_existing_appointment(
            user.id,
            start_at,
            end_at,
            exclude_id=existing_appointment.id if existing_appointment else None,
        )
        if has_conflict:
            return jsonify({"msg": "Ese horario acaba de ocuparse"}), 409

        patient_query = Patient.query.filter(Patient.owner_user_id == user.id)
        patient = None
        if email:
            patient = patient_query.filter(Patient.email == email).first()
        if not patient and phone:
            patient = Patient.query.filter_by(owner_user_id=user.id, phone=phone).first()

        if not patient:
            patient = Patient(
                owner_user_id=user.id,
                full_name=full_name,
                email=email or None,
                phone=phone or None,
            )
            db.session.add(patient)
            db.session.flush()
        else:
            patient.full_name = patient.full_name or full_name
            patient.email = patient.email or (email or None)
            patient.phone = patient.phone or (phone or None)

        if existing_appointment:
            appointment = existing_appointment
            appointment.patient_id = patient.id
            appointment.status = "pending"
            appointment.location = location
            appointment.notes = notes
            appointment.booking_confirm_token = secrets.token_urlsafe(32)
        else:
            appointment = Appointment(
                owner_user_id=user.id,
                patient_id=patient.id,
                start_at=start_at,
                end_at=end_at,
                status="pending",
                location=location,
                notes=notes,
                booking_confirm_token=secrets.token_urlsafe(32),
            )
            db.session.add(appointment)

        db.session.commit()

        date_str = format_date_in_spanish(appointment.start_at)
        date_short_str = format_date_in_spanish(appointment.start_at, include_year=False)
        subject_date_str = date_short_str[:1].upper() + date_short_str[1:]
        date_parts = date_short_str.split()
        appointment_weekday = date_parts[0].upper() if date_parts else ""
        appointment_day = str(appointment.start_at.day)
        appointment_month = date_parts[-1].upper() if date_parts else ""
        appointment_year = str(appointment.start_at.year)
        time_str = format_time_24h(appointment.start_at)
        time_compact_str = time_str.replace(" hs", "")
        psychologist_name = profile.full_name or "tu profesional"
        contact_email = profile.notification_email or user.email
        professional_email = normalize_email(contact_email)
        patient_contact = email or phone or "No informado"
        frontend_base_url = get_env("FRONTEND_BASE_URL", "https://therapydesk.onrender.com").rstrip("/")
        public_base_url = get_backend_base_url()
        appointments_url = f"{frontend_base_url}/appointments"
        confirm_url = (
            f"{public_base_url}/public/booking/confirm/{appointment.booking_confirm_token}"
            if public_base_url
            else appointments_url
        )

        if email:
            send_email(
                recipient=email,
                subject=f"{subject_date_str} - {time_str} | {psychologist_name} | Solicitud de turno recibida",
                body=(
                    f"Hola {full_name},\n\n"
                    "Recibimos una solicitud de turno con este email.\n\n"
                    f"Profesional: {psychologist_name}\n"
                    f"Fecha: {date_str}\n"
                    f"Hora: {time_str}\n"
                    f"Lugar: {appointment.location or 'A confirmar'}\n\n"
                    "El turno todavia no esta confirmado. El profesional revisara la solicitud y te contactara.\n\n"
                    "Si no solicitaste este turno, podes ignorar este mensaje o contactar al profesional."
                ),
                html_body=(
                    f"""
                    <div style="background:#f4f7fb;padding:28px 12px;font-family:Arial,sans-serif;color:#10183c;">
                      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #dfe6f2;box-shadow:0 12px 30px rgba(16,24,60,0.08);border-top:4px solid #d97706;">
                        <div style="padding:22px 28px 28px;">
                          <p style="margin:0 0 28px;font-size:13px;line-height:1;font-weight:700;color:#7a849f;">Therapy<span style="color:#12a77c;">Desk</span></p>
                          <p style="margin:0 0 12px;font-size:18px;line-height:1.4;">Hola <strong>{escape(full_name)}</strong>,</p>
                          <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#374267;">Recibimos tu solicitud de turno. El profesional la revisara y te avisaremos cuando quede confirmada.</p>
                          <div style="border:1px solid #dfe6f2;border-radius:8px;background:#fbfcff;padding:20px;margin-bottom:22px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                              <tr>
                                <td style="width:48%;text-align:center;padding:4px 18px 4px 4px;border-right:1px solid #dfe6f2;">
                                  <p style="margin:0 0 8px;font-size:12px;font-weight:900;color:#12a77c;text-transform:uppercase;">{escape(appointment_weekday)}</p>
                                  <p style="margin:0;font-size:54px;line-height:0.95;font-weight:900;color:#12a77c;">{escape(appointment_day)}</p>
                                  <p style="margin:8px 0 2px;font-size:12px;font-weight:900;color:#12a77c;text-transform:uppercase;">{escape(appointment_month)}</p>
                                  <p style="margin:0;font-size:14px;font-weight:700;color:#7a849f;">{escape(appointment_year)}</p>
                                </td>
                                <td style="width:52%;text-align:center;padding:4px 4px 4px 22px;">
                                  <p style="margin:0 0 8px;font-size:12px;font-weight:900;color:#12a77c;text-transform:uppercase;">Hora</p>
                                  <p style="margin:0;font-size:54px;line-height:1;font-weight:400;color:#1f2937;">{escape(time_compact_str)}<span style="font-size:18px;color:#374267;"> hs</span></p>
                                </td>
                              </tr>
                            </table>
                          </div>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:24px;">
                            <tr>
                              <td style="width:32%;padding:12px 12px 12px 0;border-bottom:1px solid #e7edf6;font-size:11px;font-weight:900;text-transform:uppercase;color:#7a849f;">Estado</td>
                              <td style="padding:12px 0;border-bottom:1px solid #e7edf6;font-size:15px;line-height:1.35;font-weight:900;color:#d97706;">Pendiente de confirmacion</td>
                            </tr>
                            <tr>
                              <td style="width:32%;padding:12px 12px 12px 0;border-bottom:1px solid #e7edf6;font-size:11px;font-weight:900;text-transform:uppercase;color:#7a849f;">Profesional</td>
                              <td style="padding:12px 0;border-bottom:1px solid #e7edf6;font-size:15px;line-height:1.35;font-weight:900;color:#10183c;">{escape(psychologist_name)}</td>
                            </tr>
                            <tr>
                              <td style="width:32%;padding:12px 12px 12px 0;border-bottom:1px solid #e7edf6;font-size:11px;font-weight:900;text-transform:uppercase;color:#7a849f;">Modalidad</td>
                              <td style="padding:12px 0;border-bottom:1px solid #e7edf6;font-size:15px;line-height:1.35;color:#10183c;">{escape(appointment.location or 'A confirmar')}</td>
                            </tr>
                            <tr>
                              <td style="width:32%;padding:12px 12px 12px 0;border-bottom:1px solid #e7edf6;font-size:11px;font-weight:900;text-transform:uppercase;color:#7a849f;">Contacto</td>
                              <td style="padding:12px 0;border-bottom:1px solid #e7edf6;font-size:15px;line-height:1.35;color:#10183c;">{escape(contact_email or 'No informado')}</td>
                            </tr>
                          </table>
                          <p style="margin:0;padding-top:18px;border-top:1px solid #e7edf6;text-align:center;font-size:12px;line-height:1.6;color:#7a849f;">Si no solicitaste este turno, podes ignorar este mensaje o contactar al profesional.</p>
                        </div>
                      </div>
                    </div>
                    """
                ),
                sender_name="TherapyDesk",
                reply_to=contact_email,
            )

        if professional_email:
            send_email(
                recipient=professional_email,
                subject=f"{subject_date_str} - {time_str} | Nueva solicitud de turno",
                body=(
                    f"Hola {psychologist_name},\n\n"
                    "Tenes una nueva solicitud de turno desde tu link de reservas.\n\n"
                    f"Paciente: {full_name}\n"
                    f"Contacto: {patient_contact}\n"
                    f"Fecha: {date_str}\n"
                    f"Hora: {time_str}\n"
                    f"Lugar: {appointment.location or 'A confirmar'}\n"
                    f"Notas: {notes or 'Sin notas'}\n\n"
                    f"Abrir agenda: {appointments_url}\n\n"
                    "El turno quedo pendiente. Revisalo y confirmalo desde tu agenda."
                ),
                html_body=f"""
                <div style="background:#f4f7fb;padding:28px 12px;font-family:Arial,sans-serif;color:#10183c;">
                  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #dfe6f2;box-shadow:0 12px 30px rgba(16,24,60,0.08);border-top:4px solid #12a77c;">
                    <div style="padding:22px 28px 12px;">
                      <p style="margin:0 0 28px;font-size:13px;line-height:1;font-weight:700;color:#7a849f;">Therapy<span style="color:#12a77c;">Desk</span></p>
                      <p style="margin:0 0 12px;font-size:18px;line-height:1.4;">Hola <strong>{escape(psychologist_name)}</strong>,</p>
                      <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#374267;">Tenes una nueva solicitud de turno desde tu link de reservas.</p>
                      <div style="border:1px solid #dfe6f2;border-radius:8px;background:#fbfcff;padding:20px;margin-bottom:22px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="width:48%;text-align:center;padding:4px 18px 4px 4px;border-right:1px solid #dfe6f2;">
                              <p style="margin:0 0 8px;font-size:12px;font-weight:900;color:#12a77c;text-transform:uppercase;">{escape(appointment_weekday)}</p>
                              <p style="margin:0;font-size:54px;line-height:0.95;font-weight:900;color:#12a77c;">{escape(appointment_day)}</p>
                              <p style="margin:8px 0 2px;font-size:12px;font-weight:900;color:#12a77c;text-transform:uppercase;">{escape(appointment_month)}</p>
                              <p style="margin:0;font-size:14px;font-weight:700;color:#7a849f;">{escape(appointment_year)}</p>
                            </td>
                            <td style="width:52%;text-align:center;padding:4px 4px 4px 22px;">
                              <p style="margin:0 0 8px;font-size:12px;font-weight:900;color:#12a77c;text-transform:uppercase;">Hora</p>
                              <p style="margin:0;font-size:54px;line-height:1;font-weight:400;color:#1f2937;">{escape(time_compact_str)}<span style="font-size:18px;color:#374267;"> hs</span></p>
                            </td>
                          </tr>
                        </table>
                      </div>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:24px;">
                        <tr>
                          <td style="width:32%;padding:12px 12px 12px 0;border-bottom:1px solid #e7edf6;font-size:11px;font-weight:900;text-transform:uppercase;color:#7a849f;">Paciente</td>
                          <td style="padding:12px 0;border-bottom:1px solid #e7edf6;font-size:15px;line-height:1.35;font-weight:900;color:#10183c;">{escape(full_name)}</td>
                        </tr>
                        <tr>
                          <td style="width:32%;padding:12px 12px 12px 0;border-bottom:1px solid #e7edf6;font-size:11px;font-weight:900;text-transform:uppercase;color:#7a849f;">Contacto</td>
                          <td style="padding:12px 0;border-bottom:1px solid #e7edf6;font-size:15px;line-height:1.35;color:#10183c;">{escape(patient_contact)}</td>
                        </tr>
                        <tr>
                          <td style="width:32%;padding:12px 12px 12px 0;border-bottom:1px solid #e7edf6;font-size:11px;font-weight:900;text-transform:uppercase;color:#7a849f;">Modalidad</td>
                          <td style="padding:12px 0;border-bottom:1px solid #e7edf6;font-size:15px;line-height:1.35;color:#10183c;">{escape(appointment.location or 'A confirmar')}</td>
                        </tr>
                        <tr>
                          <td style="width:32%;padding:12px 12px 12px 0;border-bottom:1px solid #e7edf6;font-size:11px;font-weight:900;text-transform:uppercase;color:#7a849f;">Notas</td>
                          <td style="padding:12px 0;border-bottom:1px solid #e7edf6;font-size:15px;line-height:1.35;color:#10183c;">{escape(notes or 'Sin notas')}</td>
                        </tr>
                      </table>
                      <p style="margin:0 0 14px;text-align:center;">
                        <a href="{escape(confirm_url)}" style="display:inline-block;background:#12a77c;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:8px;font-weight:900;">Confirmar turno&nbsp;&rarr;</a>
                      </p>
                      <p style="margin:0 0 28px;text-align:center;">
                        <a href="{escape(appointments_url)}" style="display:inline-block;color:#12a77c;text-decoration:none;font-size:13px;font-weight:900;">Abrir agenda</a>
                      </p>
                      <p style="margin:0;padding-top:18px;border-top:1px solid #e7edf6;text-align:center;font-size:12px;line-height:1.6;color:#7a849f;">El turno quedo pendiente. Revisalo y confirmalo desde tu agenda.</p>
                      <p style="margin:8px 0 0;text-align:center;font-size:12px;line-height:1.4;color:#7a849f;">Gestionado mediante <strong>Therapy<span style="color:#12a77c;">Desk</span></strong></p>
                    </div>
                  </div>
                </div>
                """,
                sender_name="TherapyDesk",
                reply_to=email or None,
            )

        return jsonify({
            "msg": "Solicitud enviada. El turno quedo pendiente de confirmacion.",
            "appointment": {
                "start_at": appointment.start_at.isoformat(),
                "end_at": appointment.end_at.isoformat(),
                "location": appointment.location,
                "status": appointment.status,
            },
            "profile": serialize_public_profile(profile, user),
        }), 201

    @app.get("/public/booking/confirm/<token>")
    def public_confirm_booking(token):
        clean_token = clean_text(token)
        appointment = Appointment.query.filter_by(booking_confirm_token=clean_token).first()

        def confirmation_page(title, message, accent="#12a77c"):
            return f"""
            <!doctype html>
            <html lang="es">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{escape(title)}</title>
              </head>
              <body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#10183c;">
                <main style="min-height:100vh;display:grid;place-items:center;padding:24px;">
                  <section style="max-width:520px;width:100%;background:#ffffff;border:1px solid #dfe6f2;border-top:4px solid {accent};border-radius:8px;padding:30px;box-shadow:0 12px 30px rgba(16,24,60,0.08);">
                    <p style="margin:0 0 18px;font-size:13px;font-weight:700;color:#7a849f;">Therapy<span style="color:#12a77c;">Desk</span></p>
                    <h1 style="margin:0 0 12px;font-size:26px;line-height:1.15;color:#10183c;">{escape(title)}</h1>
                    <p style="margin:0;font-size:16px;line-height:1.55;color:#374267;">{escape(message)}</p>
                  </section>
                </main>
              </body>
            </html>
            """, 200, {"Content-Type": "text/html; charset=utf-8"}

        if not appointment:
            return confirmation_page(
                "Link no disponible",
                "Esta solicitud ya fue procesada o el link no es valido.",
                "#d97706",
            )

        patient = Patient.query.filter_by(id=appointment.patient_id, owner_user_id=appointment.owner_user_id).first()
        user = User.query.get(appointment.owner_user_id)
        profile = PsychologistProfile.query.filter_by(owner_user_id=appointment.owner_user_id).first()

        if not patient or not user or not profile:
            return confirmation_page(
                "No se pudo confirmar",
                "No encontramos todos los datos del turno. Revisalo desde tu agenda.",
                "#d97706",
            )

        if appointment.status == "pending":
            appointment.status = "scheduled"
            appointment.booking_confirm_token = None
            db.session.commit()

            if patient.email:
                date_str = format_date_in_spanish(appointment.start_at)
                date_short_str = format_date_in_spanish(appointment.start_at, include_year=False)
                date_parts = date_short_str.split()
                appointment_weekday = date_parts[0].upper() if date_parts else ""
                appointment_day = str(appointment.start_at.day)
                appointment_month = date_parts[-1].upper() if date_parts else ""
                appointment_year = str(appointment.start_at.year)
                time_str = format_time_24h(appointment.start_at)
                time_compact_str = time_str.replace(" hs", "")
                psychologist_name = profile.full_name or user.email
                contact_email = profile.notification_email or user.email
                patient_subject_date = date_short_str[:1].upper() + date_short_str[1:]

                send_email(
                    recipient=patient.email,
                    subject=f"{patient_subject_date} - {time_str} | {psychologist_name} | Turno confirmado",
                    body=(
                        f"Hola {patient.full_name},\n\n"
                        "Tu turno fue confirmado.\n\n"
                        f"Profesional: {psychologist_name}\n"
                        f"Fecha: {date_str}\n"
                        f"Hora: {time_str}\n"
                        f"Lugar: {appointment.location or 'A confirmar'}\n"
                        f"Contacto: {contact_email or 'No informado'}\n\n"
                        "Si necesitas reprogramar o cancelar, contacta directamente con el profesional."
                    ),
                    html_body=f"""
                    <div style="background:#f4f7fb;padding:28px 12px;font-family:Arial,sans-serif;color:#10183c;">
                      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #dfe6f2;box-shadow:0 12px 30px rgba(16,24,60,0.08);border-top:4px solid #12a77c;">
                        <div style="padding:22px 28px 28px;">
                          <p style="margin:0 0 28px;font-size:13px;line-height:1;font-weight:700;color:#7a849f;">Therapy<span style="color:#12a77c;">Desk</span></p>
                          <p style="margin:0 0 12px;font-size:18px;line-height:1.4;">Hola <strong>{escape(patient.full_name)}</strong>,</p>
                          <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#374267;">Tu turno fue confirmado.</p>
                          <div style="border:1px solid #dfe6f2;border-radius:8px;background:#fbfcff;padding:20px;margin-bottom:22px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                              <tr>
                                <td style="width:48%;text-align:center;padding:4px 18px 4px 4px;border-right:1px solid #dfe6f2;">
                                  <p style="margin:0 0 8px;font-size:12px;font-weight:900;color:#12a77c;text-transform:uppercase;">{escape(appointment_weekday)}</p>
                                  <p style="margin:0;font-size:54px;line-height:0.95;font-weight:900;color:#12a77c;">{escape(appointment_day)}</p>
                                  <p style="margin:8px 0 2px;font-size:12px;font-weight:900;color:#12a77c;text-transform:uppercase;">{escape(appointment_month)}</p>
                                  <p style="margin:0;font-size:14px;font-weight:700;color:#7a849f;">{escape(appointment_year)}</p>
                                </td>
                                <td style="width:52%;text-align:center;padding:4px 4px 4px 22px;">
                                  <p style="margin:0 0 8px;font-size:12px;font-weight:900;color:#12a77c;text-transform:uppercase;">Hora</p>
                                  <p style="margin:0;font-size:54px;line-height:1;font-weight:400;color:#1f2937;">{escape(time_compact_str)}<span style="font-size:18px;color:#374267;"> hs</span></p>
                                </td>
                              </tr>
                            </table>
                          </div>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:24px;">
                            <tr>
                              <td style="width:32%;padding:12px 12px 12px 0;border-bottom:1px solid #e7edf6;font-size:11px;font-weight:900;text-transform:uppercase;color:#7a849f;">Profesional</td>
                              <td style="padding:12px 0;border-bottom:1px solid #e7edf6;font-size:15px;line-height:1.35;font-weight:900;color:#10183c;">{escape(psychologist_name)}</td>
                            </tr>
                            <tr>
                              <td style="width:32%;padding:12px 12px 12px 0;border-bottom:1px solid #e7edf6;font-size:11px;font-weight:900;text-transform:uppercase;color:#7a849f;">Modalidad</td>
                              <td style="padding:12px 0;border-bottom:1px solid #e7edf6;font-size:15px;line-height:1.35;color:#10183c;">{escape(appointment.location or 'A confirmar')}</td>
                            </tr>
                            <tr>
                              <td style="width:32%;padding:12px 12px 12px 0;border-bottom:1px solid #e7edf6;font-size:11px;font-weight:900;text-transform:uppercase;color:#7a849f;">Contacto</td>
                              <td style="padding:12px 0;border-bottom:1px solid #e7edf6;font-size:15px;line-height:1.35;color:#10183c;">{escape(contact_email or 'No informado')}</td>
                            </tr>
                          </table>
                          <p style="margin:0;padding-top:18px;border-top:1px solid #e7edf6;text-align:center;font-size:12px;line-height:1.6;color:#7a849f;">Si necesitas reprogramar o cancelar, contacta directamente con el profesional.</p>
                        </div>
                      </div>
                    </div>
                    """,
                    sender_name="TherapyDesk",
                    sender_email=contact_email,
                    reply_to=contact_email,
                )

            return confirmation_page(
                "Turno confirmado",
                f"El turno de {patient.full_name} quedo confirmado. Tambien se envio la confirmacion al paciente si tenia email registrado.",
            )

        if appointment.status == "scheduled":
            return confirmation_page(
                "Turno ya confirmado",
                f"El turno de {patient.full_name} ya estaba confirmado.",
            )

        return confirmation_page(
            "No se puede confirmar",
            f"Este turno esta en estado {appointment.status}. Revisalo desde tu agenda.",
            "#d97706",
        )

    # --- AUTH ---
    @app.post("/auth/register")
    def register():
        body = request.get_json(silent=True) or {}
        email = normalize_email(body.get("email"))
        password = body.get("password") or ""
        profile_data, profile_error = validate_profile_payload(body, require_required_fields=True)

        if not email or not password:
            return jsonify({"msg": "email y password son obligatorios"}), 400
        password_error = validate_password_strength(password)
        if password_error:
            return jsonify({"msg": password_error}), 400
        if profile_error:
            return jsonify({"msg": profile_error}), 400

        exists = User.query.filter_by(email=email).first()
        if exists:
            return jsonify({"msg": "Ese email ya está registrado"}), 409

        user = User(
            email=email,
            password_hash=generate_password_hash(password),
            role="admin" if email in configured_admin_emails() else "psychologist",
        )
        db.session.add(user)
        db.session.flush()

        profile = PsychologistProfile(
            owner_user_id=user.id,
            full_name=profile_data["full_name"],
            professional_title=profile_data["professional_title"],
            description=profile_data["description"],
            office_address=profile_data["office_address"],
            office_addresses_json=json.dumps(profile_data["office_addresses"]),
            visible_agenda_start_time=profile_data["visible_agenda_start_time"],
            visible_agenda_end_time=profile_data["visible_agenda_end_time"],
            booking_slug=generate_unique_booking_slug(profile_data["full_name"]),
            photo_data_url=profile_data["photo_data_url"],
        )
        db.session.add(profile)
        db.session.commit()

        send_registration_emails_async(user, profile)

        token = create_access_token(identity=str(user.id))
        return jsonify({
            "access_token": token,
            "user": {
                **user.serialize(),
                "has_profile": True,
            },
            "profile": profile.serialize(user.email),
        }), 201

    @app.post("/auth/login")
    def login():
        body = request.get_json(silent=True) or {}
        email = normalize_email(body.get("email"))
        password = body.get("password") or ""

        if not email or not password:
            return jsonify({"msg": "email y password son obligatorios"}), 400

        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"msg": "Credenciales inválidas"}), 401

        sync_configured_admin(user)
        if not user.is_active:
            return jsonify({"msg": "Usuario inactivo"}), 403

        profile = PsychologistProfile.query.filter_by(owner_user_id=user.id).first()
        token = create_access_token(identity=str(user.id))
        return jsonify({
            "access_token": token,
            "user": {
                **user.serialize(),
                "has_profile": bool(profile),
            },
            "profile": profile.serialize(user.email) if profile else None,
        }), 200

    @app.post("/auth/forgot-password")
    def forgot_password():
        body = request.get_json(silent=True) or {}
        email = normalize_email(body.get("email"))
        generic_msg = "Si el email esta registrado, el administrador vera una solicitud de recuperacion."

        if not email:
            return jsonify({"msg": "Ingresa tu email para solicitar recuperacion"}), 400

        user = User.query.filter_by(email=email).first()

        if user:
            reset_request = PasswordResetRequest.query.filter_by(
                user_id=user.id,
                status="pending",
            ).first()
            if not reset_request:
                reset_request = PasswordResetRequest(user_id=user.id, email=user.email)
                db.session.add(reset_request)
            reset_request.mail_sent = False
            reset_request.mail_error = None

            add_admin_audit_log(
                user,
                user,
                "password_reset_requested",
                "El usuario solicito recuperar su password",
            )
            db.session.commit()

        return jsonify({"msg": generic_msg}), 200

    @app.get("/me")
    @jwt_required()
    def me():
        user = get_current_user()
        if not user:
            return jsonify({"msg": "Usuario no existe"}), 404
        if not user.is_active:
            return jsonify({"msg": "Usuario inactivo"}), 403
        user_id = user.id
        profile = PsychologistProfile.query.filter_by(owner_user_id=user_id).first()
        return jsonify({
            "user": {
                **user.serialize(),
                "has_profile": bool(profile),
            },
            "profile": profile.serialize(user.email) if profile else None,
        }), 200

    @app.delete("/account")
    @jwt_required()
    def delete_own_account():
        user = get_current_user()
        if not user:
            return jsonify({"msg": "Usuario no existe"}), 404
        if user.role == "admin":
            return jsonify({"msg": "Las cuentas administradoras no se eliminan desde la app"}), 403

        body = request.get_json(silent=True) or {}
        confirm_email = normalize_email(body.get("confirm_email"))
        if confirm_email != user.email:
            return jsonify({"msg": "Para eliminar la cuenta, confirma tu email"}), 400

        user_id = user.id
        AdminAuditLog.query.filter_by(target_user_id=user_id).update({"target_user_id": None})
        AdminAuditLog.query.filter_by(admin_user_id=user_id).delete()
        PasswordResetRequest.query.filter_by(user_id=user_id).delete()
        RecurringAppointmentException.query.filter_by(owner_user_id=user_id).delete()
        Appointment.query.filter_by(owner_user_id=user_id).delete()
        RecurringAppointmentSeries.query.filter_by(owner_user_id=user_id).delete()
        AvailabilityRule.query.filter_by(owner_user_id=user_id).delete()
        PsychologistProfile.query.filter_by(owner_user_id=user_id).delete()
        Patient.query.filter_by(owner_user_id=user_id).delete()
        db.session.delete(user)
        db.session.commit()

        return jsonify({"msg": "Cuenta eliminada"}), 200

    # --- ADMIN ---
    @app.get("/admin/psychologists")
    @jwt_required()
    def admin_list_psychologists():
        _, error = require_admin_user()
        if error:
            return error

        patient_counts = dict(
            db.session.query(Patient.owner_user_id, func.count(Patient.id))
            .group_by(Patient.owner_user_id)
            .all()
        )
        appointment_counts = dict(
            db.session.query(Appointment.owner_user_id, func.count(Appointment.id))
            .group_by(Appointment.owner_user_id)
            .all()
        )
        profiles = {
            profile.owner_user_id: profile
            for profile in PsychologistProfile.query.all()
        }
        users = (
            User.query
            .filter(User.role == "psychologist")
            .order_by(User.created_at.desc(), User.id.desc())
            .all()
        )
        reset_requests = (
            PasswordResetRequest.query
            .filter_by(status="pending")
            .order_by(PasswordResetRequest.created_at.desc(), PasswordResetRequest.id.desc())
            .limit(10)
            .all()
        )

        return jsonify({
            "psychologists": [
                serialize_admin_psychologist(
                    user,
                    profiles.get(user.id),
                    patient_counts.get(user.id, 0),
                    appointment_counts.get(user.id, 0),
                )
                for user in users
            ],
            "password_reset_requests": [
                serialize_password_reset_request(reset_request)
                for reset_request in reset_requests
            ],
            "site_visit_stats": get_site_visit_stats(),
        }), 200

    @app.post("/admin/psychologists")
    @jwt_required()
    def admin_create_psychologist():
        admin_user, error = require_admin_user()
        if error:
            return error

        body = request.get_json(silent=True) or {}
        email = normalize_email(body.get("email"))
        password = body.get("password") or ""
        profile_data, profile_error = validate_profile_payload(body, require_required_fields=True)

        if not email or not password:
            return jsonify({"msg": "email y password son obligatorios"}), 400
        password_error = validate_password_strength(password)
        if password_error:
            return jsonify({"msg": password_error}), 400
        if profile_error:
            return jsonify({"msg": profile_error}), 400

        exists = User.query.filter_by(email=email).first()
        if exists:
            return jsonify({"msg": "Ese email ya esta registrado"}), 409

        user = User(
            email=email,
            password_hash=generate_password_hash(password),
            role="psychologist",
            is_active=bool(body.get("is_active", True)),
        )
        db.session.add(user)
        db.session.flush()

        profile = PsychologistProfile(
            owner_user_id=user.id,
            full_name=profile_data["full_name"],
            professional_title=profile_data["professional_title"],
            description=profile_data["description"],
            office_address=profile_data["office_address"],
            office_addresses_json=json.dumps(profile_data["office_addresses"]),
            notification_email=profile_data["notification_email"],
            visible_agenda_start_time=profile_data["visible_agenda_start_time"],
            visible_agenda_end_time=profile_data["visible_agenda_end_time"],
            booking_slug=generate_unique_booking_slug(profile_data["full_name"]),
            photo_data_url=profile_data["photo_data_url"],
        )
        db.session.add(profile)
        add_admin_audit_log(
            admin_user,
            user,
            "psychologist_created",
            "Cuenta de psicologo creada desde administracion",
        )
        db.session.commit()

        return jsonify({
            "msg": "Psicologo creado",
            "psychologist": serialize_admin_psychologist(user, profile),
        }), 201

    @app.get("/admin/psychologists/<int:psychologist_id>")
    @jwt_required()
    def admin_get_psychologist(psychologist_id):
        _, error = require_admin_user()
        if error:
            return error

        user = User.query.get(psychologist_id)
        if not user or user.role != "psychologist":
            return jsonify({"msg": "Psicologo no encontrado"}), 404

        audit_logs = (
            AdminAuditLog.query
            .filter_by(target_user_id=user.id)
            .order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
            .limit(20)
            .all()
        )

        return jsonify({
            "psychologist": serialize_admin_psychologist(user),
            "audit_logs": [serialize_admin_audit_log(log) for log in audit_logs],
        }), 200

    @app.patch("/admin/psychologists/<int:psychologist_id>")
    @jwt_required()
    def admin_update_psychologist(psychologist_id):
        admin_user, error = require_admin_user()
        if error:
            return error

        user = User.query.get(psychologist_id)
        if not user or user.role != "psychologist":
            return jsonify({"msg": "Psicologo no encontrado"}), 404

        profile = PsychologistProfile.query.filter_by(owner_user_id=user.id).first()
        if not profile:
            return jsonify({"msg": "El psicologo no tiene perfil para editar"}), 404

        body = request.get_json(silent=True) or {}
        changed_fields = []

        if "email" in body:
            email = normalize_email(body.get("email"))
            if not email:
                return jsonify({"msg": "El email es obligatorio"}), 400
            existing = User.query.filter(User.email == email, User.id != user.id).first()
            if existing:
                return jsonify({"msg": "Ese email ya esta registrado"}), 409
            if email != user.email:
                user.email = email
                changed_fields.append("email")

        if "default_session_minutes" in body:
            minutes = body.get("default_session_minutes")
            if not isinstance(minutes, int) or minutes <= 0:
                return jsonify({"msg": "default_session_minutes invalido"}), 400
            if minutes != user.default_session_minutes:
                user.default_session_minutes = minutes
                changed_fields.append("duracion de sesion")

        if "full_name" in body:
            value = clean_text(body.get("full_name"))
            if not value:
                return jsonify({"msg": "El nombre completo es obligatorio"}), 400
            if value != profile.full_name:
                profile.full_name = value
                changed_fields.append("nombre")

        if "professional_title" in body:
            value = clean_text(body.get("professional_title"))
            if not value:
                return jsonify({"msg": "El titulo profesional es obligatorio"}), 400
            if value != profile.professional_title:
                profile.professional_title = value
                changed_fields.append("titulo")

        if "office_address" in body:
            value = clean_text(body.get("office_address"))
            if not value:
                return jsonify({"msg": "La direccion del consultorio es obligatoria"}), 400
            if value != profile.office_address:
                profile.office_address = value
                profile.office_addresses_json = json.dumps([value])
                changed_fields.append("consultorio")

        if "notification_email" in body:
            value = normalize_email(body.get("notification_email")) or None
            if value != profile.notification_email:
                profile.notification_email = value
                changed_fields.append("email de notificaciones")

        if "visible_agenda_start_time" in body or "visible_agenda_end_time" in body:
            start_time = normalize_time_string(
                body.get("visible_agenda_start_time", profile.visible_agenda_start_time),
                profile.visible_agenda_start_time or "06:00",
            )
            end_time = normalize_time_string(
                body.get("visible_agenda_end_time", profile.visible_agenda_end_time),
                profile.visible_agenda_end_time or "22:00",
            )
            if not start_time or not end_time:
                return jsonify({"msg": "El rango visible de agenda debe usar formato HH:MM"}), 400
            if start_time >= end_time:
                return jsonify({"msg": "La hora final de agenda debe ser posterior a la hora inicial"}), 400
            if start_time != profile.visible_agenda_start_time or end_time != profile.visible_agenda_end_time:
                profile.visible_agenda_start_time = start_time
                profile.visible_agenda_end_time = end_time
                changed_fields.append("agenda visible")

        if changed_fields:
            add_admin_audit_log(
                admin_user,
                user,
                "psychologist_profile_updated",
                f"Campos actualizados: {', '.join(changed_fields)}",
            )
            db.session.commit()

        return jsonify({
            "msg": "Datos actualizados" if changed_fields else "Sin cambios",
            "psychologist": serialize_admin_psychologist(user),
        }), 200

    @app.patch("/admin/psychologists/<int:psychologist_id>/status")
    @jwt_required()
    def admin_update_psychologist_status(psychologist_id):
        admin_user, error = require_admin_user()
        if error:
            return error

        user = User.query.get(psychologist_id)
        if not user or user.role != "psychologist":
            return jsonify({"msg": "Psicologo no encontrado"}), 404

        body = request.get_json(silent=True) or {}
        is_active = body.get("is_active")
        if not isinstance(is_active, bool):
            return jsonify({"msg": "is_active debe ser booleano"}), 400

        previous_status = bool(user.is_active)
        user.is_active = is_active
        if previous_status != is_active:
            add_admin_audit_log(
                admin_user,
                user,
                "psychologist_status_updated",
                f"Estado cambiado de {'activo' if previous_status else 'inactivo'} a {'activo' if is_active else 'inactivo'}",
            )
        db.session.commit()

        return jsonify({
            "msg": "Estado actualizado",
            "psychologist": serialize_admin_psychologist(user),
        }), 200

    @app.patch("/admin/psychologists/<int:psychologist_id>/password")
    @jwt_required()
    def admin_reset_psychologist_password(psychologist_id):
        admin_user, error = require_admin_user()
        if error:
            return error

        user = User.query.get(psychologist_id)
        if not user or user.role != "psychologist":
            return jsonify({"msg": "Psicologo no encontrado"}), 404

        body = request.get_json(silent=True) or {}
        password = body.get("password") or ""
        password_error = validate_password_strength(password)
        if password_error:
            return jsonify({"msg": password_error}), 400

        user.password_hash = generate_password_hash(password)
        add_admin_audit_log(
            admin_user,
            user,
            "psychologist_password_reset",
            "Password temporal actualizado desde administracion",
        )
        pending_requests = PasswordResetRequest.query.filter_by(
            user_id=user.id,
            status="pending",
        ).all()
        for reset_request in pending_requests:
            reset_request.status = "resolved"
            reset_request.resolved_at = get_local_now()
        db.session.commit()

        return jsonify({"msg": "Password actualizado"}), 200

    @app.patch("/me/settings")
    @jwt_required()
    def update_my_settings():
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)

        if not user:
            return jsonify({"msg": "Usuario no existe"}), 404

        body = request.get_json(silent=True) or {}
        minutes = body.get("default_session_minutes")

        if not isinstance(minutes, int) or minutes <= 0:
            return jsonify({"msg": "default_session_minutes inválido"}), 400

        user.default_session_minutes = minutes
        db.session.commit()

        return jsonify({
            "msg": "Configuración actualizada",
            "user": user.serialize()
        }), 200

    # --- PACIENTES ---
    @app.get("/patients")
    @jwt_required()
    def list_patients():
        user_id = int(get_jwt_identity())
        now = get_local_now()
        preview_end = now + timedelta(days=180)
        materialize_recurring_appointments(user_id, get_day_start(now), preview_end)

        patients = (
            Patient.query
            .filter_by(owner_user_id=user_id)
            .order_by(Patient.id.desc())
            .all()
        )

        upcoming_appointments = (
            Appointment.query
            .filter(
                Appointment.owner_user_id == user_id,
                Appointment.patient_id.isnot(None),
                Appointment.start_at >= now,
                Appointment.status != "cancelled",
            )
            .order_by(Appointment.start_at.asc())
            .all()
        )

        next_appointments_by_patient = {}
        for appointment in upcoming_appointments:
            if appointment.patient_id not in next_appointments_by_patient:
                next_appointments_by_patient[appointment.patient_id] = appointment

        patient_ids = [patient.id for patient in patients]
        history_by_patient = {patient_id: [] for patient_id in patient_ids}
        billing_appointments = []

        if patient_ids:
            history_items = (
                Appointment.query
                .filter(
                    Appointment.owner_user_id == user_id,
                    Appointment.patient_id.in_(patient_ids),
                )
                .order_by(Appointment.start_at.desc())
                .all()
            )

            for appointment in history_items:
                billing_appointments.append(appointment)
                patient_history = history_by_patient.setdefault(appointment.patient_id, [])
                if len(patient_history) < 8:
                    patient_history.append(serialize_appointment_summary(appointment))

        return jsonify({
            "patients": [
                {
                    **serialize_patient_with_next_appointment(
                        patient,
                        next_appointments_by_patient.get(patient.id),
                    ),
                    "appointment_history": history_by_patient.get(patient.id, []),
                    "billing_summary": build_patient_billing_summary(patient.id, billing_appointments),
                }
                for patient in patients
            ]
        }), 200

    @app.post("/patients")
    @jwt_required()
    def create_patient():
        user_id = int(get_jwt_identity())
        body = request.get_json(silent=True) or {}

        full_name = (body.get("full_name") or "").strip()
        phone = (body.get("phone") or "").strip() or None
        email = (body.get("email") or "").strip().lower() or None
        dni = clean_text(body.get("dni")) or None
        date_of_birth, date_of_birth_error = parse_iso_date(body.get("date_of_birth"), "date_of_birth")
        address = clean_text(body.get("address")) or None
        occupation = clean_text(body.get("occupation")) or None
        insurance = clean_text(body.get("insurance")) or None
        emergency_contact_name = clean_text(body.get("emergency_contact_name")) or None
        emergency_contact_phone = clean_text(body.get("emergency_contact_phone")) or None
        notes = (body.get("notes") or "").strip() or None
        session_fee_amount = parse_money_amount(body.get("session_fee_amount"), 0)
        billing_notes = clean_text(body.get("billing_notes")) or None

        if not full_name:
            return jsonify({"msg": "full_name es obligatorio"}), 400
        if date_of_birth_error:
            return jsonify({"msg": date_of_birth_error}), 400

        p = Patient(
            owner_user_id=user_id,
            full_name=full_name,
            phone=phone,
            email=email,
            dni=dni,
            date_of_birth=date_of_birth,
            address=address,
            occupation=occupation,
            insurance=insurance,
            emergency_contact_name=emergency_contact_name,
            emergency_contact_phone=emergency_contact_phone,
            notes=notes,
            session_fee_amount=session_fee_amount,
            billing_notes=billing_notes,
        )
        db.session.add(p)
        db.session.commit()
        return jsonify({"patient": p.serialize()}), 201

    @app.patch("/patients/<int:patient_id>")
    @jwt_required()
    def update_patient(patient_id):
        user_id = int(get_jwt_identity())
        patient = Patient.query.filter_by(id=patient_id, owner_user_id=user_id).first()

        if not patient:
            return jsonify({"msg": "Paciente no existe"}), 404

        body = request.get_json(silent=True) or {}

        if "full_name" in body:
            full_name = clean_text(body.get("full_name"))
            if not full_name:
                return jsonify({"msg": "full_name es obligatorio"}), 400
            patient.full_name = full_name

        if "phone" in body:
            patient.phone = clean_text(body.get("phone")) or None

        if "email" in body:
            patient.email = normalize_email(body.get("email")) or None

        if "dni" in body:
            patient.dni = clean_text(body.get("dni")) or None

        if "date_of_birth" in body:
            date_of_birth, error = parse_iso_date(body.get("date_of_birth"), "date_of_birth")
            if error:
                return jsonify({"msg": error}), 400
            patient.date_of_birth = date_of_birth

        if "address" in body:
            patient.address = clean_text(body.get("address")) or None

        if "occupation" in body:
            patient.occupation = clean_text(body.get("occupation")) or None

        if "insurance" in body:
            patient.insurance = clean_text(body.get("insurance")) or None

        if "emergency_contact_name" in body:
            patient.emergency_contact_name = clean_text(body.get("emergency_contact_name")) or None

        if "emergency_contact_phone" in body:
            patient.emergency_contact_phone = clean_text(body.get("emergency_contact_phone")) or None

        if "notes" in body:
            patient.notes = clean_text(body.get("notes")) or None

        if "session_fee_amount" in body:
            patient.session_fee_amount = parse_money_amount(body.get("session_fee_amount"), 0)

        if "billing_notes" in body:
            patient.billing_notes = clean_text(body.get("billing_notes")) or None

        db.session.commit()
        return jsonify({"patient": patient.serialize()}), 200

    @app.delete("/patients/<int:patient_id>")
    @jwt_required()
    def delete_patient(patient_id):
        user_id = int(get_jwt_identity())
        p = Patient.query.filter_by(id=patient_id, owner_user_id=user_id).first()

        if not p:
            return jsonify({"msg": "Paciente no existe"}), 404

        db.session.delete(p)
        db.session.commit()
        return jsonify({"msg": "Paciente eliminado"}), 200

    # --- DISPONIBILIDAD SEMANAL ---
    @app.get("/availability/rules")
    @jwt_required()
    def list_availability_rules():
        user_id = int(get_jwt_identity())
        rules = (
            AvailabilityRule.query
            .filter_by(owner_user_id=user_id)
            .order_by(AvailabilityRule.weekday.asc(), AvailabilityRule.start_time.asc())
            .all()
        )
        return jsonify({"rules": [r.serialize() for r in rules]}), 200

    @app.post("/availability/rules")
    @jwt_required()
    def create_availability_rule():
        user_id = int(get_jwt_identity())
        body = request.get_json(silent=True) or {}

        weekday = body.get("weekday")
        start_time = (body.get("start_time") or "").strip()
        end_time = (body.get("end_time") or "").strip()
        active = body.get("active", True)

        if weekday is None or not isinstance(weekday, int) or weekday < 0 or weekday > 6:
            return jsonify({"msg": "weekday debe ser int entre 0 y 6 (0=lunes)"}), 400
        if not is_hhmm(start_time) or not is_hhmm(end_time):
            return jsonify({"msg": "start_time y end_time deben ser 'HH:MM'"}), 400
        if hhmm_to_minutes(end_time) <= hhmm_to_minutes(start_time):
            return jsonify({"msg": "end_time debe ser mayor que start_time"}), 400
        if not isinstance(active, bool):
            return jsonify({"msg": "active debe ser boolean"}), 400

        if overlaps_existing_rule(user_id, weekday, start_time, end_time):
            return jsonify({"msg": "Ese bloque se superpone con otro existente"}), 409

        rule = AvailabilityRule(
            owner_user_id=user_id,
            weekday=weekday,
            start_time=start_time,
            end_time=end_time,
            active=active,
        )
        db.session.add(rule)
        db.session.commit()
        return jsonify({"rule": rule.serialize()}), 201

    @app.patch("/availability/rules/<int:rule_id>")
    @jwt_required()
    def update_availability_rule(rule_id):
        user_id = int(get_jwt_identity())
        rule = AvailabilityRule.query.filter_by(id=rule_id, owner_user_id=user_id).first()
        if not rule:
            return jsonify({"msg": "Regla no existe"}), 404

        body = request.get_json(silent=True) or {}

        if "weekday" in body:
            weekday = body.get("weekday")
            if not isinstance(weekday, int) or weekday < 0 or weekday > 6:
                return jsonify({"msg": "weekday debe ser int entre 0 y 6"}), 400
            rule.weekday = weekday

        if "start_time" in body:
            st = (body.get("start_time") or "").strip()
            if not is_hhmm(st):
                return jsonify({"msg": "start_time debe ser 'HH:MM'"}), 400
            rule.start_time = st

        if "end_time" in body:
            et = (body.get("end_time") or "").strip()
            if not is_hhmm(et):
                return jsonify({"msg": "end_time debe ser 'HH:MM'"}), 400
            rule.end_time = et

        if "active" in body:
            active = body.get("active")
            if not isinstance(active, bool):
                return jsonify({"msg": "active debe ser boolean"}), 400
            rule.active = active

        if hhmm_to_minutes(rule.end_time) <= hhmm_to_minutes(rule.start_time):
            return jsonify({"msg": "end_time debe ser mayor que start_time"}), 400

        if overlaps_existing_rule(user_id, rule.weekday, rule.start_time, rule.end_time, exclude_id=rule.id):
            return jsonify({"msg": "Ese bloque se superpone con otro existente"}), 409

        db.session.commit()
        return jsonify({"rule": rule.serialize()}), 200

    @app.delete("/availability/rules/<int:rule_id>")
    @jwt_required()
    def delete_availability_rule(rule_id):
        user_id = int(get_jwt_identity())
        rule = AvailabilityRule.query.filter_by(id=rule_id, owner_user_id=user_id).first()
        if not rule:
            return jsonify({"msg": "Regla no existe"}), 404

        db.session.delete(rule)
        db.session.commit()
        return jsonify({"msg": "Regla eliminada"}), 200

    @app.get("/availability/weekly-preview")
    @jwt_required()
    def weekly_preview():
        user_id = int(get_jwt_identity())
        week_offset = request.args.get("week_offset", default=0, type=int)

        user = User.query.get(user_id)
        if not user:
            return jsonify({"msg": "Usuario no existe"}), 404

        slot_minutes = user.default_session_minutes
        gap_minutes = 10
        step_minutes = slot_minutes + gap_minutes

        week_start = get_week_start(get_local_now(), week_offset)
        week_end = week_start + timedelta(days=7)

        materialize_recurring_appointments(user_id, week_start, week_end)

        rules = (
            AvailabilityRule.query
            .filter_by(owner_user_id=user_id, active=True)
            .order_by(AvailabilityRule.weekday.asc(), AvailabilityRule.start_time.asc())
            .all()
        )

        appointments = (
            Appointment.query
            .filter(
                Appointment.owner_user_id == user_id,
                Appointment.start_at >= week_start,
                Appointment.start_at < week_end,
                Appointment.status != "cancelled",
            )
            .order_by(Appointment.start_at.asc())
            .all()
        )

        preview = {}

        # 1) preparar los 7 días
        for i in range(7):
            day_date = week_start + timedelta(days=i)
            day_key = day_date.strftime("%Y-%m-%d")
            preview[day_key] = []

        # 2) generar bloques libres desde disponibilidad
        for i in range(7):
            day_date = week_start + timedelta(days=i)
            day_key = day_date.strftime("%Y-%m-%d")

            day_rules = [r for r in rules if r.weekday == day_date.weekday()]

            for rule in day_rules:
                start_minutes = hhmm_to_minutes(rule.start_time)
                end_minutes = hhmm_to_minutes(rule.end_time)

                cursor = start_minutes

                while cursor + slot_minutes <= end_minutes:
                    slot_start = day_date.replace(
                        hour=cursor // 60,
                        minute=cursor % 60,
                        second=0,
                        microsecond=0,
                    )
                    slot_end = slot_start + timedelta(minutes=slot_minutes)

                    overlapping_appt = next(
                        (
                            a for a in appointments
                            if a.start_at < slot_end and a.end_at > slot_start
                        ),
                        None
                    )

                    preview[day_key].append({
                        "start_at": slot_start.isoformat(),
                        "end_at": slot_end.isoformat(),
                        "status": overlapping_appt.status if overlapping_appt else "free",
                        "appointment_id": overlapping_appt.id if overlapping_appt else None,
                        "patient_id": overlapping_appt.patient_id if overlapping_appt else None,
                        "recurring_series_id": overlapping_appt.recurring_series_id if overlapping_appt else None,
                        "location": overlapping_appt.location if overlapping_appt else None,
                        "notes": overlapping_appt.notes if overlapping_appt else None,
                        "fee_amount": overlapping_appt.fee_amount if overlapping_appt else 0,
                        "payment_status": overlapping_appt.payment_status if overlapping_appt else "pending",
                        "paid_at": overlapping_appt.paid_at.isoformat() if overlapping_appt and overlapping_appt.paid_at else None,
                    })

                    cursor += step_minutes

        # 3) agregar appointments que hayan quedado fuera de los bloques generados
        for appt in appointments:
            day_key = appt.start_at.strftime("%Y-%m-%d")

            already_present = any(
                item.get("appointment_id") == appt.id
                for item in preview[day_key]
            )

            if not already_present:
                preview[day_key].append({
                    "start_at": appt.start_at.isoformat(),
                    "end_at": appt.end_at.isoformat(),
                    "status": appt.status,
                    "appointment_id": appt.id,
                    "patient_id": appt.patient_id,
                    "recurring_series_id": appt.recurring_series_id,
                    "location": appt.location,
                    "notes": appt.notes,
                    "fee_amount": appt.fee_amount or 0,
                    "payment_status": appt.payment_status or "pending",
                    "paid_at": appt.paid_at.isoformat() if appt.paid_at else None,
                })

        # 4) ordenar cada día por hora
        for day_key in preview:
            preview[day_key].sort(key=lambda x: x["start_at"])

        return jsonify({
            "week_start": week_start.strftime("%Y-%m-%d"),
            "week_end": (week_end - timedelta(days=1)).strftime("%Y-%m-%d"),
            "slot_minutes": slot_minutes,
            "days": preview,
        }), 200

    # --- APPOINTMENTS ---
    @app.get("/appointments")
    @jwt_required()
    def list_appointments():
        user_id = int(get_jwt_identity())

        appointments = (
            Appointment.query
            .filter_by(owner_user_id=user_id)
            .order_by(Appointment.start_at.asc())
            .all()
        )

        return jsonify({"appointments": [a.serialize() for a in appointments]}), 200

    @app.get("/appointments/weekly-preview")
    @jwt_required()
    def get_weekly_appointments():
        user_id = int(get_jwt_identity())
        week_offset = int(request.args.get("week_offset", 0))

        # Calcular el inicio de la semana (lunes)
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())  # Lunes de esta semana
        monday = monday + timedelta(days=week_offset * 7)
        monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)

        # Obtener todos los turnos de la semana
        week_start = monday
        week_end = monday + timedelta(days=7)

        appointments = (
            Appointment.query
            .filter_by(owner_user_id=user_id)
            .filter(Appointment.start_at >= week_start)
            .filter(Appointment.start_at < week_end)
            .order_by(Appointment.start_at.asc())
            .all()
        )

        # Organizar por día
        weekly_preview = {}
        for i in range(7):
            day_date = monday + timedelta(days=i)
            day_key = day_date.strftime("%Y-%m-%d")
            weekly_preview[day_key] = []

        # Agregar turnos a los días correspondientes
        for appointment in appointments:
            day_key = appointment.start_at.strftime("%Y-%m-%d")
            if day_key in weekly_preview:
                # Obtener nombre del paciente si existe
                patient_name = None
                if appointment.patient_id:
                    patient = Patient.query.filter_by(id=appointment.patient_id, owner_user_id=user_id).first()
                    if patient:
                        patient_name = patient.full_name

                slot_data = {
                    "id": appointment.id,
                    "start_at": appointment.start_at.isoformat(),
                    "end_at": appointment.end_at.isoformat() if appointment.end_at else None,
                    "patient_id": appointment.patient_id,
                    "patient_name": patient_name,
                    "status": appointment.status,
                    "location": appointment.location,
                    "notes": appointment.notes,
                    "fee_amount": appointment.fee_amount or 0,
                    "payment_status": appointment.payment_status or "pending",
                    "paid_at": appointment.paid_at.isoformat() if appointment.paid_at else None,
                }
                weekly_preview[day_key].append(slot_data)

        return jsonify({"weekly_preview": weekly_preview}), 200

    @app.post("/appointments")
    @jwt_required()
    def create_appointment():
        user_id = int(get_jwt_identity())
        body = request.get_json(silent=True) or {}

        patient_id = body.get("patient_id")
        start_at_str = body.get("start_at")
        duration_minutes = body.get("duration_minutes")
        location = clean_text(body.get("location")) or get_default_appointment_location(user_id)
        notes = (body.get("notes") or "").strip() or None
        recurrence = body.get("recurrence") if isinstance(body.get("recurrence"), dict) else None
        payment_status = clean_text(body.get("payment_status")) or "pending"

        if not start_at_str:
            return jsonify({"msg": "start_at es obligatorio"}), 400
        if payment_status not in {"pending", "paid", "waived"}:
            return jsonify({"msg": "Estado de pago invalido"}), 400

        patient = None
        if patient_id is not None:
            patient = Patient.query.filter_by(id=patient_id, owner_user_id=user_id).first()
            if not patient:
                return jsonify({"msg": "Paciente no existe"}), 404

        try:
            start_at = datetime.fromisoformat(start_at_str)
        except Exception:
            return jsonify({"msg": "start_at inválido. Usá formato ISO"}), 400

        user = User.query.get(user_id)
        minutes = duration_minutes if isinstance(duration_minutes, int) and duration_minutes > 0 else user.default_session_minutes
        default_fee = patient.session_fee_amount if patient else 0
        fee_amount = parse_money_amount(body.get("fee_amount"), default_fee or 0)
        paid_at = get_local_now() if payment_status == "paid" else None

        if recurrence:
            frequency = recurrence.get("frequency")
            until_date, error = parse_iso_date(recurrence.get("until_date"), "until_date")
            if error:
                return jsonify({"msg": error}), 400
            if frequency != "weekly":
                return jsonify({"msg": "Solo se soporta recurrencia semanal por ahora"}), 400
            if until_date and until_date < start_at.date():
                return jsonify({"msg": "until_date debe ser igual o posterior a la fecha inicial"}), 400

            series = RecurringAppointmentSeries(
                owner_user_id=user_id,
                patient_id=patient_id,
                weekday=start_at.weekday(),
                start_time=start_at.strftime("%H:%M"),
                duration_minutes=minutes,
                start_date=start_at.date(),
                end_date=until_date,
                location=location,
                notes=notes,
                active=True,
            )
            db.session.add(series)
            db.session.flush()

            appointment = Appointment(
                owner_user_id=user_id,
                patient_id=patient_id,
                recurring_series_id=series.id,
                recurrence_origin_date=start_at.date(),
                start_at=start_at,
                end_at=start_at + timedelta(minutes=minutes),
                status="scheduled" if patient_id else "free",
                location=location,
                notes=notes,
                fee_amount=fee_amount if patient_id else 0,
                payment_status=payment_status if patient_id else "pending",
                paid_at=paid_at if patient_id else None,
            )

            if overlaps_existing_appointment(user_id, appointment.start_at, appointment.end_at):
                db.session.rollback()
                return jsonify({"msg": "Ese turno se superpone con otro"}), 409

            db.session.add(appointment)
            db.session.commit()

            return jsonify({
                "appointment": appointment.serialize(),
                "recurring_series": series.serialize(),
            }), 201

        end_at = start_at + timedelta(minutes=minutes)

        if overlaps_existing_appointment(user_id, start_at, end_at):
            return jsonify({"msg": "Ese turno se superpone con otro"}), 409

        appointment = Appointment(
            owner_user_id=user_id,
            patient_id=patient_id,
            start_at=start_at,
            end_at=end_at,
            status="scheduled" if patient_id else "free",
            location=location,
            notes=notes,
            fee_amount=fee_amount if patient_id else 0,
            payment_status=payment_status if patient_id else "pending",
            paid_at=paid_at if patient_id else None,
        )

        db.session.add(appointment)
        db.session.commit()

        return jsonify({"appointment": appointment.serialize()}), 201

    @app.patch("/appointments/<int:appointment_id>")
    @jwt_required()
    def update_appointment(appointment_id):
        user_id = int(get_jwt_identity())
        appointment = Appointment.query.filter_by(id=appointment_id, owner_user_id=user_id).first()

        if not appointment:
            return jsonify({"msg": "Turno no existe"}), 404

        body = request.get_json(silent=True) or {}

        start_at = appointment.start_at
        end_at = appointment.end_at
        patient_id = appointment.patient_id
        location = appointment.location
        selected_patient = None
        recurrence = body.get("recurrence") if isinstance(body.get("recurrence"), dict) else None

        if "start_at" in body:
            try:
                start_at = datetime.fromisoformat(body["start_at"])
            except Exception:
                return jsonify({"msg": "start_at inválido"}), 400

        if "duration_minutes" in body:
            duration_minutes = body["duration_minutes"]
            if not isinstance(duration_minutes, int) or duration_minutes <= 0:
                return jsonify({"msg": "duration_minutes inválido"}), 400
            end_at = start_at + timedelta(minutes=duration_minutes)
        else:
            original_duration = int((appointment.end_at - appointment.start_at).total_seconds() / 60)
            end_at = start_at + timedelta(minutes=original_duration)

        if "patient_id" in body:
            incoming_patient_id = body.get("patient_id")

            if incoming_patient_id in ("", None):
                patient_id = None
            else:
                selected_patient = Patient.query.filter_by(
                    id=incoming_patient_id,
                    owner_user_id=user_id
                ).first()

                if not selected_patient:
                    return jsonify({"msg": "Paciente no existe"}), 404

                patient_id = incoming_patient_id

        if "location" in body:
            location = clean_text(body.get("location")) or get_default_appointment_location(user_id)

        if overlaps_existing_appointment(user_id, start_at, end_at, exclude_id=appointment.id):
            return jsonify({"msg": "Ese turno se superpone con otro"}), 409

        appointment.start_at = start_at
        appointment.end_at = end_at
        appointment.patient_id = patient_id
        appointment.location = location

        if "status" in body:
            status = body["status"]
            if status not in {"pending", "scheduled", "attended", "no_show", "cancelled", "free"}:
                return jsonify({"msg": "Estado invalido"}), 400
            appointment.status = status
            if status != "pending":
                appointment.booking_confirm_token = None

        if "fee_amount" in body:
            appointment.fee_amount = parse_money_amount(body.get("fee_amount"), 0)
        elif "patient_id" in body and selected_patient and not appointment.fee_amount:
            appointment.fee_amount = selected_patient.session_fee_amount or 0

        if "payment_status" in body:
            payment_status = clean_text(body.get("payment_status")) or "pending"
            if payment_status not in {"pending", "paid", "waived"}:
                return jsonify({"msg": "Estado de pago invalido"}), 400
            appointment.payment_status = payment_status
            appointment.paid_at = get_local_now() if payment_status == "paid" and not appointment.paid_at else None
            if payment_status != "paid":
                appointment.paid_at = None

        if "notes" in body:
            appointment.notes = (body.get("notes") or "").strip() or None

        if recurrence is not None:
            recurrence_enabled = recurrence.get("enabled")
            if recurrence_enabled is False and appointment.recurring_series_id:
                series = RecurringAppointmentSeries.query.filter_by(
                    id=appointment.recurring_series_id,
                    owner_user_id=user_id,
                ).first()
                if series:
                    series.active = False
                appointment.recurring_series_id = None
                appointment.recurrence_origin_date = None
            elif recurrence.get("frequency") == "weekly" or recurrence_enabled is True:
                duration_value = int((appointment.end_at - appointment.start_at).total_seconds() / 60)
                if appointment.recurring_series_id:
                    series = RecurringAppointmentSeries.query.filter_by(
                        id=appointment.recurring_series_id,
                        owner_user_id=user_id,
                    ).first()
                    if series:
                        series.patient_id = patient_id
                        series.weekday = appointment.start_at.weekday()
                        series.start_time = appointment.start_at.strftime("%H:%M")
                        series.duration_minutes = duration_value
                        series.location = location
                        series.notes = appointment.notes
                        series.active = True
                else:
                    series = RecurringAppointmentSeries(
                        owner_user_id=user_id,
                        patient_id=patient_id,
                        weekday=appointment.start_at.weekday(),
                        start_time=appointment.start_at.strftime("%H:%M"),
                        duration_minutes=duration_value,
                        start_date=appointment.start_at.date(),
                        end_date=None,
                        location=location,
                        notes=appointment.notes,
                        active=True,
                    )
                    db.session.add(series)
                    db.session.flush()
                    appointment.recurring_series_id = series.id
                    appointment.recurrence_origin_date = appointment.start_at.date()

        db.session.commit()
        return jsonify({"appointment": appointment.serialize()}), 200
    

    @app.delete("/appointments/<int:appointment_id>")
    @jwt_required()
    def delete_appointment(appointment_id):
        user_id = int(get_jwt_identity())
        appointment = Appointment.query.filter_by(id=appointment_id, owner_user_id=user_id).first()

        if not appointment:
            return jsonify({"msg": "Turno no existe"}), 404

        if appointment.recurring_series_id and appointment.recurrence_origin_date:
            existing_exception = RecurringAppointmentException.query.filter_by(
                owner_user_id=user_id,
                recurring_series_id=appointment.recurring_series_id,
                occurrence_date=appointment.recurrence_origin_date,
            ).first()
            if not existing_exception:
                db.session.add(RecurringAppointmentException(
                    owner_user_id=user_id,
                    recurring_series_id=appointment.recurring_series_id,
                    occurrence_date=appointment.recurrence_origin_date,
                ))

        db.session.delete(appointment)
        db.session.commit()
        return jsonify({"msg": "Turno eliminado"}), 200

    @app.post("/appointments/<int:appointment_id>/notify")
    @jwt_required()
    def notify_appointment(appointment_id):
        user_id = int(get_jwt_identity())
        appointment = Appointment.query.filter_by(id=appointment_id, owner_user_id=user_id).first()

        if not appointment:
            return jsonify({"msg": "Turno no existe"}), 404

        if not appointment.patient_id:
            return jsonify({"msg": "El turno no tiene paciente asignado"}), 400

        patient = Patient.query.filter_by(id=appointment.patient_id, owner_user_id=user_id).first()
        if not patient:
            return jsonify({"msg": "Paciente no existe"}), 404

        body = request.get_json(silent=True) or {}
        method = (body.get("method") or "email").lower()
        location = (body.get("location") or "Consultorio principal").strip()
        user = User.query.get(user_id)
        profile = PsychologistProfile.query.filter_by(owner_user_id=user_id).first()
        notification_data = build_appointment_notification_payload(
            user,
            profile,
            patient,
            appointment,
            method_override=method,
            location_override=location,
        )
        appointment_location = notification_data["appointment_location"]
        notification_email = notification_data["notification_email"]
        message = notification_data["message"]
        logo_url = (
            get_email_asset_url("logo 6 baja max.png")
            or get_email_asset_url("logo 6 baja.png")
            or get_email_asset_url("logo 6.png")
        )
        profile_icon = ""
        location_icon = ""
        mail_icon = ""
        header_calendar_illustration = ""
        logo_markup = (
            '<div style="width:46px;height:46px;border-radius:50%;background:#ffffff;'
            'overflow:hidden;text-align:center;">'
            f'<img src="{logo_url}" alt="TherapyDesk" '
            'style="width:46px;height:46px;display:block;object-fit:cover;border:0;" />'
            '</div>'
            if logo_url
            else
            '<div style="width:46px;height:46px;border-radius:50%;background:#ffffff;'
            'color:#17265f;text-align:center;font-size:18px;line-height:46px;font-weight:900;">TD</div>'
        )
        inline_attachments = []
        email_preheader = (
            f"Te compartimos los detalles de tu turno del "
            f"{notification_data['date_short_str']} a las {notification_data['time_display_str']}."
        )
        patient_name_html = escape(patient.full_name)
        date_short_html = escape(notification_data["date_short_str"])
        time_display_html = escape(notification_data["time_display_str"])
        psychologist_name_html = escape(notification_data["psychologist_name"])
        psychologist_title_html = escape(notification_data["psychologist_title"])
        appointment_location_html = escape(appointment_location)
        notification_email_html = escape(notification_email or "No informado")

        html_message = f"""
        <div style="background:#eef2ff;padding:24px 12px;font-family:Arial,sans-serif;color:#10183c;">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">{escape(email_preheader)}</div>
          <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #d9defa;box-shadow:0 12px 30px rgba(16,24,60,0.12);">
            <div style="background:linear-gradient(135deg,#07143a,#17265f);padding:12px 28px 0;color:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 10px;">
                <tr>
                  <td style="vertical-align:middle;padding:0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="width:46px;vertical-align:middle;padding:0 10px 0 0;">{logo_markup}</td>
                        <td style="vertical-align:middle;padding:0;">
                          <p style="margin:0;font-size:20px;line-height:1;font-weight:800;color:#ffffff;">Therapy<span style="color:#12a77c;">Desk</span></p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width:130px;vertical-align:middle;text-align:right;padding:0;">
                    <div style="display:inline-block;width:118px;vertical-align:middle;">{header_calendar_illustration}</div>
                  </td>
                </tr>
              </table>
              <div style="height:5px;background:#12a77c;"></div>
            </div>
            <div style="padding:32px 34px 34px;">
              <p style="margin:0 0 22px;font-size:18px;line-height:1.4;">Hola <strong>{patient_name_html}</strong>,</p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">Te compartimos los detalles de tu turno.</p>
              <div style="background:#fbfcff;border:1px solid #dfe5ff;border-radius:12px;padding:20px 24px;margin-bottom:30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="width:35%;padding:12px 14px 12px 0;border-bottom:1px solid #e3e8f7;font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#6b759a;">Fecha</td>
                    <td style="padding:12px 0;border-bottom:1px solid #e3e8f7;font-size:18px;line-height:1.35;font-weight:900;color:#10183c;">{date_short_html}</td>
                  </tr>
                  <tr>
                    <td style="width:35%;padding:12px 14px 12px 0;border-bottom:1px solid #e3e8f7;font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#6b759a;">Hora</td>
                    <td style="padding:12px 0;border-bottom:1px solid #e3e8f7;font-size:18px;line-height:1.35;font-weight:900;color:#10183c;">{time_display_html}</td>
                  </tr>
                  <tr>
                    <td style="width:35%;padding:12px 14px 12px 0;border-bottom:1px solid #e3e8f7;font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#6b759a;">Profesional</td>
                    <td style="padding:12px 0;border-bottom:1px solid #e3e8f7;font-size:15px;line-height:1.35;color:#10183c;"><strong>{psychologist_name_html}</strong>{psychologist_title_html}</td>
                  </tr>
                  <tr>
                    <td style="width:35%;padding:12px 14px 12px 0;border-bottom:1px solid #e3e8f7;font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#6b759a;">Lugar</td>
                    <td style="padding:12px 0;border-bottom:1px solid #e3e8f7;font-size:15px;line-height:1.35;color:#10183c;">{appointment_location_html}</td>
                  </tr>
                  <tr>
                    <td style="width:35%;padding:12px 14px 12px 0;font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#6b759a;">Contacto</td>
                    <td style="padding:12px 0;font-size:15px;line-height:1.35;color:#10183c;">{notification_email_html}</td>
                  </tr>
                </table>
              </div>
              <p style="margin:0;padding-top:18px;border-top:1px solid #dfe5ff;text-align:center;font-size:14px;line-height:1.6;color:#10183c;">Si necesitas reprogramar o cancelar tu turno, contacta directamente con el profesional.</p>
            </div>
          </div>
        </div>
        """

        contact_info = ""
        if method == "email":
            if not patient.email:
                return jsonify({"msg": "El paciente no tiene email registrado"}), 400
            contact_info = patient.email
            recipient_email = patient.email
            patient_name = patient.full_name
            sender_name = "TherapyDesk"

            sent, error_message = send_email(
                recipient_email,
                notification_data["email_subject"],
                message,
                html_body=html_message,
                inline_attachments=inline_attachments,
                sender_email=notification_email,
                sender_name=sender_name,
                reply_to=notification_email,
            )
            if sent:
                print(f"[APPOINTMENT EMAIL] enviado a {recipient_email} para turno {appointment_id}")
                return jsonify({
                    "msg": f"Notificacion enviada para {patient_name} via {method} ({contact_info})",
                    "detail": message,
                }), 200

            print(f"[APPOINTMENT EMAIL ERROR] turno {appointment_id} a {recipient_email}: {error_message}")
            return jsonify({
                "msg": error_message or "No se pudo enviar la notificacion",
                "detail": message,
            }), 502
        elif method == "whatsapp":
            if not patient.phone:
                return jsonify({"msg": "El paciente no tiene teléfono registrado"}), 400
            if not all([
                os.getenv("TWILIO_ACCOUNT_SID"),
                os.getenv("TWILIO_AUTH_TOKEN"),
                os.getenv("TWILIO_WHATSAPP_FROM"),
            ]):
                return jsonify({
                    "msg": "Faltan credenciales de Twilio en backend/.env",
                    "detail": "Completá TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_FROM, luego reiniciá el backend.",
                }), 400
            contact_info = patient.phone
            sent, error_message = send_whatsapp(patient.phone, message)
        else:
            return jsonify({"msg": "Método inválido (usar email o whatsapp)"}), 400

        if not sent:
            status_code = 500
            if error_message and (
                "Configuración de email incompleta" in error_message
                or "revisá mail_username y mail_password" in error_message.lower()
            ):
                status_code = 400

            return jsonify({
                "msg": error_message or f"Error al enviar notificación via {method}. Verificá la configuración",
                "detail": message,
            }), status_code

        return jsonify({
            "msg": f"Notificación enviada a {patient.full_name} via {method} ({contact_info})",
            "detail": message,
        }), 200

    @app.post("/notifications/run-automatic-reminders")
    def run_automatic_reminders():
        api_key = clean_text(request.headers.get("X-Reminder-Key"))
        expected_key = clean_text(os.getenv("REMINDER_JOB_KEY"))
        if expected_key and api_key != expected_key:
            return jsonify({"msg": "No autorizado"}), 401

        now = get_local_now()
        profiles = PsychologistProfile.query.filter_by(auto_reminders_enabled=True).all()
        sent_count = 0
        skipped_count = 0

        for profile in profiles:
            user = User.query.get(profile.owner_user_id)
            if not user:
                continue

            hours_before = profile.auto_reminder_hours_before or 24
            window_start = now + timedelta(hours=hours_before)
            window_end = window_start + timedelta(minutes=15)

            appointments = (
                Appointment.query
                .filter(
                    Appointment.owner_user_id == profile.owner_user_id,
                    Appointment.status != "cancelled",
                    Appointment.patient_id.isnot(None),
                    Appointment.start_at >= window_start,
                    Appointment.start_at < window_end,
                )
                .all()
            )

            for appointment in appointments:
                if appointment.last_auto_reminder_sent_at:
                    skipped_count += 1
                    continue

                patient = Patient.query.filter_by(
                    id=appointment.patient_id,
                    owner_user_id=profile.owner_user_id,
                ).first()
                if not patient:
                    skipped_count += 1
                    continue

                method = (profile.auto_reminder_method or "email").lower()
                notification_data = build_appointment_notification_payload(
                    user,
                    profile,
                    patient,
                    appointment,
                    method_override=method,
                )

                success = False
                if method == "email":
                    if patient.email:
                        success, _ = send_email(
                            recipient=patient.email,
                            subject=notification_data["email_subject"],
                            body=notification_data["message"],
                            sender_email=notification_data["notification_email"],
                            sender_name=notification_data["psychologist_name"],
                            reply_to=notification_data["notification_email"],
                        )
                elif method == "whatsapp":
                    if patient.phone:
                        success, _ = send_whatsapp(patient.phone, notification_data["message"])

                if success:
                    appointment.last_auto_reminder_sent_at = now
                    sent_count += 1
                else:
                    skipped_count += 1

        db.session.commit()
        return jsonify({
            "msg": "Recordatorios automáticos procesados",
            "sent": sent_count,
            "skipped": skipped_count,
        }), 200

    # --- PSYCHOLOGIST PROFILE ---
    @app.get("/profile")
    @jwt_required()
    def get_profile():
        user_id = int(get_jwt_identity())
        profile = PsychologistProfile.query.filter_by(owner_user_id=user_id).first()
        user = User.query.get(user_id)

        if not profile:
            return jsonify({"msg": "Perfil no encontrado"}), 404

        if not profile.booking_slug:
            profile.booking_slug = generate_unique_booking_slug(profile.full_name)
            db.session.commit()

        return jsonify(profile.serialize(user.email if user else None)), 200

    @app.post("/profile")
    @jwt_required()
    def create_profile():
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        existing = PsychologistProfile.query.filter_by(owner_user_id=user_id).first()
        if existing:
            return jsonify({"msg": "Perfil ya existe, usa PATCH para actualizar"}), 409

        body = request.get_json(silent=True) or {}
        profile_data, profile_error = validate_profile_payload(body, require_required_fields=True)
        if profile_error:
            return jsonify({"msg": profile_error}), 400

        profile = PsychologistProfile(
            owner_user_id=user_id,
            full_name=profile_data["full_name"],
            professional_title=profile_data["professional_title"],
            description=profile_data["description"],
            office_address=profile_data["office_address"],
            office_addresses_json=json.dumps(profile_data["office_addresses"]),
            notification_email=profile_data["notification_email"],
            auto_reminders_enabled=bool(body.get("auto_reminders_enabled", False)),
            auto_reminder_method=(body.get("auto_reminder_method") or "email").lower(),
            auto_reminder_hours_before=int(body.get("auto_reminder_hours_before") or 24),
            visible_agenda_start_time=profile_data["visible_agenda_start_time"],
            visible_agenda_end_time=profile_data["visible_agenda_end_time"],
            booking_slug=generate_unique_booking_slug(profile_data["full_name"]),
            photo_data_url=profile_data["photo_data_url"],
        )
        db.session.add(profile)
        db.session.commit()

        return jsonify({"profile": profile.serialize(user.email if user else None)}), 201

    @app.patch("/profile")
    @jwt_required()
    def update_profile():
        user_id = int(get_jwt_identity())
        profile = PsychologistProfile.query.filter_by(owner_user_id=user_id).first()
        user = User.query.get(user_id)

        if not profile:
            return jsonify({"msg": "Perfil no existe, crea uno primero"}), 404

        body = request.get_json(silent=True) or {}

        if "full_name" in body:
            value = clean_text(body.get("full_name"))
            if not value:
                return jsonify({"msg": "El nombre completo es obligatorio"}), 400
            profile.full_name = value

        if "professional_title" in body:
            value = clean_text(body.get("professional_title"))
            if not value:
                return jsonify({"msg": "El título profesional es obligatorio"}), 400
            profile.professional_title = value

        if "description" in body:
            profile.description = clean_text(body.get("description")) or None

        if "office_address" in body:
            value = clean_text(body.get("office_address"))
            if not value:
                return jsonify({"msg": "La dirección del consultorio es obligatoria"}), 400
            profile.office_address = value

        if "office_addresses" in body:
            office_addresses = [
                clean_text(address)
                for address in (body.get("office_addresses") or [])[:5]
                if clean_text(address)
            ]
            if not office_addresses:
                return jsonify({"msg": "Debes cargar al menos una dirección"}), 400
            profile.office_address = office_addresses[0]
            profile.office_addresses_json = json.dumps(office_addresses)

        if "notification_email" in body:
            profile.notification_email = normalize_email(body.get("notification_email")) or None

        if "auto_reminders_enabled" in body:
            profile.auto_reminders_enabled = bool(body.get("auto_reminders_enabled"))

        if "auto_reminder_method" in body:
            method = (body.get("auto_reminder_method") or "email").lower()
            if method not in {"email", "whatsapp"}:
                return jsonify({"msg": "auto_reminder_method inválido"}), 400
            profile.auto_reminder_method = method

        if "auto_reminder_hours_before" in body:
            hours = body.get("auto_reminder_hours_before")
            if not isinstance(hours, int) or hours <= 0:
                return jsonify({"msg": "auto_reminder_hours_before inválido"}), 400
            profile.auto_reminder_hours_before = hours

        if "visible_agenda_start_time" in body or "visible_agenda_end_time" in body:
            start_time = normalize_time_string(
                body.get("visible_agenda_start_time", profile.visible_agenda_start_time),
                profile.visible_agenda_start_time or "06:00",
            )
            end_time = normalize_time_string(
                body.get("visible_agenda_end_time", profile.visible_agenda_end_time),
                profile.visible_agenda_end_time or "22:00",
            )
            if not start_time or not end_time:
                return jsonify({"msg": "El rango visible de agenda debe usar formato HH:MM"}), 400
            if start_time >= end_time:
                return jsonify({"msg": "La hora final de agenda debe ser posterior a la hora inicial"}), 400
            profile.visible_agenda_start_time = start_time
            profile.visible_agenda_end_time = end_time

        if "public_booking_enabled" in body:
            profile.public_booking_enabled = bool(body.get("public_booking_enabled"))
            if profile.public_booking_enabled and not profile.booking_slug:
                profile.booking_slug = generate_unique_booking_slug(profile.full_name)

        if "public_booking_min_notice_hours" in body:
            hours = body.get("public_booking_min_notice_hours")
            if not isinstance(hours, int) or hours < 0 or hours > 720:
                return jsonify({"msg": "public_booking_min_notice_hours debe estar entre 0 y 720"}), 400
            profile.public_booking_min_notice_hours = hours

        if "booking_slug" in body:
            slug = normalize_booking_slug(body.get("booking_slug"))
            if len(slug) < 4:
                return jsonify({"msg": "El link de reservas debe tener al menos 4 caracteres"}), 400
            existing = PsychologistProfile.query.filter(
                PsychologistProfile.booking_slug == slug,
                PsychologistProfile.id != profile.id,
            ).first()
            if existing:
                return jsonify({"msg": "Ese link de reservas ya esta en uso"}), 409
            profile.booking_slug = slug

        if "photo_data_url" in body:
            photo_data_url = clean_text(body.get("photo_data_url"))
            if photo_data_url:
                if not photo_data_url.startswith("data:image/"):
                    return jsonify({"msg": "La foto debe ser una imagen válida"}), 400
                if len(photo_data_url) > 2_500_000:
                    return jsonify({"msg": "La foto es demasiado grande"}), 400
                profile.photo_data_url = photo_data_url
            else:
                profile.photo_data_url = None

        db.session.commit()
        return jsonify({"profile": profile.serialize(user.email if user else None)}), 200

    return app


app = create_app()

if __name__ == "__main__":
    app.run(
        host=get_env("HOST", "0.0.0.0"),
        port=int(get_env("PORT", 5000)),
        debug=env_bool("FLASK_DEBUG", False),
    )
