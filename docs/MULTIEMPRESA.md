# Multiempresa — Etapa 1 (aislamiento por empresa + rol de plataforma)

Estado: implementado en la rama `feat/multiempresa-etapa1` (sin merge ni despliegue). La estrategia general está en [ESTRATEGIA_MULTITENANT.md](ESTRATEGIA_MULTITENANT.md); este documento describe lo que **realmente quedó construido**, cómo funciona y qué limitaciones tiene.

## 1. Qué cambió

- **Entidad `Empresa`** (`id`, `nombre`, `rut` único, `estado` activa/suspendida, `plan`, `ultimo_folio`, fechas).
- **`empresa_id`** en `Usuario` (nulo solo para el super admin), `Instalacion`, `Supervisor_Instalacion`, `Turno`, `Asistencia`, `Novedad`, `NovedadHistorial`, `Solicitud` y `Auditoria` (nulo en eventos de plataforma). `PasswordReset` se aísla por su usuario.
- **Rol `super_admin`** ("Plataforma"): sin empresa. Solo puede listar, crear, editar y activar/suspender empresas y crear el primer administrador de cada una. Todas las rutas operativas le responden 403.
- **La empresa sale siempre del token** (`empresaId` en el JWT firmado). Nunca del cuerpo, la URL ni un header. Una empresa suspendida no inicia sesión y sus tokens vigentes dejan de servir al instante (403).
- **Id ajeno → 404**, nunca 403 ni lista vacía: no se revela si el recurso existe en otra empresa.
- **Sockets y push por empresa**: salas `empresa:<id>`, `central:<id>`, `admin:<id>`; el handshake rechaza super admin, empresa suspendida y token con empresa distinta a la real.
- **Frontend**: el super admin entra a una consola con una sola pantalla, **Empresas** (tabla, crear/editar, suspender/reactivar, crear primer admin). El admin de empresa conserva "Administración / RRHH" y ve el nombre de su empresa en el menú.
- **Seed**: super admin + 2 empresas demo (Alfa y Beta), cada una con admin, supervisor, guardia e instalación.

## 2. Cómo se garantiza el aislamiento (3 capas)

1. **Contexto de empresa** (`config/tenant.js`, `AsyncLocalStorage`): `authenticate` valida el token, comprueba contra la base que `empresaId` del token es la empresa real del usuario y que está activa, y abre el contexto para el resto de la petición.
2. **Extensión de Prisma** (`config/database.js` + `config/tenantScope.js`, función pura y probada): cada consulta a un modelo con empresa se reescribe sola.
   - Lecturas, `updateMany`, `deleteMany`, `count`, `aggregate`, `groupBy`: `AND empresa_id = <contexto>`.
   - `findUnique`, `update`, `delete`: el `where` único recibe `empresa_id` (un id ajeno "no existe": `null` o P2025 → 404).
   - `create`, `createMany`, `upsert`: se fuerza la empresa del contexto; pedir otra → 403 `EMPRESA_AJENA`. `update` descarta cualquier intento de cambiar `empresa_id`.
   - **Falla cerrado**: sin contexto de empresa lanza `SIN_CONTEXTO_EMPRESA`. Una operación desconocida de un modelo con empresa también se rechaza.
   - `prismaGlobal` (sin alcance) existe solo para lo que ocurre antes de tener contexto (login, refresh, 2FA, restablecer contraseña, `authenticate`, handshake de sockets, auditoría, módulo de plataforma, seed y scripts). Cada uso es explícito y revisable con `grep prismaGlobal`.
3. **La base de datos misma**: claves foráneas **compuestas** `(empresa_id, id)` entre tablas de empresa (17 relaciones, `ON DELETE RESTRICT`). Aunque el código tuviera un error, Postgres rechaza (P2003 → 404) un turno con instalación o guardia de otra empresa. Más `CHECK (rol = 'super_admin') = (empresa_id IS NULL)` en `Usuario`.

## 3. Unicidades (justificadas)

| Campo | Alcance | Por qué |
|---|---|---|
| `Novedad.numero` (folio) | `UNIQUE(empresa_id, numero)` | Cada empresa lleva su correlativo `NOV-AAAA-00001`. |
| `Usuario.rut` | **Global** | Es el identificador de login (el login no pide empresa). Ver limitación 1. |
| `Usuario.email` | **Global** | Lo usan "restablecer contraseña" y la invitación; debe identificar a una sola cuenta. |
| `Empresa.rut` | Global | Una empresa es un RUT. |

