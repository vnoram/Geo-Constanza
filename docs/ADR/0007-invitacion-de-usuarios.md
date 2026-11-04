# ADR 0007 — Invitación de usuarios (sin contraseñas repartidas)

**Estado:** implementado en `feat/AB-invitacion-usuarios`; sin fusionar a `main`.

## Contexto

El administrador creaba cada cuenta escribiendo una contraseña inicial, que luego debía comunicar a la persona. En un SaaS B2B las claves no se reparten y no hay registro público abierto.

## Decisión

- Al crear un usuario **sin contraseña**, el sistema guarda una clave aleatoria que nadie conoce y envía un correo con un enlace de un solo uso, vigente 72 horas, para que la persona elija la suya. Reutiliza el mecanismo de restablecer contraseña (token aleatorio, solo se guarda su hash, un solo uso).
- Crear con contraseña sigue funcionando (por ejemplo, para cuentas de demostración).
- Si el correo no sale, el usuario igual queda creado y la respuesta indica `invitacion_enviada: false`; se puede reenviar con «Olvidé mi contraseña».
- La auditoría deja de guardar la contraseña recibida al crear o editar usuarios.

## Consecuencias

- Requiere SMTP configurado en producción (en desarrollo el enlace se imprime o llega a Mailpit).
- Pendiente: cambio obligatorio de contraseña si el administrador sí puso una inicial, y reenvío de invitación desde el panel.
- Camino a multi-tenant: ver `docs/ESTRATEGIA_MULTITENANT.md`.
