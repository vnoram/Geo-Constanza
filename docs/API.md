# API

Base URL: `/api/v1`. Todas las rutas (salvo `auth/*`) requieren
`Authorization: Bearer <jwt>`. Los roles listados son los aceptados por
`authorize(...)` en cada ruta (ver [ROLES.md](ROLES.md) para el significado
de cada uno).

## Auth (`/auth`)
| Método | Ruta | Roles |
|---|---|---|
| POST | `/login` | público |
| POST | `/password/reset-request` | público (alias histórico: `/password/reset`) |
| POST | `/password/reset-confirm` | público |
| POST | `/password/change` | autenticado |
| POST | `/refresh` | público |
| POST | `/logout` | autenticado |
| POST | `/2fa/verify` | público (exige `tempToken` del login) |
| POST | `/2fa/setup` | autenticado |
| POST | `/2fa/enable` | autenticado |

## Usuarios (`/usuarios`)
Reglas: el administrador nunca define la contraseña de otra persona (`password` en `POST` o `PUT` se descarta; al crear se envía una invitación por correo, válida 72 h). No se puede crear ni asignar el rol `admin`, ni cambiar el rol de un administrador existente (`400`).

| Método | Ruta | Roles |
|---|---|---|
| GET | `/me` | autenticado |
| PUT | `/me/token-dispositivo` | autenticado; solo su propio usuario |
| GET | `/` | supervisor, central, admin |
| POST | `/` | admin |
| PUT | `/:id` | admin |
| PATCH | `/:id/desactivar` | admin |

## Instalaciones (`/instalaciones`)
| Método | Ruta | Roles |
|---|---|---|
| GET | `/` | supervisor, central, admin |
| POST | `/` | admin |
| PUT | `/:id` | admin |

## Turnos (`/turnos`)
| Método | Ruta | Roles |
|---|---|---|
| GET | `/disponibles` | libre |
| GET | `/conflictos` | supervisor, central, admin |
| POST | `/lote` | central, admin |
| POST | `/pauta-4x4` | central, admin |
| GET | `/` | pauta, libre, supervisor, central, admin |
| GET | `/:id` | pauta, libre, supervisor, central, admin |
| POST | `/` | supervisor, central, admin |
| PUT | `/:id` | supervisor, central, admin |
| PATCH | `/:id/cancelar` | supervisor, central, admin |

## Asistencia (`/asistencia`)
| Método | Ruta | Roles |
|---|---|---|
| GET | `/estado-actual` | pauta, libre, admin |
| POST | `/entrada-tablet` | pauta |
| POST | `/entrada-fallback` | pauta, libre |
| POST | `/entrada` | pauta, libre, admin |
| POST | `/salida` | pauta, libre, admin |
| POST | `/sync` | autenticado (sincronización offline) |
| GET | `/hoy/:instalacionId` | supervisor, central, admin |
| GET | `/historial/:usuarioId` | pauta, libre, supervisor, central, admin |

`POST /salida` responde 409 si el turno no tiene un reporte asociado (una novedad, incluida «Sin novedad»): un turno no se cierra sin reporte.

## Novedades (`/novedades`)
| Método | Ruta | Roles |
|---|---|---|
| GET | `/` | pauta, libre, supervisor, central, admin |
| GET | `/:id` | pauta, libre, supervisor, central, admin |
| POST | `/` (multipart, campo `foto` opcional) | pauta, libre |
| PATCH | `/:id/resolver` | supervisor, central, admin |
| PATCH | `/:id/escalar` | supervisor, central, admin |
| PATCH | `/:id/asignar` | supervisor, central, admin |
| GET | `/:id/responsables` | supervisor, central, admin |
| GET | `/:id/historial` | pauta, libre, supervisor, central, admin |

