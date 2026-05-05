# 📡 Documentación de la API — Geo Constanza

**Base URL:** `https://<tu-dominio>/api/v1`  
**Formato:** JSON  
**Autenticación:** Bearer token JWT en cabecera `Authorization`

---

## Convenciones generales

### Cabeceras requeridas (rutas protegidas)

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Respuesta de error estándar

```json
{
  "error": "Descripción del error"
}
```

### Códigos HTTP utilizados

| Código | Significado |
|--------|-------------|
| 200    | OK |
| 201    | Creado |
| 400    | Datos inválidos / falta información |
| 401    | No autenticado o token expirado |
| 403    | Sin permisos para el rol actual |
| 404    | Recurso no encontrado |
| 429    | Demasiadas peticiones (rate limit) |
| 500    | Error interno del servidor |

---

## Health Check

### `GET /api/v1/health`

> Sin autenticación.

**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-17T12:00:00.000Z"
}
```

---

## 🔐 Autenticación (`/api/v1/auth`)

### `POST /auth/login`

Inicia sesión con RUT y contraseña.

**Body:**
```json
{
  "rut": "12345678-9",
  "password": "miContraseña123"
}
```

**Respuesta exitosa (sin 2FA):**
```json
{
  "usuario": {
    "id": "uuid",
    "rut": "12345678-9",
    "nombre": "Juan Pérez",
    "rol": "pauta",
    "email": "juan@empresa.cl"
  },
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>"
}
```

**Respuesta (con 2FA requerido):**
```json
{
  "requires2FA": true,
  "tempToken": "<jwt temporal>"
}
```

---

### `POST /auth/2fa/verify`

Verifica el código OTP para roles con 2FA habilitado.

**Body:**
```json
{
  "tempToken": "<jwt temporal>",
  "code": "123456"
}
```

**Respuesta:**
```json
{
  "usuario": { ... },
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>"
}
```

---

### `POST /auth/refresh`

Renueva el access token usando el refresh token.

**Body:**
```json
{
  "refreshToken": "<jwt>"
}
```

**Respuesta:**
```json
{
  "accessToken": "<nuevo jwt>"
}
```

---

### `POST /auth/logout` 🔒

Cierra la sesión e invalida el token actual.

**Respuesta:**
```json
{
  "message": "Sesión cerrada correctamente"
}
```

---

### `POST /auth/password/reset`

Solicita recuperación de contraseña por email.

**Body:**
```json
{
  "email": "usuario@empresa.cl"
}
```

**Respuesta:**
```json
{
  "message": "Si el correo existe, recibirás un enlace de recuperación."
}
```

---

## 👤 Usuarios (`/api/v1/usuarios`)

Todas las rutas requieren autenticación.

### `GET /usuarios/me` 🔒

Retorna el perfil del usuario autenticado.

**Roles:** todos

**Respuesta:**
```json
{
  "id": "uuid",
  "rut": "12345678-9",
  "nombre": "Juan Pérez",
  "email": "juan@empresa.cl",
  "rol": "pauta",
  "estado": "activo",
  "instalacion_asignada_id": "uuid"
}
```

---

### `GET /usuarios` 🔒

Lista todos los usuarios con filtros opcionales.

**Roles:** `supervisor`, `central`, `admin`

**Query params:**

| Parámetro | Tipo   | Descripción |
|-----------|--------|-------------|
| `rol`     | string | Filtra por rol |
| `estado`  | string | `activo` \| `inactivo` |
| `page`    | number | Página (default: 1) |
| `limit`   | number | Resultados por página (default: 20) |

**Respuesta:**
```json
{
  "data": [ { ... } ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

---

### `POST /usuarios` 🔒

Crea un nuevo usuario.

**Roles:** `admin`

**Body:**
```json
{
  "rut": "12345678-9",
  "nombre": "María López",
  "email": "maria@empresa.cl",
  "telefono": "+56912345678",
  "password": "contraseña123",
  "rol": "pauta",
  "tipo_ggss": "pauta",
  "instalacion_asignada_id": "uuid",
  "dispositivo_principal": "tablet_empresa",
  "imei_dispositivo": "123456789012345"
}
```

**Respuesta:** `201` con el objeto usuario creado.

---

### `PUT /usuarios/:id` 🔒

Edita datos de un usuario existente.

**Roles:** `admin`

**Body:** Campos a actualizar (misma estructura que `POST`).

---

### `PATCH /usuarios/:id/desactivar` 🔒

Desactiva un usuario (no lo elimina).

**Roles:** `admin`

**Respuesta:**
```json
{
  "message": "Usuario desactivado correctamente"
}
```

---

## 🏢 Instalaciones (`/api/v1/instalaciones`)

### `GET /instalaciones` 🔒

Lista todas las instalaciones.

**Roles:** `supervisor`, `central`, `admin`

**Respuesta:**
```json
[
  {
    "id": "uuid",
    "nombre": "Centro Comercial Norte",
    "direccion": "Av. Ejemplo 123",
    "latitud": -33.45,
    "longitud": -70.65,
    "radio_geofence_m": 100,
    "tipo_recinto": "comercial",
    "nivel_criticidad": "Alta",
    "comuna": "Providencia",
    "estado": "activo"
  }
]
```

---

### `POST /instalaciones` 🔒

Crea una nueva instalación.

**Roles:** `admin`

**Body:**
```json
{
  "nombre": "Bodega Sur",
  "direccion": "Av. Industrial 456",
  "latitud": -33.50,
  "longitud": -70.70,
  "radio_geofence_m": 150,
  "tipo_recinto": "industrial",
  "nivel_criticidad": "Media",
  "comuna": "Lo Espejo"
}
```

---

### `PUT /instalaciones/:id` 🔒

Edita una instalación existente.

**Roles:** `admin`

---

## 📅 Turnos (`/api/v1/turnos`)

### `GET /turnos` 🔒

Lista turnos con filtros opcionales.

**Roles:** `pauta`, `libre`, `supervisor`, `central`, `admin`

**Query params:**

| Parámetro        | Tipo   | Descripción |
|------------------|--------|-------------|
| `usuarioId`      | string | Filtra por guardia |
| `instalacionId`  | string | Filtra por instalación |
| `fecha`          | string | Fecha exacta (YYYY-MM-DD) |
| `estado`         | string | `programado` \| `completado` \| `cancelado` |

---

### `GET /turnos/:id` 🔒

Obtiene el detalle de un turno.

**Roles:** `pauta`, `libre`, `supervisor`, `central`, `admin`

---

### `GET /turnos/disponibles` 🔒

Lista turnos disponibles en la instalación asignada del guardia libre.

**Roles:** `libre`

---

### `GET /turnos/conflictos` 🔒

Verifica conflictos de horario para un guardia y fecha.

**Roles:** `supervisor`, `central`, `admin`

**Query params:** `usuarioId`, `fecha`, `horaInicio`, `horaFin`

---

### `POST /turnos` 🔒

Crea un turno individual.

**Roles:** `supervisor`, `central`, `admin`

**Body:**
```json
{
  "usuario_id": "uuid",
  "instalacion_id": "uuid",
  "fecha": "2026-05-10",
  "hora_inicio": "06:00",
  "hora_fin": "14:00",
  "tipo_turno": "normal"
}
```

---

### `POST /turnos/lote` 🔒

Crea múltiples turnos en una sola petición.

**Roles:** `central`, `admin`

**Body:**
```json
{
  "turnos": [
    {
      "usuario_id": "uuid",
      "instalacion_id": "uuid",
      "fecha": "2026-05-10",
      "hora_inicio": "06:00",
      "hora_fin": "14:00"
    }
  ]
}
```

---

### `POST /turnos/pauta-4x4` 🔒

Genera automáticamente la pauta de turnos con el algoritmo 4x4 (4 días trabajo / 4 días descanso).

**Roles:** `central`, `admin`

**Body:**
```json
{
  "usuario_id": "uuid",
  "instalacion_id": "uuid",
  "fecha_inicio": "2026-05-01",
  "semanas": 4,
  "hora_inicio": "06:00",
  "hora_fin": "18:00"
}
```

---

### `PUT /turnos/:id` 🔒

Edita un turno existente.

**Roles:** `supervisor`, `central`, `admin`

---

### `PATCH /turnos/:id/cancelar` 🔒

Cancela un turno con motivo.

**Roles:** `supervisor`, `central`, `admin`

**Body:**
```json
{
  "motivo_cancelacion": "Instalación cerrada por feriado"
}
```

---

## ✅ Asistencia (`/api/v1/asistencia`)

### `GET /asistencia/estado-actual` 🔒

Obtiene si el guardia autenticado tiene turno activo y si ya marcó entrada.

**Roles:** `pauta`, `libre`, `admin`

---

### `POST /asistencia/entrada-tablet` 🔒

Registra entrada desde tablet fija (método primario — 95% de los casos).

**Roles:** `pauta`

**Body:**
```json
{
  "turno_id": "uuid",
  "instalacion_id": "uuid",
  "latitud": -33.45,
  "longitud": -70.65
}
```

---

### `POST /asistencia/entrada-fallback` 🔒

Registra entrada desde móvil (fallback cuando la tablet no está disponible).

**Roles:** `pauta`, `libre`

**Body:**
```json
{
  "turno_id": "uuid",
  "instalacion_id": "uuid",
  "latitud": -33.45,
  "longitud": -70.65,
  "imei": "123456789012345"
}
```

---

### `POST /asistencia/entrada` 🔒

Entrada genérica (compatibilidad con clientes).

**Roles:** `pauta`, `libre`, `admin`

---

### `POST /asistencia/salida` 🔒

Registra la salida del guardia.

**Roles:** `pauta`, `libre`, `admin`

**Body:**
```json
{
  "asistencia_id": "uuid",
  "latitud": -33.45,
  "longitud": -70.65
}
```

---

### `POST /asistencia/sync`

Sincroniza registros de asistencia generados en modo offline.

**Body:**
```json
{
  "registros": [ { ... } ]
}
```

---

### `GET /asistencia/hoy/:instalacionId` 🔒

Obtiene todos los marcajes del día para una instalación.

**Roles:** `supervisor`, `central`, `admin`

---

### `GET /asistencia/historial/:usuarioId` 🔒

Obtiene el historial de asistencia de un guardia.

**Roles:** `pauta`, `libre`, `supervisor`, `central`, `admin`

---

## 🚨 Novedades / Incidentes (`/api/v1/novedades`)

### `GET /novedades` 🔒

Lista novedades. Supervisor ve solo las de su instalación; central/admin ven todas.

**Roles:** todos

**Query params:** `instalacionId`, `estado`, `urgencia`, `page`, `limit`

---

### `GET /novedades/:id` 🔒

Obtiene el detalle de una novedad.

**Roles:** todos

---

### `POST /novedades` 🔒

Reporta un nuevo incidente. Soporta subida de foto (`multipart/form-data`).

**Roles:** `pauta`, `libre`

**Body (form-data):**

| Campo        | Tipo   | Descripción |
|--------------|--------|-------------|
| `turno_id`   | string | UUID del turno activo |
| `instalacion_id` | string | UUID de la instalación |
| `tipo`       | string | Tipo de incidente |
| `descripcion`| string | Descripción detallada |
| `urgencia`   | string | `verde` \| `amarillo` \| `rojo` |
| `latitud`    | float  | Coordenada GPS |
| `longitud`   | float  | Coordenada GPS |
| `foto`       | file   | Imagen (máx. 10 MB) |

---

### `PATCH /novedades/:id/resolver` 🔒

Marca una novedad como resuelta.

**Roles:** `supervisor`, `central`, `admin`

**Body:**
```json
{
  "comentario_cierre": "Situación normalizada, se realizó ronda adicional."
}
```

---

### `PATCH /novedades/:id/escalar` 🔒

Escala una novedad a central.

**Roles:** `supervisor`

---

## 📋 Solicitudes (`/api/v1/solicitudes`)

### `GET /solicitudes` 🔒

Lista solicitudes. GGSS ve solo las propias; supervisores/admin ven todas.

**Roles:** todos

**Query params:** `tipo`, `estado`, `page`, `limit`

---

### `POST /solicitudes` 🔒

Crea una solicitud de vacaciones, días libres, turno extra o traslado.

**Roles:** `pauta`, `libre`

**Body:**
```json
{
  "tipo": "vacaciones",
  "fecha_desde": "2026-06-01",
  "fecha_hasta": "2026-06-07",
  "motivo": "Vacaciones anuales programadas"
}
```

**Tipos válidos:** `vacaciones` | `dias_libres` | `turno_extra` | `traslado` | `turno`

---

### `PATCH /solicitudes/:id/aprobar` 🔒

Aprueba una solicitud.

**Roles:** `supervisor`, `admin`

**Body:**
```json
{
  "comentario_revision": "Aprobado. Se confirma disponibilidad."
}
```

---

### `PATCH /solicitudes/:id/rechazar` 🔒

Rechaza una solicitud.

**Roles:** `supervisor`, `admin`

**Body:**
```json
{
  "comentario_revision": "No hay personal disponible para reemplazar."
}
```

---

## 📊 Dashboard (`/api/v1/dashboard`)

### `GET /dashboard/hoy` 🔒

Resumen operacional del día. Supervisor ve su instalación; central/admin ven todo.

**Roles:** `supervisor`, `central`, `admin`

**Respuesta:**
```json
{
  "guardias_activos": 12,
  "guardias_esperados": 15,
  "novedades_abiertas": 2,
  "cumplimiento": 80,
  "instalaciones": [ { ... } ]
}
```

---

### `GET /dashboard/supervisores` 🔒

Estado actual de todos los supervisores en sus instalaciones.

**Roles:** `central`, `admin`

---

## 📈 Reportes (`/api/v1/reportes`)

### `GET /reportes/asistencia` 🔒

Reporte tabular de asistencia con filtros de rango de fechas.

**Roles:** `supervisor`, `admin`

**Query params:** `instalacionId`, `desde`, `hasta`, `usuarioId`

---

### `GET /reportes/incidentes` 🔒

Reporte tabular de incidentes/novedades.

**Roles:** `supervisor`, `admin`

---

### `GET /reportes/semana` 🔒

Agregaciones de asistencia por día para gráficos semanales.

**Roles:** `supervisor`, `admin`

---

### `GET /reportes/estado` 🔒

Estado del día: presentes, ausentes, tardíos.

**Roles:** `supervisor`, `admin`

---

### `GET /reportes/mensual` 🔒

Reporte mensual de KPIs: puntualidad, cumplimiento de rondas, incidentes.

**Roles:** `supervisor`, `admin`

---

### `GET /reportes/exportar/:tipo` 🔒

Descarga un reporte en formato CSV o Excel.

**Roles:** `supervisor`, `admin`

**Path params:** `tipo` = `asistencia` | `incidentes` | `turnos`

**Query params:** `desde`, `hasta`, `instalacionId`, `formato` (`csv` | `xlsx`)

---

## 🔍 Auditoría (`/api/v1/auditoria`)

### `GET /auditoria` 🔒

Lista todos los registros de auditoría del sistema.

**Roles:** `admin`

**Query params:** `usuarioId`, `accion`, `tabla`, `desde`, `hasta`, `page`, `limit`

**Respuesta:**
```json
{
  "data": [
    {
      "id": "uuid",
      "usuario_id": "uuid",
      "accion": "crear",
      "tabla_afectada": "usuarios",
      "registro_id": "uuid",
      "valores_antes": null,
      "valores_despues": { ... },
      "ip_address": "192.168.1.1",
      "created_at": "2026-04-17T12:00:00.000Z"
    }
  ],
  "total": 1000,
  "page": 1
}
```
