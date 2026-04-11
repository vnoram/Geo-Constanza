# Geo Constanza — Documentación Técnica

> **Plataforma de Gestión Operacional de Seguridad Privada**

---

## Tabla de Contenidos

1. [Descripción General](#1-descripción-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Modelos de Datos](#4-modelos-de-datos)
5. [Backend — API REST](#5-backend--api-rest)
   - [Configuración y Puesta en Marcha](#51-configuración-y-puesta-en-marcha)
   - [Variables de Entorno](#52-variables-de-entorno)
   - [Middlewares](#53-middlewares)
   - [Endpoints](#54-endpoints)
6. [Frontend — Aplicación Web](#6-frontend--aplicación-web)
   - [Roles y Vistas](#61-roles-y-vistas)
   - [Flujo de Autenticación](#62-flujo-de-autenticación)
7. [Funcionalidades Clave](#7-funcionalidades-clave)
   - [Validación Geográfica (Geofencing)](#71-validación-geográfica-geofencing)
   - [Tiempo Real con Socket.IO](#72-tiempo-real-con-socketio)
   - [Auditoría](#73-auditoría)
8. [Seguridad](#8-seguridad)
9. [Despliegue](#9-despliegue)

---

## 1. Descripción General

**Geo Constanza** es una plataforma web full-stack diseñada para la gestión operacional de empresas de seguridad privada. Permite administrar guardias, instalaciones, turnos, asistencia con geolocalización, novedades (incidentes), solicitudes de personal y reportes, todo con control de acceso basado en roles (RBAC).

### Roles del Sistema

| Rol | Descripción |
|---|---|
| `pauta` | Guardia con turno programado (marcaje de asistencia, reporte de novedades) |
| `libre` | Guardia en régimen libre (solicitudes de turno extra, vacaciones, traslados) |
| `supervisor` | Supervisa instalaciones asignadas, revisa novedades y solicitudes |
| `admin` | Acceso completo: gestión de usuarios, instalaciones, turnos y auditoría |

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                        CLIENTE                          │
│           React 19 + Vite  (frontend/)                  │
│     Vercel / hosting estático                           │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                       SERVIDOR                          │
│         Express.js API  (backend/src/)                  │
│         Puerto: 3005 (configurable)                     │
│         Railway                                         │
├──────────────────────┬──────────────────────────────────┤
│    PostgreSQL (Prisma ORM)   │   Redis (blacklist JWT)  │
└──────────────────────────────────────────────────────────┘
```

El frontend y el backend se comunican mediante:
- **REST API** bajo el prefijo `/api/v1/`
- **WebSockets** (Socket.IO) para eventos en tiempo real

---

## 3. Stack Tecnológico

### Backend

| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | ≥ 20 | Runtime |
| Express.js | ^4.21 | Framework HTTP |
| Prisma | ^7.7 | ORM (PostgreSQL) |
| PostgreSQL | — | Base de datos relacional |
| Redis (ioredis) | ^5.4 | Blacklist de tokens JWT |
| Socket.IO | ^4.8 | Comunicación en tiempo real |
| JWT (jsonwebtoken) | ^9.0 | Autenticación |
| otplib | ^12.0 | Autenticación de dos factores (2FA) |
| bcryptjs | ^2.4 | Hash de contraseñas |
| Firebase Admin | ^13.0 | Notificaciones push (FCM) |
| Zod | ^3.24 | Validación de esquemas |
| Multer | ^1.4 | Subida de archivos (fotos de novedades) |
| Winston | ^3.17 | Logging |
| Helmet | ^8.0 | Cabeceras de seguridad HTTP |
| express-rate-limit | ^7.5 | Limitación de tasa |

### Frontend

| Tecnología | Versión | Uso |
|---|---|---|
| React | ^19.2 | UI |
| Vite | ^8.0 | Bundler y servidor de desarrollo |
| Socket.IO Client | ^4.8 | WebSocket cliente |

---

## 4. Modelos de Datos

La base de datos PostgreSQL está gestionada con **Prisma**. A continuación se describen las entidades principales.

### Usuario
Representa a todos los actores del sistema (guardias, supervisores, administradores).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `rut` | String (único) | RUT chileno |
| `nombre` | String | Nombre completo |
| `email` | String (único) | Correo electrónico |
| `telefono` | String? | Teléfono opcional |
| `password_hash` | String | Contraseña hasheada con bcrypt |
| `rol` | String | `pauta` / `libre` / `supervisor` / `admin` |
| `estado` | String | `activo` / `inactivo` |
| `two_factor_secret` | String? | Secreto TOTP para 2FA |
| `created_at` | DateTime | Fecha de creación |
| `updated_at` | DateTime | Última actualización |

---

### Instalacion
Recintos o lugares que deben ser resguardados por el personal de seguridad.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `nombre` | String | Nombre del recinto |
| `direccion` | String? | Dirección |
| `latitud` | Float | Coordenada GPS |
| `longitud` | Float | Coordenada GPS |
| `radio_geofence_m` | Int | Radio de geofence en metros (defecto: 100 m) |
| `tipo_recinto` | String? | Tipo de instalación |
| `nivel_criticidad` | String | `Alta` / `Media` / `Baja` |
| `estado` | String | `activo` / `inactivo` |

---

### Turno
Programación de guardias en instalaciones específicas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `usuario_id` | UUID | Guardia asignado |
| `instalacion_id` | UUID | Instalación del turno |
| `fecha` | Date | Fecha del turno |
| `hora_inicio` | String | Ej: `"06:00"` |
| `hora_fin` | String | Ej: `"14:00"` |
| `tipo_turno` | String | `normal` / `extra` |
| `estado` | String | `programado` / `completado` / `cancelado` |
| `motivo_cancelacion` | String? | Razón de cancelación |

---

### Asistencia
Registro de marcajes reales de entrada y salida.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `usuario_id` | UUID | Guardia |
| `turno_id` | UUID | Turno asociado |
| `instalacion_id` | UUID | Instalación |
| `hora_entrada` | DateTime | Timestamp de entrada |
| `hora_salida` | DateTime? | Timestamp de salida |
| `metodo_entrada` | String | `totem` / `fallback_telefono` |
| `estado` | String | `normal` / `tardio` |
| `minutos_retraso` | Int | Minutos de atraso |
| `latitud_entrada` | Float? | Coordenada GPS de entrada |
| `longitud_entrada` | Float? | Coordenada GPS de entrada |
| `es_fallback` | Boolean | Si fue marcaje manual |
| `horas_trabajadas` | Float? | Total de horas efectivas |
| `horas_extra` | Float? | Horas extra trabajadas |

---

### Novedad
Incidentes o eventos reportados por los guardias durante su turno.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `tipo` | String | Tipo de novedad |
| `descripcion` | String | Descripción del incidente |
| `urgencia` | String | `verde` / `amarillo` / `rojo` |
| `foto_url` | String? | URL de imagen adjunta |
| `latitud` / `longitud` | Float? | Ubicación del incidente |
| `estado` | String | `abierta` / `escalada` / `resuelta` |
| `atendida_por` | String? | Supervisor que atendió |
| `fecha_atencion` | DateTime? | Cuándo fue atendida |

---

### Solicitud
Peticiones de personal (vacaciones, permisos, traslados, turnos extra).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `tipo` | String | `Vacaciones` / `Traslado` / `Turno Extra` |
| `fechas` | String | Período solicitado |
| `motivo` | String? | Justificación |
| `estado` | String | `Pendiente` / `Aprobada` / `Rechazada` |
| `revisada_por` | UUID? | Supervisor revisor |
| `comentario_revision` | String? | Observaciones |

---

### Auditoria
Registro inmutable de todas las acciones sensibles del sistema.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `usuario_id` | UUID | Usuario que realizó la acción |
| `accion` | String | Ej: `LOGIN`, `CREAR_TURNO`, `APROBAR_SOL` |
| `tabla_afectada` | String | Tabla de BD impactada |
| `registro_id` | String | ID del registro modificado |
| `valores_antes` | JSON? | Estado anterior del registro |
| `valores_despues` | JSON? | Estado posterior |
| `ip_address` | String? | IP del cliente |
| `user_agent` | String? | Navegador/dispositivo |

---

## 5. Backend — API REST

### 5.1 Configuración y Puesta en Marcha

```bash
# Instalar dependencias
cd backend
npm install

# Configurar variables de entorno (ver sección 5.2)
cp .env.example .env

# Ejecutar migraciones de base de datos
npm run db:migrate

# Poblar datos iniciales
npm run db:seed

# Iniciar en desarrollo
npm run dev

# Iniciar en producción
npm start
```

### 5.2 Variables de Entorno

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (defecto: 3005) |
| `NODE_ENV` | `development` / `production` |
| `DATABASE_URL` | Cadena de conexión PostgreSQL |
| `REDIS_URL` | URL de Redis |
| `JWT_ACCESS_SECRET` | Secreto para tokens de acceso |
| `JWT_REFRESH_SECRET` | Secreto para tokens de refresco |
| `CORS_ORIGIN` | Orígenes permitidos (coma-separados) |

### 5.3 Middlewares

| Middleware | Función |
|---|---|
| `helmet` | Cabeceras HTTP de seguridad |
| `cors` | Control de orígenes cruzados |
| `compression` | Compresión gzip de respuestas |
| `morgan` | Logging HTTP de peticiones |
| `rateLimiter` | Límite de peticiones por IP |
| `authenticate` | Verifica JWT Bearer token |
| `authorize(...roles)` | Verifica rol del usuario (RBAC) |
| `auditLog` | Registra acciones en tabla Auditoria |
| `errorHandler` | Manejador centralizado de errores |

### 5.4 Endpoints

Todas las rutas protegidas requieren el header:
```
Authorization: Bearer <token>
```

---

#### 🔐 Autenticación — `/api/v1/auth`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `POST` | `/login` | Público | Iniciar sesión. Retorna `accessToken` y `refreshToken` |
| `POST` | `/password/reset` | Público | Solicitar restablecimiento de contraseña |
| `POST` | `/refresh` | Autenticado | Renovar token de acceso |
| `POST` | `/logout` | Autenticado | Cerrar sesión (invalida token en Redis) |
| `POST` | `/2fa/verify` | Público | Verificar código TOTP de segundo factor |

**Login — Request:**
```json
{
  "rut": "12345678-9",
  "password": "mi_contraseña"
}
```

**Login — Response:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid",
    "nombre": "Juan Pérez",
    "rol": "supervisor"
  }
}
```

---

#### 👥 Usuarios — `/api/v1/usuarios`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/` | supervisor, admin | Listar todos los usuarios |
| `POST` | `/` | admin | Crear usuario |
| `PUT` | `/:id` | admin | Editar usuario |
| `PATCH` | `/:id/desactivar` | admin | Desactivar usuario |

---

#### 🏢 Instalaciones — `/api/v1/instalaciones`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/` | supervisor, admin | Listar instalaciones |
| `POST` | `/` | admin | Crear instalación |
| `PUT` | `/:id` | admin | Editar instalación |

---

#### 📅 Turnos — `/api/v1/turnos`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/` | todos | Listar turnos (filtrados por rol) |
| `GET` | `/conflictos` | supervisor, admin | Verificar conflictos de horario |
| `GET` | `/:id` | todos | Obtener detalle de turno |
| `POST` | `/` | supervisor, admin | Crear turno individual |
| `POST` | `/lote` | admin | Crear múltiples turnos en lote |
| `PUT` | `/:id` | supervisor, admin | Editar turno |
| `PATCH` | `/:id/cancelar` | supervisor, admin | Cancelar turno |

---

#### ✅ Asistencia — `/api/v1/asistencia`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `POST` | `/entrada` | pauta, libre, admin | Registrar marcaje de entrada (con GPS) |
| `POST` | `/salida` | pauta, libre, admin | Registrar marcaje de salida |
| `GET` | `/hoy/:instalacionId` | supervisor, admin | Ver asistencia del día en una instalación |
| `GET` | `/historial/:usuarioId` | todos | Ver historial de asistencia |
| `POST` | `/sync` | todos | Sincronizar marcajes offline |

**Entrada — Request:**
```json
{
  "turnoId": "uuid",
  "instalacionId": "uuid",
  "latitud": -33.4569,
  "longitud": -70.6483
}
```

---

#### 🚨 Novedades — `/api/v1/novedades`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/` | supervisor, admin | Listar novedades |
| `GET` | `/:id` | pauta, supervisor, admin | Ver detalle de novedad |
| `POST` | `/` | pauta | Crear novedad (con foto opcional, multipart/form-data) |
| `PATCH` | `/:id/resolver` | supervisor | Marcar como resuelta |
| `PATCH` | `/:id/escalar` | supervisor | Escalar la novedad |

---

#### 📋 Solicitudes — `/api/v1/solicitudes`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/` | libre, supervisor, admin | Listar solicitudes |
| `POST` | `/` | libre | Crear solicitud (vacaciones, traslado, turno extra) |
| `PATCH` | `/:id/aprobar` | supervisor | Aprobar solicitud |
| `PATCH` | `/:id/rechazar` | supervisor | Rechazar solicitud |

---

#### 📊 Dashboard — `/api/v1/dashboard`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/hoy` | supervisor, admin | Resumen operacional del día |

---

#### 📈 Reportes — `/api/v1/reportes`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/asistencia` | supervisor, admin | Reporte de asistencia con filtros |
| `GET` | `/incidentes` | supervisor, admin | Reporte de novedades/incidentes |
| `GET` | `/exportar/:tipo` | supervisor, admin | Exportar reporte (`asistencia` o `incidentes`) |

---

#### 🗂️ Auditoría — `/api/v1/auditoria`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/` | admin | Listar registros de auditoría |

---

#### ❤️ Health Check

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/health` | Estado del servidor. Retorna `{ "status": "ok", "timestamp": "..." }` |

---

## 6. Frontend — Aplicación Web

### 6.1 Roles y Vistas

El frontend adapta su interfaz según el rol del usuario autenticado.

#### Rol: `admin`
| Pantalla | Descripción |
|---|---|
| `AdminPanel` | Panel general de administración |
| `AdminUsuarios` | CRUD completo de usuarios |
| `AdminInstalaciones` | Gestión de recintos |
| `AdminTurnos` | Planificación masiva de turnos |
| `AdminAuditoria` | Visor de logs de auditoría |

#### Rol: `supervisor`
| Pantalla | Descripción |
|---|---|
| `SupDashboard` | Resumen operacional del día |
| `SupGuardias` | Estado de guardias en instalaciones |
| `SupNovedades` | Gestión de incidentes |
| `SupSolicitudes` | Aprobación/rechazo de solicitudes |
| `SupReportes` | Generación y exportación de reportes |

#### Rol: `pauta`
| Pantalla | Descripción |
|---|---|
| `PautaTurno` | Ver turno del día y marcar asistencia |
| `PautaNovedades` | Reportar incidentes |
| `PautaAlertas` | Ver alertas activas |
| `PautaHistorial` | Historial de asistencia personal |

#### Rol: `libre`
| Pantalla | Descripción |
|---|---|
| `LibreTurnos` | Ver turnos disponibles |
| `LibreSolicitudes` | Crear y ver solicitudes |
| `LibreDocs` | Documentos y normativas |

### 6.2 Flujo de Autenticación

```
Usuario → LoginScreen
  └─► POST /api/v1/auth/login
        ├─ Éxito → Guarda token en estado → AppShell (según rol)
        └─ 2FA requerido → Solicita código TOTP → POST /api/v1/auth/2fa/verify
```

El token JWT se envía en cada petición como `Bearer` en el header `Authorization`. El `AuthCtx` (Context API de React) expone `{ user, token, logout }` a todos los componentes.

---

## 7. Funcionalidades Clave

### 7.1 Validación Geográfica (Geofencing)

Al registrar asistencia, el sistema valida que el guardia esté físicamente en la instalación usando la **Fórmula de Haversine**.

```
distancia = Haversine(lat_guardia, lon_guardia, lat_instalacion, lon_instalacion)

si distancia <= radio_geofence_m → Marcaje VÁLIDO
si distancia >  radio_geofence_m → Marcaje RECHAZADO
```

- Radio configurable por instalación (campo `radio_geofence_m`, defecto: 100 m).
- Si el GPS falla, se habilita el **modo fallback** (`es_fallback: true`) para marcaje manual con aprobación posterior.

### 7.2 Tiempo Real con Socket.IO

El servidor mantiene conexiones WebSocket para notificaciones en tiempo real:

- **Novedades urgentes**: cuando un guardia reporta una novedad `rojo`, se emite un evento a los supervisores conectados.
- **Cambios de estado de turnos**: cancelaciones y actualizaciones se propagan al cliente.

```javascript
// Servidor
io.emit('novedad:nueva', { id, urgencia: 'rojo', instalacion });

// Cliente
socket.on('novedad:nueva', (data) => { /* mostrar alerta */ });
```

### 7.3 Auditoría

Todas las acciones sensibles quedan registradas automáticamente mediante el middleware `auditLog`:

- `LOGIN` / `LOGOUT`
- `CREAR_TURNO`, `CANCELAR_TURNO`
- `APROBAR_SOL`, `RECHAZAR_SOL`
- `CREAR_USUARIO`, `EDITAR_USUARIO`

Cada registro almacena el estado anterior y posterior del objeto (`valores_antes` / `valores_despues`), la IP del cliente y el User-Agent.

---

## 8. Seguridad

| Medida | Descripción |
|---|---|
| **JWT** | Tokens de corta duración (access) + refresh token |
| **Blacklist Redis** | Tokens inválidos tras logout se almacenan en Redis |
| **2FA TOTP** | Supervisores y admins requieren segundo factor (compatible con Google Authenticator) |
| **bcrypt** | Contraseñas hasheadas con sal |
| **RBAC** | Cada endpoint valida el rol mínimo requerido |
| **Helmet** | Cabeceras HTTP de seguridad (CSP, HSTS, etc.) |
| **Rate Limiting** | Máximo de peticiones por IP para prevenir fuerza bruta |
| **CORS** | Orígenes permitidos configurables vía variable de entorno |
| **Zod** | Validación estricta de entrada en todos los endpoints |

---

## 9. Despliegue

### Backend (Railway)

El archivo `railway.json` configura el despliegue automático en Railway:

```bash
# Variables de entorno requeridas en Railway:
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
NODE_ENV=production
CORS_ORIGIN=https://tu-frontend.vercel.app
```

El comando de inicio es:
```bash
npm start  # node src/server.js
```

### Frontend (Vercel)

El archivo `vercel.json` configura el despliegue en Vercel:

```bash
cd frontend
npm run vercel-build  # vite build
```

Las rutas SPA se redirigen a `index.html` para compatibilidad con React Router.

---

## Scripts Disponibles

### Backend

```bash
npm run dev          # Servidor con nodemon (recarga automática)
npm start            # Servidor de producción
npm test             # Tests con Jest + cobertura
npm run test:watch   # Tests en modo watch
npm run lint         # ESLint
npm run lint:fix     # ESLint con corrección automática
npm run db:migrate   # Migraciones Prisma
npm run db:seed      # Poblar BD con datos iniciales
npm run db:studio    # Prisma Studio (UI de BD)
npm run db:generate  # Generar cliente Prisma
```

### Frontend

```bash
npm run dev      # Servidor de desarrollo Vite (http://localhost:5173)
npm run build    # Build de producción
npm run preview  # Preview del build de producción
npm run lint     # ESLint
```

---

*Documentación generada para Geo Constanza v1.0.0*