## Solicitudes (`/solicitudes`)
| Método | Ruta | Roles |
|---|---|---|
| GET | `/` | pauta, libre, supervisor, central, admin |
| POST | `/` | pauta, libre |
| GET | `/vacantes` | libre activo |
| POST | `/cobertura` | libre activo |
| PATCH | `/:id/aprobar` | supervisor, admin |
| PATCH | `/:id/rechazar` | supervisor, admin |

## Reportes (`/reportes`)
| Método | Ruta | Roles |
|---|---|---|
| GET | `/asistencia` | supervisor, admin |
| GET | `/incidentes` | supervisor, admin |
| GET | `/semana` | supervisor, admin |
| GET | `/estado` | supervisor, admin |
| GET | `/mensual` | supervisor, admin |
| GET | `/exportar/:tipo` | supervisor, admin |

## Dashboard (`/dashboard`)
| Método | Ruta | Roles |
|---|---|---|
| GET | `/hoy` | supervisor, central, admin |
| GET | `/supervisores` | central, admin |

## Auditoría (`/auditoria`)
| Método | Ruta | Roles |
|---|---|---|
| GET | `/` | admin |
| GET | `/pdf` | admin |

---
## Contratos incorporados en Sprint 5 (T1–T5, C2–C7)

Esta referencia describe las ramas apiladas, todavía sin merge ni despliegue. Las rutas son relativas a `/api/v1`. Roles y estados provienen de `backend/src/constants/`; fechas operacionales se interpretan en `America/Santiago`.

### Registro y consulta de novedades

`POST /novedades` admite JSON sin foto o multipart con estos campos:

| Campo | Tipo | Requerimiento |
|---|---|---|
| `tipo` | texto | obligatorio |
| `descripcion` | texto | obligatorio |
| `foto` | archivo | opcional, JPEG/PNG/WebP de hasta 10 MB |
| `latitud`, `longitud` | número o texto numérico | opcionales |
| `precision_m` | número | opcional |

Requiere turno disponible; un GGSS Libre sin solicitud de turno/cobertura aprobada y sin turno recibe 403. Un guardia en pauta sin turno recibe 400. MIME inválido devuelve 400; foto superior a 10 MB, 413. Sin foto la creación funciona; un fallo de subida conserva el comportamiento de crear sin evidencia. GPS fuera del radio se registra como `gps_dentro_rango: false`, sin impedir el reporte. Respuesta 201.

`GET /novedades` acepta `instalacion_id`, `tipo`, `urgencia`, `estado`, `fecha_inicio`, `fecha_fin`, `page` (1) y `limit` (50); devuelve `{ data, total, page, totalPages }`. Guardias ven sus novedades, supervisores sus instalaciones y central/admin tienen alcance global. Un filtro de instalación no amplía esos permisos.

`GET /novedades/:id` usa los mismos permisos. Listar, obtener y crear incluyen `numero` y `folio`, por ejemplo `NOV-2026-00042`: número global único y año **de creación** en Chile, con al menos cinco dígitos. Listado/detalle incluyen `foto_url_firmada` cuando corresponde. No reutilizar ni publicar esos enlaces temporales.

### Resolver, escalar y asignar

Ejemplo de resolución:

```json
{ "comentario": "Situación controlada y verificada" }
```

`PATCH /novedades/:id/resolver` exige comentario de texto con al menos cinco caracteres tras `trim()`. Guarda el texto recortado, estado `resuelta`, actor y fecha de atención. Errores: 400 por comentario, 403 por instalación/rol, 404 si no existe y 409 si ya está resuelta o hubo un cambio concurrente.

`PATCH /novedades/:id/escalar` solo admite `abierta` o `en_atencion`; devuelve 409 para cualquier otro estado. Un supervisor debe pertenecer a la instalación; central/admin mantienen acceso global.

`GET /novedades/:id/responsables` devuelve candidatos activos supervisor/central, solo `{ id, nombre }`, después de comprobar permiso de gestión sobre la novedad.

`PATCH /novedades/:id/asignar` recibe:

```json
{ "responsable_id": "id-del-responsable" }
```

