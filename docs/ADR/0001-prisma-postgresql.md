# ADR 0001 — Prisma y PostgreSQL

**Estado:** implementada; verificada exclusivamente en PostgreSQL Docker local.

## Contexto

Usuarios, instalaciones, turnos, solicitudes y novedades requieren relaciones, restricciones de unicidad y cambios coherentes. Un cierre no puede guardarse sin su historial ni una cobertura aprobarse sin asignar el turno.

## Decisión

Usar PostgreSQL con Prisma y el adaptador `pg`. Mantener servicios Node/Express en JavaScript CommonJS. Toda evolución de esquema genera una migración nueva mediante `npx prisma migrate dev --name <nombre>` contra la base Docker local; no se modifican migraciones ya publicadas.

Las novedades guardan estado e historial en una transacción con actualización condicional. La aprobación de cobertura usa aislamiento `Serializable`; conflictos concurrentes se informan como 409. PostgreSQL asigna `Novedad.numero` por secuencia y garantiza su unicidad. El folio se calcula al serializar.

## Alternativas y consecuencias

- Consultas SQL directas ofrecerían control total, pero duplicarían validaciones y mapeos entre servicios.
- Persistencia documental haría menos directas las relaciones y garantías transaccionales requeridas aquí.
- Prisma no reemplaza permisos, validación de dominio ni control de concurrencia. Los errores esperados se traducen a respuestas HTTP.
- Migrar y generar el cliente son pasos distintos. Las pruebas usan un esquema real; no prueban producción.

## Evidencia

`backend/prisma/schema.prisma`, `backend/prisma/migrations/`, `backend/src/config/database.js`, `backend/src/services/novedades.service.js`, `backend/src/services/cobertura.service.js` y la suite `novedades.test.js` (rollback y cierres concurrentes).
