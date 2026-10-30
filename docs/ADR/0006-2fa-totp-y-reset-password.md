# ADR 0006 — 2FA TOTP y restablecer contraseña

**Estado:** implementado en las ramas `feat/AB44-2fa-totp` (AB#44) y `feat/AB41-reset-password` (AB#41); sin fusionar a `main`.

## Contexto

El ADR 0002 dejó el segundo factor como simulación (`verify2FA` respondía 501, el frontend aceptaba `123456`) y el reset de contraseña como stub. Supervisor y administrador tienen acceso privilegiado.

## Decisión: 2FA

- TOTP (RFC 6238, `otplib`, ventana ±1 paso) solo para **supervisor y administrador**. Incluir a central/GGSS requiere decisión del responsable.
- Secreto cifrado en base con AES-256-GCM (`TWO_FACTOR_ENCRYPTION_KEY`); nunca sale por la API.
- El login de una cuenta enrolada devuelve un `tempToken` (5 min) firmado con otra clave y con `tipo: 2fa_pending`; `authenticate` lo rechaza como sesión.
- Un mismo código TOTP no se acepta dos veces (`two_factor_ultimo_paso`, actualización condicional).
- 8 códigos de recuperación de un solo uso, guardados como hash SHA-256 y mostrados una vez.
- Máximo 5 intentos erróneos, bloqueo de 15 minutos (Redis, con memoria como respaldo).
- Cuentas sin enrolar no quedan fuera: entran con `mustEnroll2FA` y el frontend fuerza el enrolamiento (QR + códigos). El administrador puede reiniciar el 2FA de otro usuario; hay un script de emergencia por RUT. Ambos se auditan.
- `REQUIRE_2FA`: por defecto activo solo con `NODE_ENV=production`, para no frenar el desarrollo local.

## Decisión: reset de contraseña

- Token aleatorio de 32 bytes, vigencia 30 minutos, un solo uso; en base solo su hash SHA-256 (`PasswordReset`).
- La solicitud responde siempre igual; límites de 3/hora por correo y 10/hora por IP.
- Al confirmar: contraseña 10–128 caracteres y distinta de la actual, consumo atómico del token, anulación de otros tokens pendientes y revocación de sesiones (`password_cambiada_en` invalida refresh tokens; con Redis, `pwd_changed:<id>` invalida access tokens). Sin Redis, los access tokens vigentes expiran por su duración natural (30 min a 4 h).
- Correo por SMTP genérico (`nodemailer`, `enviarCorreo(destino, asunto, html)`), sin acoplarse a un proveedor. Sin SMTP: en desarrollo el enlace se imprime en consola; en producción se registra el error y no se envía.

## Consecuencias y pendientes

- Antes de desplegar: definir `TWO_FACTOR_ENCRYPTION_KEY` y las variables SMTP en el entorno; perder la clave de cifrado obliga a reiniciar el 2FA de todos.
- No verificado: envío real de correo y escaneo con una app authenticator real (se probó con códigos generados por la misma librería).
- Las migraciones `20261030140000_segundo_factor_totp` y `20261030150000_reset_password` solo agregan columnas/tabla.

## Evidencia

`backend/src/services/twoFactor.service.js`, `passwordReset.service.js`, `correo.service.js`, `utils/cifrado.js` y sus suites en `__tests__` (las de BD requieren `RUN_LOCAL_DB_TESTS=1`).