Solo se asigna desde `abierta`; pasa a `en_atencion`. Responsable inexistente/inactivo o de otro rol: 400. Estado no admisible: 409. Se devuelve la novedad con `responsable: { id, nombre }`. Las activas incluyen `abierta`, `en_atencion` y `escalada`; las resueltas, `resuelta`. La asignación intenta notificar por FCM sin hacer fallar el cambio si no hay proveedor/token.

### Historial

`GET /novedades/:id/historial` devuelve un array ordenado por `created_at` e `id`. Usa los mismos permisos que obtener, no solo autenticación. Cada fila contiene:

```json
{
  "id": "id-del-historial",
  "novedad_id": "id-de-la-novedad",
  "usuario_id": "id-del-actor",
  "accion": "resolver",
  "estado_anterior": "escalada",
  "estado_nuevo": "resuelta",
  "comentario": "Situación controlada",
  "created_at": "2026-10-29T12:00:00.000Z",
  "usuario": { "id": "id-del-actor", "nombre": "Nombre del actor" }
}
```

Crear, asignar, escalar y resolver generan exactamente una fila por acción exitosa, en la misma transacción que el cambio. Si falla el historial, el cambio se revierte. Las acciones de gestión también se registran en auditoría desde el controlador.

### Token del dispositivo y FCM

`PUT /usuarios/me/token-dispositivo` recibe `{ "token": "token-obtenido-del-sdk-fcm" }` y responde `{ "registrado": true }`. Requiere texto no vacío de hasta 4096 caracteres (400 si es inválido). Guarda un token por usuario autenticado; el endpoint ignora cualquier ID de usuario enviado en el body. Registrar otro token sustituye el anterior. No devuelve ni registra el token en logs.

FCM se configura solo mediante `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY` y `FIREBASE_CLIENT_EMAIL`. La falta de configuración/token o un fallo de envío no revierte una aprobación, rechazo o asignación. Se notifica la revisión de solicitudes de turno/cobertura y la asignación de novedades. La recepción exige un dispositivo que obtenga y registre su token mediante Firebase; el frontend web no incorpora enrolamiento FCM automático en este bloque.

### Vacantes y solicitud de cobertura

`GET /solicitudes/vacantes`, exclusivo GGSS Libre activo, devuelve un array:

```json
[
  {
    "id": "id-del-turno",
    "fecha": "2026-10-30T00:00:00.000Z",
    "hora_inicio": "08:00",
    "hora_fin": "20:00",
    "instalacion": { "id": "id-de-la-instalacion", "nombre": "Instalación" },
    "motivo_vacante": "sin_asignar"
  }
]
```

Se consideran turnos programados no finalizados, sin asistencia ni cobertura aprobada: sin guardia asignado o con tolerancia vencida sin marcaje. `motivo_vacante` es `sin_asignar` o `sin_asistencia`. La compatibilidad comprueba solapes con turnos del solicitante, incluidos nocturnos de fechas contiguas. No expone datos personales del guardia ausente.

`POST /solicitudes/cobertura` recibe:

```json
{ "vacante_turno_id": "id-del-turno", "motivo": "Disponible para cubrir" }
```

Respuesta 201 con la `Solicitud` de tipo `cobertura`, usuario autenticado, `vacante_turno_id`, fechas del turno y estado `pendiente`. Errores: 400 sin ID, 403 por perfil, 404 por vacante inexistente, 409 si dejó de estar disponible, existe solape o ya hay una solicitud pendiente/aprobada de ese usuario. Usar esta ruta, no el POST genérico de solicitudes, para postular a una vacante.

`PATCH /solicitudes/:id/aprobar` sigue reservado a supervisor/admin en el router. Para una solicitud vinculada a vacante verifica GGSS Libre activo, instalación del supervisor, disponibilidad, solapes y máximos ordinarios semanal/diario; asigna el turno y aprueba dentro de una transacción `Serializable`. Usa `{ "comentario": "Cobertura confirmada" }`. Estado no admisible, exceso de jornada o conflicto de concurrencia: 409. Configuración semanal inválida: 503. Rechazar usa `PATCH /solicitudes/:id/rechazar` con `{ "motivo": "Motivo del rechazo" }` y notifica al solicitante.

