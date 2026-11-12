# Probar Geo Constanza en local con Docker

Levanta todo en tu PC (base de datos, Redis, API, frontend y una bandeja de correo falsa) para probar a mano antes de desplegar. No toca Azure ni Vercel.

## Requisitos
- Docker Desktop abierto.
- Git y Node (solo para generar los secretos).

## Camino rapido (Windows)
Desde la raiz del repo, con Docker Desktop abierto:
`powershell -ExecutionPolicy Bypass -File scripts\local-up.ps1`
Crea el `.env` con secretos aleatorios, levanta todo, espera la API y carga los datos demo. Con `-Con2FA` activa el 2FA para probarlo.

## Uso diario (doble clic)
Después de la primera vez no necesitas `local-up.ps1`: abre Docker Desktop y haz doble clic en `scripts\iniciar-local.bat` (prende y abre la app) o `scripts\detener-local.bat` (apaga y conserva los datos).

## Paso a paso manual
1. Clona y entra a la rama:
   `git clone https://github.com/vnoram/Geo-Constanza.git && cd Geo-Constanza && git checkout chore/docker-local`
2. Crea el archivo de secretos locales:
   `cp .env.docker.example .env` y completa `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` y `POSTGRES_PASSWORD`
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
| PostgreSQL | localhost:5434, usuario `geo`, base `geo_local` |

## Probar el 2FA
Por defecto va desactivado en local. Para probarlo, en `.env` pon `TWO_FACTOR_ENCRYPTION_KEY` (otra clave generada igual) y `REQUIRE_2FA=true`, y reinicia la API: `docker compose up -d api`.
Entra como supervisor o admin: la app te lleva a enrolar con el QR (Google Authenticator) y te muestra los códigos de recuperación.

## Probar recuperar contraseña
En el login, "¿Olvidaste tu contraseña?", pon un correo del seed y abre http://localhost:8025: ahí llega el enlace.

## Android virtual (opcional)
Un Galaxy S10 virtual (imagen `budtmo/docker-android`) para ver la web local como en un celular. No arranca con `docker compose up`: usa el perfil `android`.

**Requisitos (Windows 11 + WSL2/Docker Desktop, una sola vez)**
- Virtualización activada en la BIOS (SVM en AMD / VT-x en Intel).
- Característica de Windows **Plataforma del hipervisor** habilitada (PowerShell como administrador): `Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -NoRestart` y reiniciar.
- `%USERPROFILE%\.wslconfig` con `[wsl2]` y `nestedVirtualization=true` (luego `wsl --shutdown`).

**Uso**
1. `docker compose up -d` (proyecto normal) y luego `docker compose --profile android up -d`.
2. Abre http://localhost:6080, pulsa **Conectar** y espera a que Android termine de arrancar (varios minutos la primera vez; la imagen pesa varios GB).
3. En Chrome del emulador entra a **http://localhost:5173** (no `10.0.2.2`: dentro del emulador esa dirección apunta al contenedor del emulador, no a tu PC).
4. Para apagarlo: `docker compose --profile android down` (no borra la base).

**Cómo funciona**
- `android-kvm` carga el módulo `kvm_amd`/`kvm_intel` en el kernel de WSL (el módulo se pierde al reiniciar WSL/PC; por eso se carga en cada arranque del perfil) y termina.
- `android` es el emulador.
- `android-bridge` comparte su red: reenvía los puertos 5173 y 3005 hacia `web` y `api` (socat) y ejecuta `adb reverse` cuando Android ya arrancó, para que `localhost:5173` y `localhost:3005` dentro del teléfono lleguen a la app y a la API.

**Si no hay /dev/kvm** (`android-kvm` muestra el aviso en sus logs: `docker compose --profile android logs android-kvm`): carga el módulo a mano y repite el paso 1:
`wsl -d docker-desktop -u root -e modprobe kvm_amd`

Consume bastante RAM y CPU: apágalo cuando no lo uses.

## Notas
- Todos los puertos quedan abiertos solo en tu PC (127.0.0.1). Si el puerto 5434 u otro está ocupado, cámbialo en `docker-compose.yml`.
- Usuarios del seed: el login es con RUT y contraseña `geo2026` (solo datos de demostración locales).
- Las fotos de reportes usan Azure Blob Storage; en local las atiende el emulador Azurite (servicio `azurite`, puerto 127.0.0.1:10000). El servicio `azurite-init` crea el contenedor `reportes` y termina; que figure como "Exited (0)" es normal.
- Para empezar de cero: `docker compose down -v` (borra la base local).
- El panel de credenciales demo se muestra en el login porque `VITE_MOSTRAR_DEMO=true` solo en este compose.
