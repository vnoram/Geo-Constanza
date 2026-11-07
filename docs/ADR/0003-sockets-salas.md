# ADR 0003 — Socket.IO con salas por instalación y rol

**Estado:** implementada y verificada con clientes WebSocket reales dentro de Docker; identidad y datos simulados en esas pruebas.

## Contexto

Las emisiones globales podían divulgar novedades o ubicación de una instalación a guardias ajenos. Una sala solicitada por el cliente no constituye autorización.

## Decisión

Autenticar el handshake con `auth.token`. El servidor verifica JWT, blacklist disponible y usuario activo cuyo rol coincide con el token. Calcula las salas permitidas desde la base:

- Supervisor: instalaciones resueltas por `resolverInstalacionesSupervisor` (asignaciones, comunas y fallback existente).
- GGSS: instalación base y turnos del día, incluidos nocturnos de ayer que continúan.
- Central y administrador: salas `central` y `admin`, respectivamente; acceso global autorizado a instalaciones.

Un `join:instalacion` solo se acepta para instalaciones permitidas o un rol global. El cliente no puede autoconcederse una sala de rol.

| Evento | Destino |
|---|---|
| `novedad:nueva`, `novedad:asignada`, `novedad:escalada` | `instalacion:<id>` |
| `alerta_critica_central` | `central` |
| `admin:dashboard_update` en novedades/asistencia | `admin` y `central` |
| `guardia:ubicacion` en asistencia | instalación correspondiente, `admin` y `central` |

## Alternativas y consecuencias

- Emitir globalmente y filtrar en React no protege la información ya enviada; se descarta.
- Consultas periódicas evitan sesiones persistentes, pero aumentan latencia y carga.
- Los clientes deben enviar el token y reconectar para refrescar la autorización. Las salas son una autorización de conexión, no reemplazan permisos HTTP.
- Las salas por instalación permiten que sus miembros vean esos eventos; cambiar esa política requiere una decisión explícita de permisos.

## Evidencia

`backend/src/constants/salas.js`, `backend/src/socket/socketManager.js`, servicios de novedades/asistencia y `backend/src/socket/__tests__/socketManager.test.js`.
