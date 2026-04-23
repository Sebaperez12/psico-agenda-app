# Psico Agenda App

Aplicación web para la gestión de turnos orientada a profesionales de la salud mental.

Proyecto full stack en desarrollo enfocado en experiencia de usuario, lógica de negocio y arquitectura cliente-servidor.

---

## Funcionalidades

- Gestión de pacientes
- Agenda semanal
- Control de solapamiento de turnos
- Estados de sesión
- Recordatorios automáticos

---

## Tecnologías

- React + Vite
- Python + Flask
- SQLAlchemy
- JWT

---

## Detalles técnicos
## Recordatorios automáticos

La app ya permite configurar recordatorios automáticos desde `Mi Perfil`.

### Variables necesarias

En [backend/.env.example](/workspaces/psico-agenda-app/backend/.env.example) quedaron estas variables:

```env
APP_TIMEZONE=America/Montevideo
BACKEND_BASE_URL=http://127.0.0.1:5000
REMINDER_JOB_KEY=your-reminder-job-key
```

- `APP_TIMEZONE`: zona horaria real de uso de la agenda. Para Uruguay, `America/Montevideo`.
- `BACKEND_BASE_URL`: URL pública o interna donde responde el backend.
- `REMINDER_JOB_KEY`: clave simple para proteger el endpoint que dispara los recordatorios.

### Ejecutarlo manualmente

Desde `backend`:

```bash
./run_automatic_reminders.sh
```

Ese script hace un `POST` a `/notifications/run-automatic-reminders` con la clave `X-Reminder-Key`.

### Dejarlo automático

La forma más simple es correr el script cada 15 minutos con `cron`:

```cron
*/15 * * * * cd /workspaces/psico-agenda-app/backend && /bin/bash ./run_automatic_reminders.sh >> /tmp/psico-agenda-reminders.log 2>&1
```

Así la app revisa qué turnos tienen que ser recordados en esa ventana y evita duplicados.
