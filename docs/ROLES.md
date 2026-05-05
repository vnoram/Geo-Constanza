# 👥 Roles y Permisos — Geo Constanza

## Resumen de Roles

El sistema implementa **RBAC (Role-Based Access Control)** con 5 roles diferenciados según la función operacional del usuario.

| Rol          | Identificador | Dispositivo Principal    | Descripción |
|--------------|---------------|--------------------------|-------------|
| GGSS En Pauta | `pauta`      | Tablet empresa + Móvil   | Guardia con turno fijo en pauta 4x4 |
| GGSS Libre    | `libre`      | Móvil personal           | Guardia eventual que solicita turnos |
| Supervisor    | `supervisor` | Móvil profesional        | Jefe de instalación/zona |
| Central       | `central`    | Web (PC)                 | Operador de monitoreo global |
| Administrador | `admin`      | Web (PC)                 | Gestión total del sistema |

---

## Descripción Detallada por Rol

### 🟢 GGSS En Pauta (`pauta`)

Guardia de seguridad con turno programado en la pauta 4x4 (4 días trabajo / 4 días descanso). Trabaja en una instalación fija asignada.

**Acciones permitidas:**
- Ver sus propios turnos (`GET /turnos`)
- Marcar entrada/salida desde tablet (`POST /asistencia/entrada-tablet`)
- Marcar entrada/salida desde móvil fallback (`POST /asistencia/entrada-fallback`)
- Ver su estado de asistencia actual (`GET /asistencia/estado-actual`)
- Ver su historial de asistencia (`GET /asistencia/historial/:id`)
- Reportar novedades/incidentes con foto (`POST /novedades`)
- Ver novedades propias (`GET /novedades`)
- Crear solicitudes de vacaciones, días libres, traslados (`POST /solicitudes`)
- Ver sus propias solicitudes (`GET /solicitudes`)

**No puede:**
- Ver datos de otros usuarios
- Crear o modificar turnos
- Aprobar solicitudes
- Acceder al dashboard

---

### 🔵 GGSS Libre (`libre`)

Guardia eventual sin turno fijo. Solicita turnos disponibles en la instalación asignada como base y solo puede marcar asistencia si tiene un turno aprobado.

**Acciones permitidas:**
- Ver turnos disponibles en su instalación (`GET /turnos/disponibles`)
- Ver sus propios turnos (`GET /turnos`)
- Marcar entrada/salida desde móvil (solo con turno aprobado) (`POST /asistencia/entrada-fallback`)
- Ver su estado de asistencia actual (`GET /asistencia/estado-actual`)
- Ver su historial de asistencia (`GET /asistencia/historial/:id`)
- Reportar novedades/incidentes (`POST /novedades`)
- Crear solicitudes (`POST /solicitudes`): `vacaciones`, `dias_libres`, `turno_extra`, `traslado`, `turno`
- Ver sus documentos (`GET /docs`)

**No puede:**
- Crear turnos
- Marcar entrada desde tablet fija
- Aprobar solicitudes
- Ver datos de instalaciones

---

### 🟡 Supervisor (`supervisor`)

Responsable de una o varias instalaciones y comunas. Tiene visibilidad de los guardias de sus instalaciones asignadas.

**Acciones permitidas:**
- Ver usuarios de sus instalaciones (`GET /usuarios`)
- Ver turnos de sus instalaciones (`GET /turnos`)
- Crear y editar turnos individuales (`POST /turnos`, `PUT /turnos/:id`)
- Cancelar turnos (`PATCH /turnos/:id/cancelar`)
- Verificar conflictos de turnos (`GET /turnos/conflictos`)
- Ver asistencia del día de su instalación (`GET /asistencia/hoy/:instalacionId`)
- Ver novedades de su instalación (`GET /novedades`)
- Resolver novedades (`PATCH /novedades/:id/resolver`)
- Escalar novedades a Central (`PATCH /novedades/:id/escalar`)
- Ver y aprobar/rechazar solicitudes (`PATCH /solicitudes/:id/aprobar`, `/rechazar`)
- Ver dashboard de su instalación (`GET /dashboard/hoy`)
- Generar reportes (`GET /reportes/*`)
- Ver auditoría de su instalación (con filtros)