**Política ordinaria autorizada por el usuario tras consulta oficial:** base `MAX_HORAS_SEMANALES=42` en la constante, sin escribir valores en `.env.example`. El techo se reduce a 40 para fechas desde el 26-04-2028. Una configuración contractual menor prevalece; una mayor no amplía el techo ordinario. Una configuración no vacía inválida sigue impidiendo la aprobación (503). Se rechaza además cobertura que exceda 10 horas por turno o acumuladas en un día; no se habilitan 12 horas, horas extra ni promedios excepcionales por una variable.

El cómputo técnico distribuye duración real entre semanas ISO lunes-domingo y días en Chile. Es una política conservadora para aprobar nuevas coberturas, no un motor completo de normativa: no verifica contratos, colación, descansos, convenios, autorización DT ni todos los turnos creados por otros endpoints. Las solicitudes antiguas sin vacante conservan su comportamiento previo. Un régimen 4×4×12 requiere tratamiento específico no implementado; consultar el [informe con fuentes oficiales](INFORME_SPRINT5.md).

### Tolerancia y panel consolidado

`POST /instalaciones` y `PUT /instalaciones/:id` (admin) aceptan `tolerancia_atraso_minutos`: entero no negativo, default 15 al crear. Coordenadas deben estar dentro de sus rangos geográficos y `radio_geofence_m` debe ser entero positivo.

`GET /dashboard/hoy` añade `sinCobertura` y `lista[].sin_cobertura`. Cuenta puestos en curso sin asistencia cuando vence la tolerancia de esa instalación; un puesto sin usuario cuenta desde el inicio. No cuenta turnos futuros ni finalizados. El valor se muestra en Supervisor/Central. Las vacantes usan la misma tolerancia; una cobertura ya aprobada no vuelve a ofrecerse solo porque aún no haya marcado.

### Bitácora y PDF

`GET /auditoria` y `GET /auditoria/pdf` solo admiten admin y comparten `usuario_id`, `accion` (coincidencia exacta), `fecha_inicio`, `fecha_fin` (días `YYYY-MM-DD` de Chile). Fechas inválidas/invertidas o filtros no textuales devuelven 400. El listado usa `page`/`limit`; el PDF incluye **todas** las filas filtradas sin paginación y responde `application/pdf` con nombre `bitacora-auditoria.pdf`.

El documento contiene fecha chilena, usuario, acción, tabla, registro, IP e ID de auditoría; no exporta snapshots antes/después ni credenciales. Sin filas se genera un PDF válido que lo indica. `AdminAuditoria.jsx` exporta los filtros aplicados que usa su listado, no cambios de formulario aún sin aplicar.

### Autenticación, segundo factor y restablecer contraseña

Contratos (detalle de decisiones en [ADR 0002](ADR/0002-jwt-2fa.md) y [ADR 0006](ADR/0006-2fa-totp-y-reset-password.md)):