**Folio atómico**: `Empresa.ultimo_folio` se incrementa con `UPDATE … SET ultimo_folio = ultimo_folio + 1 RETURNING` **dentro de la misma transacción** que crea la novedad. El `UPDATE` bloquea la fila de la empresa hasta el commit: dos novedades simultáneas nunca repiten ni se saltan folio, y si la transacción falla el contador se revierte (sin huecos). La secuencia global anterior se eliminó. Probado con 8 transacciones concurrentes y con A y B a la vez.

## 4. Migraciones (aditivas y en dos pasos)

| Migración | Qué hace |
|---|---|
| `20261105120000_multiempresa_aditiva` | Crea `Empresa`, agrega `empresa_id` **nullable**, crea la empresa por defecto (`00000000-0000-4000-8000-000000000001`, RUT provisorio `00000000-0`), hace backfill de **todos** los datos existentes a esa empresa, calcula `ultimo_folio` desde el máximo folio actual y crea índices. No rompe el código anterior. |
| `20261105130000_multiempresa_not_null` | **Verifica** con un bloque `DO $$` que no quede ningún `NULL` (si queda, **aborta con mensaje** y no cambia nada); luego `NOT NULL`, claves compuestas, `UNIQUE(empresa_id, numero)`, `CHECK` del super admin y elimina la secuencia de folio. |

Verificado sobre una base con datos "legado": 0 NULL tras el backfill, folios 1-2-3 conservados con `ultimo_folio = 3`, `prisma migrate diff --exit-code` = 0 (sin deriva respecto del esquema) y la migración 2 aborta cuando se introduce un NULL a propósito.

> **Antes de desplegar**: tomar respaldo de la base. La migración 2 hace incompatible al código anterior (las inserciones sin `empresa_id` fallarán). El contenedor ejecuta `prisma migrate deploy` al arrancar, así que base y código nuevos deben salir juntos.

## 5. SQL crudo (`$queryRaw` / `$executeRaw`): inventario y justificación

El SQL crudo **no pasa por la extensión de Prisma**, por eso se revisó cada uno:

| Archivo | Sentencia | ¿Toca datos de empresa? | Justificación |
|---|---|---|---|
| `routes/health.routes.js` | `SELECT 1` | No | Health check de conectividad. |
| `services/asistencia.service.js` (×2) | `pg_advisory_xact_lock(hashtext(usuario_id))` | No: solo toma un candado | Evita entradas/salidas simultáneas del mismo guardia. No lee ni escribe tablas; el `usuario_id` ya viene validado por el contexto. |
| `scripts/detectar-solapamientos.js` | `SET TRANSACTION READ ONLY` | Script de mantenimiento, cliente propio, solo lectura | Se ejecuta a mano sobre **todas** las empresas; no es código de la API. |

No hay otro SQL crudo. Si se agrega uno, debe filtrar por `empresa_id` a mano y registrarse aquí.

## 6. Código fuera de una petición HTTP (sin contexto de empresa)

- **Cron/temporizadores**: no hay ninguno que toque la base.
- **Sockets**: el handshake usa `prismaGlobal` para validar el token y fija la empresa en las salas; las consultas de los manejadores (turnos activos, `join:instalacion`) se ejecutan dentro de `conEmpresa`.
- **Push (FCM)**: se envía por `fcm_token` del usuario y solo se llama dentro de peticiones (asignar novedad, aprobar/rechazar solicitud), ya cubiertas por consultas con alcance.
- **Scripts** (`desactivar-2fa.js`, `detectar-solapamientos.js`) y **seed**: usan `prismaGlobal` a propósito y registran `empresa_id` cuando auditan.

## 7. Hallazgos que destapó la prueba con base real

Escribir la suite de aislamiento con PostgreSQL real encontró tres defectos que las pruebas unitarias no veían; los tres están corregidos y cubiertos:

1. `POST /usuarios/:id/2fa/reset` con un usuario de **otra empresa** devolvía 200 (el servicio usa `prismaGlobal`): ahora verifica antes que el usuario exista en la empresa del token (404).
2. El **super admin no podía iniciar sesión**: faltaba su vencimiento de token (`jwtConfig.expiresIn.super_admin`, 1 h por defecto).
3. `GET /asistencia/hoy/:instalacionId` y `/asistencia/historial/:usuarioId` devolvían lista vacía (200) con ids ajenos, y el supervisor recibía 403 con una instalación de otra empresa: ahora 404.

