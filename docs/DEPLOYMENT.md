# Deploy a produccion

Esta app esta preparada para desplegar backend en Render y frontend en Vercel.

## 1. Backend en Render

Usar el `render.yaml` del repo como Blueprint.

Render crea:

- Web service: `psico-agenda-api`
- Database: `psico-agenda-db`

El servicio se construye desde la raiz del repositorio porque el backend sirve algunos assets
de email ubicados en `frontend/src/assets`.

Variables que Render ya configura desde `render.yaml`:

- `APP_ENV=production`
- `FLASK_DEBUG=False`
- `APP_TIMEZONE=America/Montevideo`
- `DATABASE_URL` desde la base Postgres
- `JWT_SECRET_KEY` generado por Render
- `REMINDER_JOB_KEY` generado por Render
- `MAIL_SERVER=smtp-relay.brevo.com`
- `MAIL_PORT=587`
- `MAIL_USE_TLS=True`
- `MAIL_TIMEOUT=10`

Variables que hay que completar en Render:

- `BACKEND_BASE_URL`: URL publica del backend, por ejemplo `https://psico-agenda-api.onrender.com`
- `CORS_ORIGINS`: URL publica del frontend, por ejemplo `https://tu-app.vercel.app`
- `ADMIN_EMAILS`: emails que deben tener acceso al panel admin, separados por coma
- `MAIL_USERNAME`: usuario SMTP
- `MAIL_PASSWORD`: clave SMTP
- `MAIL_DEFAULT_SENDER`: remitente validado
- `TWILIO_ACCOUNT_SID`: opcional, si se usa WhatsApp
- `TWILIO_AUTH_TOKEN`: opcional, si se usa WhatsApp
- `TWILIO_WHATSAPP_FROM`: opcional, si se usa WhatsApp

## 2. Frontend en Vercel

Crear un proyecto Vercel apuntando a la carpeta `frontend`.

Configuracion:

- Framework: Vite
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Variable necesaria en Vercel:

- `VITE_API_URL`: URL publica del backend, por ejemplo `https://psico-agenda-api.onrender.com`

## 3. Ajuste final de CORS

Cuando Vercel entregue la URL final, volver a Render y poner esa URL en:

```env
CORS_ORIGINS=https://tu-app.vercel.app
```

Luego redeploy del backend.

## 4. Smoke test

Revisar:

- `https://tu-backend.onrender.com/` debe responder `{"msg":"Backend OK"}`
- El frontend debe permitir login/registro sin error de conexion.
- Crear un paciente de prueba.
- Crear un turno de prueba.
- Verificar recordatorios solo si ya estan configuradas las credenciales SMTP/Twilio.

## 5. Limites del plan Free

- Render Free bloquea conexiones SMTP salientes por el puerto `587`; para enviar emails por SMTP
  hay que usar un web service pago o cambiar el envio a una API HTTPS.
- Render Postgres Free expira a los 30 dias y no incluye backups. Para pacientes reales usar una
  base paga con backups.