- `POST /auth/login` `{ rut, password }`. Para supervisor y administrador con 2FA exigido: si ya enrolaron responde `{ requires2FA: true, tempToken }` (sin sesión); si no, devuelve la sesión con `mustEnroll2FA: true` y el frontend obliga a enrolar antes de entrar.
- `POST /auth/2fa/verify` `{ tempToken, code }`: `code` es TOTP de 6 dígitos o un código de recuperación `XXXXX-XXXXX`. Responde `{ usuario, accessToken, refreshToken }`. 401 con token temporal inválido o vencido (5 min); 429 tras 5 códigos erróneos (bloqueo 15 min).
- `POST /auth/2fa/setup` (autenticado) responde `{ otpauth_url, secreto }`; `POST /auth/2fa/enable` `{ code }` responde `{ codigos_recuperacion }` (8 códigos, se muestran una sola vez).
- `POST /usuarios/:id/2fa/reset` (solo administrador, no sobre sí mismo): borra el segundo factor para que el usuario vuelva a enrolar. Auditado.
- `POST /auth/password/reset-request` `{ email }`: siempre `200` con el mismo mensaje exista o no la cuenta. Límite 3 por hora por correo (silencioso) y 10 por hora por IP (`429`).
- `POST /auth/password/reset-confirm` `{ token, password }`: contraseña de 10 a 128 caracteres y distinta de la actual; `400` con enlace inválido, vencido o ya usado. Al confirmar se revocan las sesiones previas.
- `POST /auth/password/change` `{ actual, nueva }` (autenticado, «Mi cuenta»): exige la contraseña actual correcta; la nueva debe tener de 10 a 128 caracteres y ser distinta; `400` en caso contrario. Revoca las demás sesiones y queda en auditoría (`cambio_password`).
- Acciones auditadas: `login_2fa`, `activar_2fa`, `reiniciar_2fa`, `solicitar_reset_password`, `reset_password`.

Variables: `TWO_FACTOR_ENCRYPTION_KEY`, `TWO_FACTOR_ISSUER`, `REQUIRE_2FA` (por defecto activo solo en producción), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `FRONTEND_URL`. Todas vacías en `.env.example`.

### Verificación local y límites

Lint y tests se ejecutan dentro de Docker con Node 20. La integración PostgreSQL requiere `RUN_LOCAL_DB_TESTS=1`, `NODE_ENV=test` y `DATABASE_URL` apuntando exclusivamente al contenedor desechable `geo-sprint5-db`, base `geo_sprint5`; la suite comprueba ese destino antes de crear/limpiar fixtures. No imprimir esa variable ni copiar conexiones a documentación/commits. Sin el flag se omite la integración DB, por lo que no equivale a una verificación completa.

Ejecutar dentro del backend del contenedor: `npm run lint` y `npm test -- --runInBand --silent`; migraciones solo locales mediante `npx prisma migrate dev --name <nombre>` y regeneración del cliente. Firebase se simula; Azure/GPS físicos y volúmenes masivos de PDF quedan fuera de la verificación local. Consulta [ADR](ADR/README.md) y [estado de historias](HISTORIAS_DE_USUARIO.md).

Las tablas se mantienen manualmente a partir de `backend/src/routes/*.routes.js`. Actualizarlas junto con cada cambio de contrato.

## Dispositivos corporativos

Rutas bajo `/api/v1`. Las operaciones de gestión requieren un administrador de la empresa, con dispositivo corporativo cuando la política esté activa.