## 8. Pruebas

- **Unitarias**: 414 pasan (incluye 44 de la función de alcance, aislamiento de sockets, super admin sin acceso a 30 rutas operativas, plataforma, suspensión y token manipulado).
- **Con base real** (`RUN_LOCAL_DB_TESTS=1`, solo contra bases locales `geo_*`): `src/routes/__tests__/multiempresa.db.test.js`, 85 pruebas. La app completa con login real; el admin de A intenta **leer, editar, cancelar, resolver, escalar, asignar, aprobar, rechazar y reiniciar 2FA** sobre ids de B (y B sobre A): siempre 404 y los datos de B quedan intactos. Además: listados sin fuga (usuarios, instalaciones, turnos, novedades, solicitudes, auditoría, dashboard), referencias cruzadas al escribir, `createMany`/`upsert`/`update`/`delete` por id, `include` anidados, transacciones interactivas, `groupBy`/`aggregate`, folio concurrente, super admin, suspensión y token manipulado.
- Total con base real: 537 pruebas (todas las suites).

Comando (base local de pruebas, nunca la de producción):

```bash
cd backend
# DATABASE_URL debe apuntar a una base local cuyo nombre empiece con geo_ (la suite se niega si no)
NODE_ENV=test RUN_LOCAL_DB_TESTS=1 npx jest --coverage=false --runInBand --forceExit
```

## 9. Probar la demo en Docker local

```bash
docker compose up --build
docker compose exec api npx prisma migrate deploy
docker compose exec api node prisma/seed.js
```

(`migrate deploy` ya corre al arrancar el contenedor; el `seed` **borra y recrea** los datos locales.) Abrir http://localhost:5173 y, con la contraseña común del seed:

| Cuenta | RUT | Qué comprobar |
|---|---|---|
| Plataforma (super admin) | `10000001-6` | Solo ve la pantalla **Empresas**. Crea una empresa, suspéndela, crea su admin. Las rutas operativas le dan 403. |
| **Alfa · Admin** | `12812223-0` | Ve solo usuarios/instalaciones/turnos/novedades de **Seguridad Alfa**. **No aparece nada de Beta.** |
| Beta · Admin | `21000001-1` | Ve solo **Vigilancia Beta**, nada de Alfa. |
| Beta · Supervisor / Pauta | `21000002-K` / `21000003-8` | Igual: solo su empresa. |

Prueba de suspensión: entrar como Plataforma → **Suspender** a Beta → el admin de Beta (con sesión abierta) recibe 403 en la siguiente acción y no puede volver a entrar; Alfa sigue normal. **Reactivar** restablece el acceso.

## 10. Limitaciones y decisiones pendientes (fuera de la etapa 1)

1. **RUT y correo globales**: un mismo guardia no puede trabajar para dos empresas, y crear un usuario con el RUT de otra empresa devuelve 409, lo que **revela que ese RUT existe en la plataforma**. Aceptado en la etapa 1; la solución (login con empresa o RUT por empresa + selección al iniciar sesión) es la etapa 2.
2. **Super admin sin 2FA**: `ROLES_CON_2FA` no lo incluye. Es el rol más poderoso de la plataforma; conviene exigírselo en la etapa 2.
3. **Fotos de novedades**: un solo contenedor de Azure Blob sin prefijo por empresa. Las URL se firman por petición y el acceso pasa por la novedad (con alcance), pero conviene prefijar `empresa_id/` y separar permisos.
4. **Tokens anteriores**: los JWT emitidos antes del despliegue no traen `empresaId` y se rechazan; todos deben volver a iniciar sesión.
5. **Empresa por defecto**: los datos existentes quedan en una empresa con RUT provisorio `00000000-0`; hay que editarla desde la consola de plataforma con los datos reales.
6. **`REQUIRE_2FA` en producción**: no cambia con esta etapa, pero al crear admins nuevos conviene revisar que el segundo factor esté configurado como se espera.
7. **Sin plan/cuotas**: `plan` es solo una etiqueta; no limita usuarios ni instalaciones.
8. **Correo de invitación**: el primer admin recibe el enlace por el mismo mecanismo de restablecimiento; en local se ve en Mailpit (http://localhost:8025).
9. **Suite con base real**: usa una base local; no se ejecuta en CI (opt-in explícito).
