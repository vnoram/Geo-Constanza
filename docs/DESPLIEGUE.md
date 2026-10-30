# Despliegue en Azure

Esta guía resume lo que el código necesita; no asume un servicio concreto de Azure (App Service, Container Apps u otro).

## Backend
- Imagen: `backend/Dockerfile` (Node 22). Al iniciar ejecuta `npx prisma migrate deploy` y luego `node src/server.js`.
  **Las migraciones pendientes se aplican solas al desplegar**: respalda la base antes de la primera versión que incluya migraciones nuevas.
- Puerto: variable `PORT` (por defecto 3005). Detrás de un proxy inverso (`trust proxy` = 1).
- Salud: `GET /api/v1/health` (el Dockerfile ya trae `HEALTHCHECK`).
- WebSocket (Socket.IO): el servicio debe permitir WebSockets y, si hay más de una instancia, afinidad de sesión o `REDIS_URL` compartido para el límite de peticiones y el bloqueo de intentos.

## Variables de entorno (backend)
| Variable | Obligatoria | Uso |
|---|---|---|
| `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL` | Sí (el servidor no inicia sin ellas) | Base de datos, firma de tokens, origen permitido por CORS y sockets, base de los enlaces de correo |
| `NODE_ENV=production` | Sí | Activa CORS estricto, SSL de base de datos y 2FA por defecto |
| `TWO_FACTOR_ENCRYPTION_KEY` | Sí si hay 2FA | Cifra los secretos TOTP. Perderla obliga a reiniciar el 2FA de todos |
| `REQUIRE_2FA` | No | `true`/`false`; por defecto activo solo en producción (supervisor y administrador) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Para el reset de contraseña | Sin ellas, en producción el correo no se envía y queda un error en el log |
| `REDIS_URL` | Recomendada | Bloqueo por intentos, cierre de sesión efectivo, revocación al cambiar contraseña, límites compartidos |
| `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER_NAME` | Para fotos de novedades | Azure Blob Storage |
| `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` | Para notificaciones push | Sin ellas se omiten |
| `DATABASE_SSL`, `DATABASE_SSL_CA` | No | `require` (defecto en producción) o `verify` con CA |
| `PUBLIC_API_URL` | No | Lista la URL pública en `/api-docs` |
| `JWT_ACCESS_EXPIRY_*`, `JWT_REFRESH_EXPIRY`, `RATE_LIMIT_PUBLIC`, `MAX_HORAS_SEMANALES` | No | Ajustes con valores por defecto |

## Frontend
- `npm run build` en `frontend/` genera `dist/`. Defina `VITE_API_URL` al compilar (ver `frontend/.env.example`).
- Es una aplicación de una sola página: todas las rutas deben reescribirse a `index.html` (`frontend/vercel.json` lo hacía en el hosting anterior; el hosting actual necesita su propia regla equivalente).

## Verificación posterior al despliegue
1. `GET /api/v1/health` responde `{"status":"ok"}`.
2. Inicio de sesión de un guardia y de un supervisor (este último debe pedir enrolamiento 2FA la primera vez).
3. Solicitar un restablecimiento de contraseña y comprobar que llega el correo.
4. Registrar una novedad con foto y comprobar que el supervisor la ve en tiempo real.