| Método y ruta | Solicitud y respuesta |
| --- | --- |
| `GET /dispositivos/destinatarios` | Lista los supervisores y operadores centrales activos de la empresa. |
| `POST /dispositivos/invitaciones` | Recibe `{ "nombre": "...", "usuario_id": "...", "instalacion_id": "..." }` (instalación opcional). Devuelve 201 con `id`, `invitacion_expira_en`, `enlace` y `correoEnviado`. Los destinatarios no elegibles reciben el mismo 400. |
| `POST /dispositivos/invitaciones/confirmar` | Pública. Recibe `{ "token": "..." }` en el cuerpo y devuelve `{ "empresa": "..." }` si el enlace sigue vigente. No lo consume. Límite: 10 peticiones por minuto por IP. |
| `POST /dispositivos/:id/invitaciones/reenviar` | Genera un enlace nuevo para el destinatario de una invitación pendiente e invalida el anterior. |
| `POST /dispositivos` | `{ "nombre": "PC de recepción", "instalacion_id": "…" }` (la instalación es opcional y debe ser de tu empresa). Devuelve 201 con los datos del registro y el campo `codigo` en claro una sola vez. |
| `POST /dispositivos/canjear` | Pública. Recibe `{ "codigo": "..." }` y devuelve `{ "token": "..." }`. El código vence en 15 minutos, se consume de forma atómica y responde 400 si es inválido, usado, revocado o vencido. |
| `GET /plataforma/dispositivos`, `POST /plataforma/empresas/:id/dispositivos/invitacion`, `PATCH /plataforma/empresas/:id/dispositivos/:equipoId/revocar` | Solo `super_admin`. Equipo principal de cada empresa: la invitación llega por correo (mismo enlace `#/enrolar?t=…`, 15 min, un solo uso) al administrador de gestión activo, que la confirma e inicia sesión para enrolar el equipo con `DEVICE_POLICY=on`. Si SMTP falla devuelve `correoEnviado: false` y el `enlace`. El listado solo muestra estado (`enrolado`, `pendiente`, `vencido`, `revocado`), nunca hashes. Auditoría: `invitar_dispositivo_plataforma`, `revocar_dispositivo_plataforma`. Luego el administrador invita los demás equipos con `POST /dispositivos/invitaciones`. |
| `GET /dispositivos` | Lista los equipos de la empresa. Incluye estado, vencimiento pendiente, nombre de quien enroló el equipo y último uso, sin hashes. |
| `PATCH /dispositivos/:id/revocar` | Devuelve `{ "estado": "revocado" }` e invalida la invitación, el código manual y el token de dispositivo. Un ID ajeno o inexistente devuelve 404. |

Con `DEVICE_POLICY=on`, un equipo asociado a una instalación solo acepta marcajes de tablet para turnos de esa instalación (403 en otro caso) y cada marcaje guarda `dispositivo_id`. Los registros sincronizados no acreditan el hardware original. Los tokens de equipo vencen tras `DEVICE_TOKEN_MAX_INACTIVIDAD_DIAS` días sin uso (90 por defecto); `ultimo_uso` se actualiza como máximo una vez por hora y la identificación se cachea 45 s (se invalida al revocar o reenviar). Crear, invitar, reenviar, confirmar, canjear, enrolar y revocar quedan en auditoría sin tokens. `/dispositivos/canjear` e `/invitaciones/confirmar` limitan 10 peticiones por minuto por IP.

### `PATCH /asistencia/:id/revisar`

Solo con `DEVICE_POLICY=on` (404 si está apagada). Roles: supervisor (solo sus instalaciones), operador central y administrador. Cuerpo: `{ "decision": "aprobar" | "rechazar", "comentario": "..." }`; el comentario es obligatorio al rechazar. Solo marcajes con `verificacion_gps` `por_revisar` o `sin_ubicacion` (400 en otro caso). La decisión se aplica con una actualización condicional: repetir la misma decisión es idempotente y una decisión distinta responde 409. Se conserva el `verificacion_gps` original, se audita (`revisar_marcaje`) y se notifica al guardia.

#### POST /asistencia/:id/solicitar-revision
Solo con `DEVICE_POLICY=on`. Rol: ggss, únicamente sobre su propio marcaje, con el turno abierto y `revision_estado = 'rechazado'` (400 en otro caso). Cuerpo: `{ "comentario": "..." }` (5 a 500 caracteres, obligatorio). El marcaje vuelve a quedar pendiente de revisión (`revision_estado` y `comentario_revision` se limpian, la explicación se guarda en `comentario_guardia`), se avisa al supervisor de la instalación y el rechazo anterior queda en la auditoría (`reenviar_marcaje`). El supervisor decide de nuevo con `PATCH /asistencia/:id/revisar`.

Con la política activa, el reporte exigido para marcar la salida excluye los tipos de rutina «Ronda», «Fin de ronda» y «Cambio de turno»; cuentan «Sin novedad» y las novedades reales.

`GET /dispositivos/mis-invitaciones` (supervisor y operador central) lista las invitaciones pendientes dirigidas al usuario autenticado y `POST /dispositivos/:id/aceptar` registra el equipo actual sin volver a iniciar sesión, devolviendo `{ "token" }` una vez (400 si no es el destinatario o venció). El enlace por correo sigue siendo la vía para el primer equipo, cuando aún no hay otro corporativo desde el cual entrar.

