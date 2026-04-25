# Activar Email y WhatsApp en Psico Agenda

## Configuración para enviar notificaciones reales

### 1. Email (SMTP)

#### Opción A: Gmail (con App Password)

1. Habilita 2-factor authentication en tu cuenta Google
2. Ve a https://myaccount.google.com/apppasswords
3. Crea una contraseña de aplicación para "Mail" y "Windows Computer"
4. Copia la contraseña de 16 caracteres generada

4. En tu archivo `.env` (copia desde `.env.example`):
```
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=tu-email@gmail.com
MAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx
MAIL_DEFAULT_SENDER=tu-email@gmail.com
```

#### Opción B: Outlook/Office365
```
MAIL_SERVER=smtp.office365.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=tu-email@outlook.com
MAIL_PASSWORD=tu-contraseña
MAIL_DEFAULT_SENDER=tu-email@outlook.com
```

#### Opción C: SendGrid (recomendado para producción)

1. Crea cuenta en https://sendgrid.com
2. Crea una API Key en Settings → API Keys
3. En `.env`:
```
MAIL_SERVER=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=apikey
MAIL_PASSWORD=SG.xxxxxxxxxxxxxx
MAIL_DEFAULT_SENDER=noreply@tudominio.com
```

---

### 2. WhatsApp (Twilio)

1. Crea cuenta en https://www.twilio.com
2. Verifica tu número de teléfono
3. Obtén tus credenciales en Console (https://console.twilio.com/):
   - **Account SID**
   - **Auth Token**
4. Compra un número de Twilio con WhatsApp habilitado
5. Conecta Twilio Sandbox de WhatsApp a tu número personal

6. En tu archivo `.env`:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
TWILIO_WHATSAPP_FROM=+1234567890
```

---

### 3. Archivo .env completo ejemplo

```ini
# Database
DATABASE_URL=sqlite:///dev.db

# JWT
JWT_SECRET_KEY=tu-clave-secreta-aqui

# Email (SMTP)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=tu-email@gmail.com
MAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
TWILIO_WHATSAPP_FROM=+1234567890

# App
MAIL_DEFAULT_SENDER=tu-email@gmail.com
```

---

### 4. Instalar dependencias

```bash
cd backend
pip install -r requirements.txt
```

---

### 5. Probar

1. Inicia el backend: `python app.py`
2. En la UI, ve a **Turnos**
3. Haz click en un turno reservado
4. Selecciona "Email" o "WhatsApp"
5. Haz click en **"Notificar"**
6. Deberías ver la notificación en la consola

---

## Troubleshooting

| Error | Solución |
|-------|----------|
| `[EMAIL ERROR] SMTPAuthenticationError` | Verifica MAIL_USERNAME y MAIL_PASSWORD en .env |
| `[WHATSAPP ERROR] Error 21608` | Verifica el número de teléfono (formato +1234567890) |
| `El paciente no tiene email registrado` | Agrega un email en la página de Pacientes |
| `El paciente no tiene teléfono registrado` | Agrega un teléfono en la página de Pacientes |
| `Credenciales de Twilio no configuradas` | Verifica TWILIO_* en .env |

---

## Para producción

- Usa variables de entorno seguras (no guardes .env en Git)
- Considera usar sendgrid o mailgun para emails
- Implementa reintentos para fallos de envío
- Agregar logs y monitoreo
- Usa HTTPS
