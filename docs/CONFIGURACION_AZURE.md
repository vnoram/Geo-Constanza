# Variables de entorno en Azure Container Apps: 2FA, correo y push

Estado del código al 23 de noviembre de 2026 (rama `feat/cierre-pendientes-defensa`). Todo se lee de variables de entorno; no hay credenciales en el repositorio. Los secretos van en *Secretos* del Container App y se referencian desde *Variables de entorno*.

## 1. Qué está implementado y qué no

| Función | Backend | Variables | Observación |
|---|---|---|---|
| 2FA TOTP (supervisor y administrador) | Implementado (`twoFactor.service.js`, `utils/cifrado.js`) | `TWO_FACTOR_ENCRYPTION_KEY`, `REQUIRE_2FA`, `TWO_FACTOR_ISSUER` | Sin la clave de cifrado el 2FA **se desactiva solo** (queda un error en el log) para no bloquear el acceso. |
| 2FA por correo (opcional) | Implementado (`twoFactorEmail.service.js`) | `TWO_FACTOR_METHOD=email` + SMTP | Por defecto es `totp`. |
| Correo (restablecer contraseña, invitaciones, 2FA por correo) | Implementado (`correo.service.js`, SMTP genérico con nodemailer) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | En producción, sin `SMTP_HOST` y `MAIL_FROM` el correo **no sale** y solo se registra el error. |
| Push (Firebase Cloud Messaging) | Envío implementado (`notificacion.service.js`, `config/firebase.js`) | `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` | **Falta el lado cliente:** el frontend no incluye Firebase ni llama a `PUT /usuarios/me/token-dispositivo`, así que ningún usuario tiene `fcm_token` y el push no llega a nadie. Solo serviría con una app móvil que registre el token. |

## 2. Lista de variables para configurar

| Variable | Tipo | Obligatoria | Valor / cómo generarla |
|---|---|---|---|
| `TWO_FACTOR_ENCRYPTION_KEY` | Secreto | Sí, para 2FA | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Guardar copia segura: si se pierde hay que reiniciar el 2FA de todos. |
| `REQUIRE_2FA` | Variable | No | Por defecto es `true` en producción. Poner `false` solo para desactivarlo a propósito. |
| `TWO_FACTOR_ISSUER` | Variable | No | Nombre que ve la app autenticadora (por defecto `Geo Constanza`). |
| `TWO_FACTOR_METHOD` | Variable | No | `totp` (por defecto) o `email`. |
| `SMTP_HOST` | Variable | Sí, para correo | Servidor del proveedor (Gmail, Resend, SendGrid, etc.). |
| `SMTP_PORT` | Variable | No | 587 por defecto (465 usa TLS directo). |
| `SMTP_USER`, `SMTP_PASS` | Variable / Secreto | Según proveedor | `SMTP_PASS` va como secreto. |
| `MAIL_FROM` | Variable | Sí, para correo | Remitente, por ejemplo `Geo Constanza <no-responder@tudominio.cl>`. |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` | Variable | Para push | De la cuenta de servicio de Firebase. |
| `FIREBASE_PRIVATE_KEY` | Secreto | Para push | Clave privada de la cuenta de servicio. Los saltos de línea pueden ir como `\n` literales; el código los convierte. |
| `DEVICE_POLICY` | Variable | Para HU-15 | `on` activa dispositivos corporativos y la revisión de marcajes fuera de geocerca. **Leer el plan de despliegue antes de activarla.** |
| `FRONTEND_URL`, `CORS_ORIGIN` | Variable | Sí | Ya existen en Azure (dominio de Vercel). El enlace de los correos usa `FRONTEND_URL`. |

Ejemplo con la CLI (sustituye los nombres; los valores los pones tú, nunca en el repositorio):

```bash
az containerapp secret set -n ca-geo-api -g rg-geo-constanza \
  --secrets two-factor-key=<valor> smtp-pass=<valor> firebase-key=<valor>
az containerapp update -n ca-geo-api -g rg-geo-constanza --set-env-vars \
  TWO_FACTOR_ENCRYPTION_KEY=secretref:two-factor-key SMTP_PASS=secretref:smtp-pass \
  FIREBASE_PRIVATE_KEY=secretref:firebase-key SMTP_HOST=<host> SMTP_PORT=587 \
  SMTP_USER=<usuario> MAIL_FROM="Geo Constanza <no-responder@tudominio.cl>" \
  FIREBASE_PROJECT_ID=<id> FIREBASE_CLIENT_EMAIL=<correo-cuenta-servicio>
```

Cada `update` crea una revisión nueva; la anterior queda disponible para volver atrás.

## 3. Cómo probar que quedó bien

El script `backend/scripts/verificar-config.js` revisa las variables, prueba el cifrado del 2FA, se conecta al SMTP y comprueba las credenciales de Firebase. **Nunca imprime valores secretos**; termina con código 1 si algo falta o falla.

```bash
# En Azure (dentro del contenedor)
az containerapp exec -n ca-geo-api -g rg-geo-constanza --command "node scripts/verificar-config.js"
# Correo de prueba real y push a un token concreto
node scripts/verificar-config.js --enviar-a tu@correo.cl --token-fcm <token>
# Solo variables, sin conectarse a nada
node scripts/verificar-config.js --omitir-red
# En local con Docker
docker compose exec api node scripts/verificar-config.js
```

Comprobaciones manuales después:

1. **2FA:** iniciar sesión como administrador; debe pedir enrolar el 2FA (QR) y entregar códigos de recuperación. Guardarlos.
2. **Correo:** "Olvidé mi contraseña" con un usuario real; debe llegar el enlace. Si no llega, revisar el registro del contenedor (`Fallo al enviar correo`).
3. **Push:** hoy no hay forma de probarlo de punta a punta desde la web (ver sección 1). El script confirma solo que Firebase acepta las credenciales.

## 4. Riesgos

- Activar `REQUIRE_2FA` con la clave puesta obliga a supervisores y administradores a enrolar su 2FA en el siguiente inicio de sesión. Enrolar primero al administrador y guardar los códigos de recuperación. Si el único administrador queda bloqueado: `node scripts/desactivar-2fa.js <rut>` dentro del contenedor, o `REQUIRE_2FA=false` en una revisión nueva.
- Sin Redis (no está desplegado) los intentos fallidos de 2FA se cuentan en la memoria del proceso: se reinician al reiniciar la réplica y no se comparten entre réplicas.
- El 2FA por correo necesita SMTP funcionando; con SMTP caído nadie con ese método puede entrar.