El enlace usa `FRONTEND_URL/#/enrolar?t=…`. Tras confirmar, el cliente envía el valor del fragmento en el campo opcional `invitacion` de `POST /auth/login`. Si hay 2FA, el desafío temporal vincula esa invitación y el enrolamiento se completa en `POST /auth/2fa/verify`. La respuesta final de autenticación devuelve `tokenDispositivo` una vez. La invitación vence en 15 minutos y solo se consume con la cuenta destinataria tras completar la autenticación. Si SMTP falla, `correoEnviado` es falso y el enlace sigue disponible para copiar. `POST /dispositivos` y `/dispositivos/canjear` quedan como respaldo manual.

Con `DEVICE_POLICY=on`, el cliente envía `X-Device-Token` al iniciar sesión, verificar 2FA, renovar y llamar a rutas protegidas. Socket.IO recibe `deviceToken` en su autenticación. El JWT y el perfil incluyen `dispositivo`. En HTTP, `X-Device-Class` indica la clasificación vigente para actualizar el menú. La API comprueba el token contra el equipo activo de la empresa y contra el equipo vinculado a la sesión.

El guardia personal puede consultar sus turnos, crear y leer sus solicitudes y consultar su propio perfil. La sección Documentos reutiliza la vista existente del frontend. Asistencia, novedades, vacantes y demás operaciones quedan reservadas a equipos corporativos. Supervisor, Central y Administración reciben 403 en equipos personales. `super_admin` conserva su acceso a plataforma.

### Adjuntos en solicitudes

`POST /solicitudes` acepta también `multipart/form-data` con los campos `tipo`, `fecha_desde`, `motivo` y un archivo opcional `adjunto` (imagen JPEG/PNG/WebP o PDF, hasta 5 MB; el tipo se valida por su firma, no por la extensión). El archivo se guarda en el mismo contenedor privado de Azure Blob que las fotos de novedades y la base de datos conserva solo la URL (`adjunto_url`) y el nombre original. Las respuestas incluyen `adjunto_url_firmada`, un link de lectura temporal de 60 minutos, y nunca la URL guardada. Un adjunto inválido responde 400, uno demasiado grande 413 y una falla de almacenamiento 503 (la solicitud no se crea sin su adjunto).

`POST /solicitudes` también acepta `fechas` (arreglo `["2026-12-01", ...]`, o su JSON en multipart; 1 a 31 fechas AAAA-MM-DD) para `turno_extra` y `dias_libres`. Se crea un turno extra por cada día; en las ausencias, los días consecutivos se agrupan en un solo tramo (`fecha_desde`/`fecha_hasta`). La app envía las ausencias como un único rango con `fecha_desde` y `fecha_hasta`. Todo ocurre en una transacción, comparte el mismo adjunto y la respuesta es un arreglo de solicitudes. Con otros tipos, `fechas` responde 400. Vacaciones y traslados siguen usando `fecha_desde` y, opcionalmente, `fecha_hasta`.

### Documentos del personal

`GET /documentos` lista los documentos del guardia autenticado; Administración puede filtrar con `?usuario_id=`. `POST /documentos` (multipart, campo `archivo`; imagen JPG/PNG/WebP o PDF, hasta 5 MB) lo usan dos roles: el guardia solo sube su certificado OS-10 para sí mismo (el tipo se fuerza a `os10`) y Administración publica `contrato`, `liquidacion`, `os10`, `anexo` u `otro` para un guardia de su empresa (`usuario_id`, `tipo`, `nombre` opcional). Los archivos viven en el contenedor privado de Azure Blob; la base guarda solo la URL y las respuestas traen `url_firmada`, un link temporal de 60 minutos. Cada subida queda en auditoría (`subir_documento`). Con `DEVICE_POLICY=on` los guardias en equipo personal pueden listar y subir documentos.
