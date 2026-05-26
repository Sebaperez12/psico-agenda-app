# Produccion

## Estado inicial

La app esta preparada como dos servicios:

- Backend: Flask + SQLAlchemy.
- Frontend: React + Vite.

Para produccion no uses el servidor dev de Flask ni SQLite local. El backend debe correr con Gunicorn y una base PostgreSQL.

## Secretos

No commitear:

- `backend/.env`
- `backend/.env.development`
- `frontend/.env`
- `backend/instance/dev.db`

Antes de subir a un repo remoto, rotar las credenciales que hayan estado en archivos locales o capturas:

- `JWT_SECRET_KEY`
- credenciales SMTP
- credenciales Twilio

## Backend

Variables recomendadas:

```env
APP_ENV=production
HOST=0.0.0.0
PORT=5000
FLASK_DEBUG=False
APP_TIMEZONE=America/Montevideo
BACKEND_BASE_URL=https://api.tu-dominio.com
CORS_ORIGINS=https://tu-dominio.com

DATABASE_URL=postgresql://usuario:password@host:5432/dbname
JWT_SECRET_KEY=generar-una-clave-larga-y-unica

MAIL_SERVER=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_TIMEOUT=10
MAIL_USERNAME=usuario-smtp
MAIL_PASSWORD=clave-smtp
MAIL_DEFAULT_SENDER=noreply@tu-dominio.com

REMINDER_JOB_KEY=generar-una-clave-larga-y-unica
```

Comando de arranque:

```bash
gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
```

El health check responde en:

```text
GET /
```

## Frontend

Variable de build:

```env
VITE_API_URL=https://api.tu-dominio.com
```

Comandos:

```bash
npm install
npm run build
```

Publicar la carpeta `dist`.

Si se publica en Vercel, el archivo `frontend/vercel.json` ya deja configurado el fallback a
`index.html` para que las rutas internas de React funcionen al refrescar la pagina.

Configuracion sugerida en Vercel:

```text
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
Environment Variable: VITE_API_URL=https://api.tu-dominio.com
```

## Opcion Render + Vercel

El repo incluye `render.yaml` en la raiz para crear en Render:

- Web service `psico-agenda-api`.
- PostgreSQL `psico-agenda-db`.
- `DATABASE_URL` conectado automaticamente desde la base.
- `JWT_SECRET_KEY` y `REMINDER_JOB_KEY` generados por Render.
- Secretos SMTP/Twilio marcados como `sync: false` para cargarlos en el dashboard.

El blueprint usa plan `free` para facilitar la primera prueba. Para produccion real conviene pasar el
backend y la base a un plan pago antes de usarlo con pacientes reales.

Backend en Render:

```text
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
Health Check Path: /
```

Crear una base PostgreSQL en Render y usar su connection string como `DATABASE_URL`.

Frontend en Vercel:

```text
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

Despues de tener las URLs reales:

```env
# Backend
BACKEND_BASE_URL=https://api.tu-dominio.com
CORS_ORIGINS=https://tu-dominio.com

# Frontend
VITE_API_URL=https://api.tu-dominio.com
```

Si todavia no hay dominio propio, usar primero las URLs generadas:

```env
BACKEND_BASE_URL=https://psico-agenda-api.onrender.com
CORS_ORIGINS=https://tu-proyecto.vercel.app
VITE_API_URL=https://psico-agenda-api.onrender.com
```

## Recordatorios automaticos

Programar una tarea cada 15 minutos contra:

```text
POST /notifications/run-automatic-reminders
Header: X-Reminder-Key: <REMINDER_JOB_KEY>
```

Si el proveedor tiene cron jobs, usar `BACKEND_BASE_URL` publico. Si no, usar un scheduler externo.

## WhatsApp

El sandbox de Twilio queda solo para pruebas. Para produccion hay que registrar un remitente oficial de WhatsApp Business. Hasta eso, la opcion queda deshabilitada en la UI.

## Checklist antes de publicar

- Dominio decidido para frontend.
- Subdominio decidido para API, por ejemplo `api.tu-dominio.com`.
- PostgreSQL creado y `DATABASE_URL` configurado.
- `APP_ENV=production`.
- `CORS_ORIGINS` limitado al dominio real del frontend.
- `JWT_SECRET_KEY` nuevo y largo.
- SMTP con remitente verificado.
- Tarea programada de recordatorios.
- Backups de base de datos activos.
