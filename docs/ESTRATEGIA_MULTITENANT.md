# Estrategia de evolución a multi-tenant (SaaS B2B)

Estado actual: el prototipo atiende a **una sola empresa**. El modelo de datos no tiene el concepto de empresa. Este documento define cómo pasar a varias empresas sin mezclar sus datos. **No está implementado**; se prioriza después de la defensa para no arriesgar el despliegue.

## Modelo objetivo

- **Empresa (tenant):** cliente que contrata el servicio. Tiene sus instalaciones, usuarios, turnos y novedades.
- **Administrador de plataforma:** dueño del SaaS. Da de alta empresas y crea el primer administrador de cada una. No ve datos operativos.
- **Administrador de empresa:** el rol `admin` actual, limitado a su empresa. Crea sus usuarios por invitación.
- Los demás roles (`supervisor`, `central`, `pauta`, `libre`) quedan acotados a su empresa.
- No hay registro público: las cuentas se crean por invitación (ver ADR 0007).

## Cambios en la base de datos

1. Tabla `Empresa` (`id`, `nombre`, `rut`, `estado`, `created_at`).
2. Columna `empresa_id` en `Usuario`, `Instalacion`, `Turno`, `Asistencia`, `Novedad`, `Solicitud` y `Auditoria`, con índice. `NovedadHistorial` y `PasswordReset` se derivan por su relación.
3. Unicidad por empresa donde corresponda. Hoy `rut` y `email` son únicos globales; un mismo guardia podría trabajar para dos empresas, decisión pendiente.
4. El folio de novedad (`numero`) pasa de correlativo global a correlativo por empresa.

## Aislamiento de datos (lo que no puede fallar)

- El `empresa_id` viaja en el token de sesión y se toma **solo del token**, nunca del cuerpo ni de la URL.
- Un único punto de filtrado: una extensión de Prisma que agrega `empresa_id` a toda consulta de los modelos con tenant, para que ninguna consulta pueda olvidarlo.
- Defensa adicional en la base: *row level security* de PostgreSQL por `empresa_id`, como segunda barrera si el filtro de aplicación fallara.
- Pruebas de aislamiento: con dos empresas de prueba, comprobar por cada endpoint que una no ve, edita ni lista datos de la otra (incluidos reportes, auditoría, sockets y exportaciones).
- Sockets: las salas pasan a `empresa:<id>:central` y `empresa:<id>:instalacion:<id>`.

## Migración de los datos existentes

1. Crear la empresa actual y asignarle todas las filas existentes (`empresa_id` nulo, luego completado y obligatorio). Migración en tres pasos: agregar columna, rellenar, marcar `NOT NULL`.
2. Respaldo de la base antes de cada paso y verificación de conteos después.

## Orden de trabajo propuesto

1. Modelo y migración con una sola empresa (sin cambio visible).
2. Token y filtro central (extensión de Prisma) más pruebas de aislamiento.
3. Administrador de plataforma y alta de empresas.
4. Row level security.
5. Facturación y planes (fuera de este alcance).

## Riesgos

- Una consulta sin filtro filtra datos entre empresas: mitigado con el filtro central, RLS y pruebas por endpoint.
- Rendimiento: índices por `empresa_id` y medición con el procedimiento de `docs/PRUEBAS_RENDIMIENTO.md`.
