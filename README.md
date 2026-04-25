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

- Frontend: React + Vite (JavaScript)
- Backend: Python + Flask
- Base de datos: SQLite / SQLAlchemy
- Autenticación: JWT

---
<img width="1707" height="921" alt="3 turno" src="https://github.com/user-attachments/assets/817f3773-c237-418d-8bf9-eccdf02a1e0e" />

---

<img width="1707" height="921" alt="2 inicio" src="https://github.com/user-attachments/assets/3fd6f226-691a-4481-88b3-f71115ef5256" />

---


<img width="1707" height="921" alt="1 login" src="https://github.com/user-attachments/assets/77dbd487-12f7-42fe-9baf-42953e163f30" />




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