**No puede:**
- Crear/editar usuarios ni instalaciones
- Generar pauta 4x4 automática
- Crear turnos en lote
- Ver el estado de otros supervisores
- Acceder a auditoría global

**Restricción especial:** El middleware `autorizarInstalacionSupervisor` verifica en tiempo de ejecución que el supervisor tenga asignada la instalación que está consultando.

---

### 🟠 Central (`central`)

Operador de monitoreo global con visibilidad completa del sistema pero sin capacidad de modificar configuración base.

**Acciones permitidas:**
- Ver todos los usuarios (`GET /usuarios`)
- Ver todos los turnos (`GET /turnos`)
- Crear turnos individuales y en lote (`POST /turnos`, `/lote`)
- Generar pauta 4x4 automática (`POST /turnos/pauta-4x4`)
- Ver asistencia de cualquier instalación
- Ver y monitorear todas las novedades
- Resolver novedades de cualquier instalación
- Ver dashboard global (`GET /dashboard/hoy`)
- Ver estado de todos los supervisores (`GET /dashboard/supervisores`)
- Ver todas las solicitudes
- Ver instalaciones

**No puede:**
- Crear/editar usuarios ni instalaciones
- Aprobar/rechazar solicitudes
- Acceder a auditoría

---

### 🔴 Administrador (`admin`)

Control total del sistema. Único rol que puede crear usuarios e instalaciones y acceder a la auditoría completa.

**Acciones permitidas:**
- Todo lo de Central, más:
- Crear, editar y desactivar usuarios (`POST /usuarios`, `PUT /usuarios/:id`, `PATCH /usuarios/:id/desactivar`)
- Crear y editar instalaciones (`POST /instalaciones`, `PUT /instalaciones/:id`)
- Ver auditoría completa (`GET /auditoria`)
- Aprobar/rechazar solicitudes
- Generar pauta 4x4
- Crear turnos en lote

---

## Matriz de Permisos por Endpoint

