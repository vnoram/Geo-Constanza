# Decisiones de arquitectura

Estos registros describen el código de las ramas apiladas del Sprint 5; no certifican un despliegue. Cada PR depende del anterior y apunta a `main`. No se han fusionado ni aplicado cambios en producción.

| ADR | Decisión | Estado |
|---|---|---|
| [0001](0001-prisma-postgresql.md) | Prisma y PostgreSQL | Implementada y probada en Docker |
| [0002](0002-jwt-2fa.md) | JWT y segundo factor | JWT implementado; TOTP pendiente |
| [0003](0003-sockets-salas.md) | Socket.IO con salas autorizadas | Implementada y probada con clientes locales |
| [0004](0004-azure-evidencia.md) | Evidencia privada en Azure Blob y URLs firmadas | Implementada; proveedor externo simulado en pruebas |
| [0005](0005-hora-chile.md) | Calendario operacional en hora de Chile | Implementada y probada con cambios horarios |

Consultar [API](../API.md), [historias de usuario](../HISTORIAS_DE_USUARIO.md) y el [mini informe con fuentes normativas](../INFORME_SPRINT5.md). Por instrucción del responsable se adopta la base nacional ordinaria de 42 horas, con reducción a 40 desde el 26-04-2028, sin habilitar regímenes excepcionales por configuración.
