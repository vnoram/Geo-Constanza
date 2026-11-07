# 2FA por correo en Docker local

En la raíz de esta copia de trabajo, conserva el `.env` del proyecto Docker local.
Si reutilizas su volumen de PostgreSQL, conserva la misma contraseña local. Ajusta estas
dos líneas en el `.env` de la raíz:

```dotenv
TWO_FACTOR_METHOD=email
REQUIRE_2FA=true
```

Docker Compose configura SMTP para la API con `SMTP_HOST=mailpit`, `SMTP_PORT=1025`
y `MAIL_FROM=Geo Constanza <no-responder@geo-constanza.local>`.
Si ejecutas la API directamente en el equipo, usa `SMTP_HOST=localhost`, puerto `1025`
y el mismo remitente en el `backend/.env` local.

Desde la raíz de esta rama:

```powershell
docker compose up --build -d api web mailpit
```

Este comando levanta las dependencias locales y actualiza la API y el montaje del
frontend. Si Compose ya reutiliza el contenedor de la API, fuerza su recreación con
`docker compose up --build -d --force-recreate api`. Usa una cuenta activa de
supervisor o administrador del entorno local con correo registrado. Abre
[Geo Constanza](http://localhost:5173), ingresa el RUT y la contraseña y abre
[Mailpit](http://localhost:8025) para leer el mensaje e ingresar los seis dígitos.
Tras 60 segundos se puede pedir otro código, hasta tres reenvíos. Usa el último
código recibido. Los reenvíos conservan el vencimiento original de diez minutos
y el límite de cinco intentos. Para volver al modo habitual, cambia el valor a
`TWO_FACTOR_METHOD=totp` y recrea la API.

Mailpit atrapa el correo enviado a su SMTP local. Para enviar mediante Gmail
real, el dueño de la cuenta debe crear una contraseña de aplicación y configurar
el SMTP de Gmail con su cuenta, esa contraseña y un remitente autorizado.
Guarda las credenciales fuera de Git.

Sin `REDIS_URL`, los desafíos de correo se conservan en memoria hasta vencer.
Este modo requiere una sola réplica y pierde los desafíos pendientes al reiniciar.
Con varias réplicas se necesita Redis. Si Redis está configurado y falla, el flujo
devuelve HTTP 503.