| Endpoint                              | pauta | libre | supervisor | central | admin |
|---------------------------------------|:-----:|:-----:|:----------:|:-------:|:-----:|
| `GET /auth/login`                     | ✅    | ✅    | ✅         | ✅      | ✅    |
| `GET /usuarios/me`                    | ✅    | ✅    | ✅         | ✅      | ✅    |
| `GET /usuarios`                       | ❌    | ❌    | ✅         | ✅      | ✅    |
| `POST /usuarios`                      | ❌    | ❌    | ❌         | ❌      | ✅    |
| `PUT /usuarios/:id`                   | ❌    | ❌    | ❌         | ❌      | ✅    |
| `PATCH /usuarios/:id/desactivar`      | ❌    | ❌    | ❌         | ❌      | ✅    |
| `GET /instalaciones`                  | ❌    | ❌    | ✅         | ✅      | ✅    |
| `POST /instalaciones`                 | ❌    | ❌    | ❌         | ❌      | ✅    |
| `PUT /instalaciones/:id`              | ❌    | ❌    | ❌         | ❌      | ✅    |
| `GET /turnos`                         | ✅    | ✅    | ✅         | ✅      | ✅    |
| `GET /turnos/disponibles`             | ❌    | ✅    | ❌         | ❌      | ❌    |
| `GET /turnos/conflictos`              | ❌    | ❌    | ✅         | ✅      | ✅    |
| `POST /turnos`                        | ❌    | ❌    | ✅         | ✅      | ✅    |
| `POST /turnos/lote`                   | ❌    | ❌    | ❌         | ✅      | ✅    |
| `POST /turnos/pauta-4x4`              | ❌    | ❌    | ❌         | ✅      | ✅    |
| `PUT /turnos/:id`                     | ❌    | ❌    | ✅         | ✅      | ✅    |
| `PATCH /turnos/:id/cancelar`          | ❌    | ❌    | ✅         | ✅      | ✅    |
| `GET /asistencia/estado-actual`       | ✅    | ✅    | ❌         | ❌      | ✅    |
| `POST /asistencia/entrada-tablet`     | ✅    | ❌    | ❌         | ❌      | ❌    |
| `POST /asistencia/entrada-fallback`   | ✅    | ✅    | ❌         | ❌      | ❌    |
| `POST /asistencia/entrada`            | ✅    | ✅    | ❌         | ❌      | ✅    |
| `POST /asistencia/salida`             | ✅    | ✅    | ❌         | ❌      | ✅    |
| `GET /asistencia/hoy/:instalacionId`  | ❌    | ❌    | ✅         | ✅      | ✅    |
| `GET /asistencia/historial/:id`       | ✅    | ✅    | ✅         | ✅      | ✅    |
| `GET /novedades`                      | ✅    | ✅    | ✅         | ✅      | ✅    |
| `POST /novedades`                     | ✅    | ✅    | ❌         | ❌      | ❌    |
| `PATCH /novedades/:id/resolver`       | ❌    | ❌    | ✅         | ✅      | ✅    |
| `PATCH /novedades/:id/escalar`        | ❌    | ❌    | ✅         | ❌      | ❌    |
| `GET /solicitudes`                    | ✅    | ✅    | ✅         | ✅      | ✅    |
| `POST /solicitudes`                   | ✅    | ✅    | ❌         | ❌      | ❌    |
| `PATCH /solicitudes/:id/aprobar`      | ❌    | ❌    | ✅         | ❌      | ✅    |
| `PATCH /solicitudes/:id/rechazar`     | ❌    | ❌    | ✅         | ❌      | ✅    |
| `GET /dashboard/hoy`                  | ❌    | ❌    | ✅         | ✅      | ✅    |
| `GET /dashboard/supervisores`         | ❌    | ❌    | ❌         | ✅      | ✅    |
| `GET /reportes/*`                     | ❌    | ❌    | ✅         | ❌      | ✅    |
| `GET /auditoria`                      | ❌    | ❌    | ❌         | ❌      | ✅    |

---

## Expiración de Tokens JWT por Rol

| Rol           | Access Token | Refresh Token |
|---------------|-------------|----------------|
| `pauta`       | 30 min      | 7 días         |
| `libre`       | 30 min      | 7 días         |
| `supervisor`  | 2 horas     | 7 días         |
| `central`     | 4 horas     | 7 días         |
| `admin`       | 4 horas     | 7 días         |

Los GGSS tienen tokens de corta duración dado que trabajan en dispositivos compartidos (tablet kiosk).

---

## Autenticación de Dos Factores (2FA)

El 2FA está disponible opcionalmente para los roles `supervisor` y `admin`. Al activarlo:

1. El login devuelve `{ requires2FA: true, tempToken: "..." }` en lugar del access token.
2. El cliente debe llamar a `POST /auth/2fa/verify` con el `tempToken` y el código OTP de 6 dígitos.
3. Si el código es correcto, se devuelve el access token y refresh token normales.

El secreto 2FA se almacena encriptado en el campo `two_factor_secret` del modelo `Usuario`.

---

## Validación de Dispositivos

Cada usuario puede tener registrado un dispositivo principal (campo `imei_dispositivo`). El sistema puede usar este IMEI para validar que la solicitud proviene del dispositivo autorizado, especialmente en el flujo de fallback móvil.

**Tipos de dispositivo:**

| Valor               | Descripción |
|---------------------|-------------|
| `tablet_empresa`    | Tablet kiosk fija en la instalación |
| `mobil_empresa`     | Móvil de empresa (supervisor / GGSS fallback) |
| `mobil_personal`    | Móvil personal del GGSS libre |
