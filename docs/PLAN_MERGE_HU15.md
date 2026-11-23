# Plan de merge, despliegue y rollback de `feat/fuera-geocerca-autorizacion` (HU-15)

Preparado el 23 de noviembre de 2026. Este plan **no se ejecuta solo**: cada merge, despliegue y cambio de variable lo hace el responsable del proyecto. Reemplaza al plan del 2 de noviembre (`PLAN_MERGE_Y_DESPLIEGUE.md`), que hablaba de la cadena de PR #18–#42 y ya está superado.

## 1. Punto de partida (comprobado en el repositorio)

- `origin/main` está en `42a1c3f` (PR #48, 7 de noviembre). Es **ancestro** de la rama: el merge es de avance limpio, sin conflictos posibles contra main tal como está hoy.
- La rama lleva unos 100 commits y casi 200 archivos sobre main. Incluye, además de HU-15: dispositivos corporativos, invitaciones, revisión de marcajes, documentos del personal, rol único de guardia, 2FA por correo, pauta 4x4 a 6 meses, alertas reales, correcciones de interfaz y los scripts de demo/medición.
- **Migraciones nuevas respecto de main: 8**, todas posteriores al 12 de noviembre. Las migraciones multiempresa (5 de noviembre) ya están en main.
- **No pude comprobar qué corre hoy en Azure** (imagen ni migraciones aplicadas). Antes de empezar, ejecutar contra la base de producción:
  ```sql
  SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;
  ```
  Si la última no es `20261105130000_multiempresa_not_null` (o posterior), hay que revisar primero ese paso: su verificación aborta si quedan registros sin `empresa_id`.
- El contenedor aplica las migraciones al arrancar (`npx prisma migrate deploy && node src/server.js`). Cada migración corre en su propia transacción.

## 2. Las 8 migraciones y su riesgo

| Migración | Qué hace | Riesgo |
|---|---|---|
| `20261112120000_dispositivos_corporativos` | Tabla `Dispositivo` | Aditiva |
| `20261112130000_invitaciones_dispositivo` | Columnas de invitación | Aditiva |
| `20261112140000_dispositivo_instalacion_marcaje` | Instalación en dispositivo y marcaje | Aditiva |
| `20261112150000_revision_marcajes` | Columnas de revisión en `Asistencia` (+ CHECK `aprobado`/`rechazado`) | Aditiva |
| `20261112160000_solicitud_adjunto` | Adjunto en `Solicitud` | Aditiva |
| `20261112170000_documentos_personal` | Tabla `Documento` | Aditiva |
| **`20261112180000_rol_ggss_unico`** | `UPDATE "Usuario" SET rol='ggss', tipo_ggss=NULL WHERE rol IN ('pauta','libre')` | **De datos. El código anterior no reconoce el rol `ggss`: los guardias dejan de poder operar si se vuelve a la imagen vieja.** |
| `20261119130000_marcaje_explicacion_guardia` | Columna `comentario_guardia` | Aditiva |

Las aditivas no afectan al código anterior (ignora las columnas nuevas). Solo `rol_ggss_unico` condiciona el rollback: ver sección 6.

## 3. Antes de empezar (checklist)

- [ ] Respaldo de la base de producción, con fecha y nombre anotados (copia de seguridad a pedido del servidor flexible `pg-geo-constanza`, o `pg_dump`). Comprobar que se puede restaurar.
- [ ] **Ensayo sobre una copia:** restaurar ese respaldo en una base aparte (local con Docker sirve) y correr `npx prisma migrate deploy`. Confirma que las 8 migraciones pasan con los datos reales.
- [ ] Anotar el nombre de la **revisión activa** de `ca-geo-api` y el despliegue actual de Vercel (para volver a ellos).
- [ ] CI verde en la rama. Correr una vez, en local con Postgres, las **148 pruebas que hoy se saltan** (`RUN_LOCAL_DB_TESTS`); en esta rama solo se verificaron las 519 que no necesitan base.
- [ ] **Instantánea de roles** (para poder revertir `rol_ggss_unico` sin perder la distinción pauta/libre), justo antes del despliegue:
  ```sql
  CREATE TABLE _respaldo_roles_ggss AS
    SELECT id, rol, tipo_ggss FROM "Usuario" WHERE rol IN ('pauta','libre');
  ```
- [ ] Variables de la guía `docs/CONFIGURACION_AZURE.md` cargadas si se quiere 2FA, correo o push (ninguna es necesaria para HU-15).
- [ ] **No activar `DEVICE_POLICY=on` en este despliegue** (ver sección 5).

## 4. Orden de merge y despliegue

1. **Pull request de la rama hacia `main`**, con merge normal (no squash, para conservar el historial; sin force-push). Revisar el diff de `backend/prisma/migrations` una última vez.
2. **Backend primero.** Construir la imagen desde `main` y publicarla en el registro `acrgeoconstanza`; actualizar `ca-geo-api` con la imagen nueva (revisión nueva). Al arrancar corre `migrate deploy`. Las migraciones se aplican al arrancar, antes de que el servidor escuche. Si una falla, el contenedor no queda sano; en modo de revisión única Container Apps debería mantener la revisión anterior hasta que la nueva esté sana (confirmarlo en *Revisiones* durante el despliegue).
3. **Verificar el backend** (sección 7, puntos 1 a 3).
4. **Frontend inmediatamente después** (Vercel, desde `main`). Entre el paso 2 y el 4 los guardias ven errores: el backend nuevo ya devuelve rol `ggss` y el frontend viejo no lo entiende. Supervisores, central y administradores no se ven afectados. Hacerlo de noche y con los dos pasos preparados para ejecutarse seguidos. Las sesiones guardadas con rol antiguo se descartan solas y piden iniciar sesión de nuevo.
5. **Verificación completa** (sección 7).
6. Recién entonces, si se quiere mostrar HU-15, **activar `DEVICE_POLICY=on`** siguiendo la sección 5.

## 5. Activación de HU-15 (`DEVICE_POLICY=on`): hacerla aparte y con cuidado

HU-15 (marcaje fuera de geocerca queda "por revisar" y lo autoriza el supervisor) **solo funciona con `DEVICE_POLICY=on`**; con `off` el marcaje fuera de rango se rechaza con error 400. Pero `on` cambia las reglas de acceso:

- Supervisor, operador central y administrador **solo pueden iniciar sesión desde un equipo corporativo enrolado** (error 403 si no). Los guardias desde un equipo personal quedan limitados a ver turnos, solicitudes y documentos.
- Los sockets también exigen equipo corporativo.
- Solución de arranque prevista: el super admin (exento) invita desde la consola de plataforma el "equipo principal" de cada empresa; el administrador abre el enlace e inicia sesión desde ese equipo; luego invita los demás.

Procedimiento recomendado: **ensayarlo primero en Docker local** con `DEVICE_POLICY=on` (flujo completo: invitar equipo principal, enrolar, iniciar sesión como supervisor, marcar fuera de geocerca, autorizar). Si funciona, en Azure: enrolar el equipo principal **antes** de dejar la variable en `on` si el flujo lo permite con la política apagada (no lo verifiqué: probarlo en local), y tener a mano el rollback de la sección 6.

## 6. Rollback

| Situación | Qué hacer | Efecto |
|---|---|---|
| `DEVICE_POLICY=on` bloquea el acceso | Quitar la variable o ponerla en `off` y crear revisión nueva. | Inmediato, sin tocar datos. Vuelve el rechazo del marcaje fuera de geocerca. |
| La revisión nueva no arranca (migración falla) | Confirmar en *Revisiones* que la anterior sigue activa. Revisar el registro del contenedor, corregir y reintentar. | Una migración fallida se revierte sola (transacción). Las anteriores ya aplicadas quedan. |
| El backend nuevo arranca pero hay un error grave | Volver a la **revisión anterior** de `ca-geo-api` (Revisiones → activar). Si las migraciones ya corrieron, ejecutar **antes** la reversa de roles (abajo). | Sin la reversa, los guardias no pueden operar con el código viejo. |
| Error grave en el frontend | En Vercel, *Promote* el despliegue anterior. | Inmediato. |
| Datos dañados | Restaurar el respaldo del paso 3 en un servidor nuevo y apuntar `DATABASE_URL` (último recurso: se pierde lo ocurrido desde el respaldo). | Pérdida de datos posteriores. |

**Reversa de roles** (solo si se vuelve al código anterior y existe `_respaldo_roles_ggss`):

```sql
UPDATE "Usuario" u SET rol = r.rol, tipo_ggss = r.tipo_ggss
FROM _respaldo_roles_ggss r WHERE u.id = r.id AND u.rol = 'ggss';
```

Los guardias creados **después** del despliegue no están en la instantánea y quedarían como `ggss`; habría que asignarles `pauta` o `libre` a mano. Las columnas y tablas nuevas pueden quedar: el código anterior las ignora.

## 7. Verificación después del despliegue

1. `GET /api/v1/health` y `GET /api/v1/health/ready` responden bien.
2. En el registro del contenedor: migraciones aplicadas (`SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 9` muestra las 8 nuevas) y sin errores de arranque.
3. Iniciar sesión con un usuario de cada rol (guardia incluido, ya con rol `ggss`) y abrir su pantalla principal.
4. Crear una novedad con folio; resolverla; revisar el historial.
5. Marcar entrada y salida desde un celular.
6. Pauta 4x4 de prueba: genera 6 meses y avisa que reemplaza la anterior.
7. HU-15 (solo con `DEVICE_POLICY=on`): marcar fuera de la geocerca → queda "por revisar"; el supervisor autoriza o rechaza; el guardia ve el resultado en Alertas.
8. Correr `node scripts/verificar-config.js` en el contenedor (guía de variables) y, si se quiere, el script de medición de KPI en un entorno de pruebas.

## 8. Riesgos conocidos

- El rol `ggss` único y la política de dispositivos son cambios de comportamiento amplios, no solo HU-15: el riesgo de la fusión es de **alcance**, no de conflicto de código.
- Azure funciona con 0,5 vCPU y 0 a 1 réplicas: el primer arranque tras el despliegue (migraciones incluidas) puede tardar. No desplegar minutos antes de la defensa.
- Sin Redis, 2FA e intentos fallidos usan memoria del proceso.
- El push no tiene cliente en el frontend (ver guía de variables).
