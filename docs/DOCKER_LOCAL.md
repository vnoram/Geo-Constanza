# Probar Geo Constanza en local con Docker

Levanta todo en tu PC (base de datos, Redis, API, frontend y una bandeja de correo falsa) para probar a mano antes de desplegar. No toca Azure ni Vercel.

## Requisitos
- Docker Desktop abierto.
- Git y Node (solo para generar los secretos).

## Primera vez
1. Clona y entra a la rama:
   `git clone https://github.com/vnoram/Geo-Constanza.git && cd Geo-Constanza && git checkout chore/docker-local`
2. Crea el archivo de secretos locales:
   `cp .env.docker.example .env` y completa `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`
   (genera cada uno con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
3. Levanta todo: `docker compose up --build`
   La API aplica las migraciones sola al arrancar. El frontend tarda un poco la primera vez (instala dependencias).
4. En otra terminal, carga los datos de demostración (borra y recrea usuarios, turnos, etc. **de la base local**):
   `docker compose exec api node prisma/seed.js`

## Direcciones
| Qué | URL |
|---|---|
| App (frontend) | http://localhost:5173 |
| API | http://localhost:3005/api/v1/health |
| Correos enviados (recuperar contraseña) | http://localhost:8025 |
| PostgreSQL | localhost:5433, usuario `geo`, base `geo_local` |

## Probar el 2FA
Por defecto va desactivado en local. Para probarlo, en `.env` pon `TWO_FACTOR_ENCRYPTION_KEY` (otra clave generada igual) y `REQUIRE_2FA=true`, y reinicia la API: `docker compose up -d api`.
Entra como supervisor o admin: la app te lleva a enrolar con el QR (Google Authenticator) y te muestra los códigos de recuperación.

## Probar recuperar contraseña
En el login, "¿Olvidaste tu contraseña?", pon un correo del seed y abre http://localhost:8025: ahí llega el enlace.

## Notas
- Las fotos de reportes usan Azure Blob Storage. Sin cadena de conexión en local, subir fotos no funciona (el resto sí).
- Para empezar de cero: `docker compose down -v` (borra la base local).
- El panel de credenciales demo se muestra en el login porque `VITE_MOSTRAR_DEMO=true` solo en este compose.
