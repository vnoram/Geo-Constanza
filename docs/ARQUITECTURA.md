# 🏗️ Arquitectura Técnica — Geo Constanza

## Visión General

Geo Constanza es una aplicación SaaS de arquitectura cliente-servidor con comunicación en tiempo real. Está compuesta por tres capas principales:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GEO CONSTANZA STACK                          │
├──────────────────┬──────────────────────┬───────────────────────────┤
│    FRONTEND       │      BACKEND          │         DATOS             │
│  React 19 + Vite  │  Node.js + Express    │  PostgreSQL (Supabase)    │
│  (Vercel)         │  Socket.io            │  Prisma ORM               │
│                   │  (Railway)            │  Redis (caché/blacklist)  │
└──────────────────┴──────────────────────┴───────────────────────────┘
                            │
              ┌─────────────┴──────────────┐
              │  Servicios Externos         │
              │  Firebase (push)            │
              │  AWS S3 (archivos)          │
              └────────────────────────────┘
```

---

## Backend

### Stack

| Componente       | Tecnología            | Versión  |
|------------------|-----------------------|----------|
| Runtime          | Node.js               | ≥ 20     |
| Framework HTTP   | Express               | 4.x      |
| ORM              | Prisma                | 7.x      |
| Base de datos    | PostgreSQL (Supabase) | 14+      |
| WebSockets       | Socket.io             | 4.x      |
| Caché / Sesiones | Redis (ioredis)       | 5.x      |
| Autenticación    | JWT (jsonwebtoken)    | 9.x      |
| Notificaciones   | Firebase Admin SDK    | 13.x     |
| Almacenamiento   | AWS S3 (multer)       | —        |
| Logging          | Winston               | 3.x      |
| Validaciones     | Zod                   | 3.x      |
| Seguridad HTTP   | Helmet + CORS         | 8.x      |
| Rate limiting    | express-rate-limit    | 7.x      |

### Estructura de directorios

```
backend/
├── src/
│   ├── server.js            # Punto de entrada; valida env vars, inicia HTTP + Socket
│   ├── app.js               # Configura Express, middlewares y monta rutas
│   ├── config/
│   │   ├── database.js      # Instancia Prisma Client (singleton)
│   │   ├── jwt.js           # Configuración de expiración de tokens por rol
│   │   ├── redis.js         # Conexión opcional a Redis (blacklist de tokens)
│   │   ├── firebase.js      # Inicialización de Firebase Admin
│   │   ├── s3.js            # Cliente AWS S3
│   │   └── logger.js        # Instancia Winston
│   ├── routes/              # Definición de rutas por dominio
│   ├── controllers/         # Reciben req/res, llaman al service, devuelven JSON
│   ├── services/            # Lógica de negocio (Prisma, validaciones complejas)
│   ├── middlewares/
│   │   ├── auth.js          # Verifica JWT; adjunta req.user
│   │   ├── rbac.js          # authorize(...roles) — deniega si el rol no coincide
│   │   ├── auditLog.js      # Registra acciones en tabla Auditoria
│   │   ├── errorHandler.js  # Captura errores globales, responde con JSON estandarizado
│   │   └── rateLimiter.js   # Límite de peticiones por IP
│   └── socket/
│       └── socketManager.js # Inicializa Socket.io, gestiona rooms por instalación
├── prisma/
│   ├── schema.prisma        # Modelos de la base de datos
│   ├── seed.js              # Datos iniciales de prueba
│   └── migrations/          # Historial de migraciones
└── package.json
```

### Ciclo de vida de una petición HTTP

```
Cliente
  │
  ▼
rateLimiter         ← bloquea si supera límite de IP
  │
  ▼
authenticate        ← verifica JWT; consulta blacklist en Redis
  │
  ▼
authorize(roles)    ← verifica que req.user.rol sea permitido
  │
  ▼
Controller          ← valida body básico, llama al service
  │
  ▼
Service             ← lógica de negocio, consultas Prisma
  │
  ▼
errorHandler        ← captura excepciones, responde con { error }
```

### Comunicación en tiempo real (Socket.io)

Eventos disponibles:

| Evento (cliente → servidor) | Descripción |
|-----------------------------|-------------|
| `join:instalacion`          | Une al socket a la room `instalacion:<id>` |
| `leave:instalacion`         | Abandona la room |

| Evento (servidor → cliente) | Descripción |
|-----------------------------|-------------|
| `novedad:nueva`             | Nueva novedad reportada en una instalación |
| `asistencia:update`         | Cambio de estado de asistencia |

---

## Frontend

### Stack

| Componente       | Tecnología            | Versión  |
|------------------|-----------------------|----------|
| Framework        | React                 | 19.x     |
| Build tool       | Vite                  | 8.x      |
| WebSockets       | socket.io-client      | 4.x      |
| HTTP Client      | fetch nativo (api.js) | —        |
| Estado global    | Context API           | —        |
| Deploy           | Vercel                | —        |

### Estructura de directorios

```
frontend/src/
├── main.jsx                  # Monta <GeoConstanzaApp />
├── App.jsx                   # Provee AuthProvider globalmente
├── GeoConstanzaApp.jsx       # Router: LoginScreen o AppShell según sesión
├── context/
│   └── AuthContext.jsx       # AuthProvider + useAuth hook; persiste token en localStorage
├── services/
│   └── api.js                # Capa HTTP: login() sin token; get/post/put/patch/del con Bearer
├── hooks/
│   └── useLoginForm.js       # Lógica del formulario de login
├── components/
│   ├── auth/                 # Componentes de autenticación
│   ├── layout/
│   │   └── AppShell.jsx      # Shell principal: sidebar + contenido por rol
│   └── ui/                   # Componentes reutilizables (botones, tarjetas, etc.)
├── screens/
│   ├── auth/
│   │   └── LoginScreen.jsx   # Pantalla de login universal
│   ├── admin/                # AdminPanel, AdminUsuarios, AdminTurnos, AdminInstalaciones, AdminAuditoria
│   ├── central/              # CentralPanel (dashboard global + incidentes)
│   ├── supervisor/           # SupDashboard, SupGuardias, SupNovedades, SupReportes, SupSolicitudes
│   ├── pauta/                # PautaTurno, PautaNovedades, PautaAlertas, PautaHistorial
│   └── libre/                # LibreTurnos, LibreSolicitudes, LibreDocs
├── utils/
│   └── cache.js              # cacheClearAll() — limpia datos cacheados al hacer logout
└── theme/                    # Tokens de diseño / estilos globales
```

### Flujo de autenticación en el frontend

```
Inicio de app
    │
    ▼
AuthProvider — restaura token desde localStorage
    │
    ▼
ready = true
    │
    ├── user == null → <LoginScreen>
    │       │
    │       └── onLogin(user, token) → guarda en ctx + localStorage
    │
    └── user != null → <AppShell rol={user.rol}>
              │
              └── renderiza screens según rol
```

---

## Base de datos

### Modelos Prisma

| Modelo                  | Descripción |
|-------------------------|-------------|
| `Usuario`               | Guardias, supervisores, central, admins |
| `Instalacion`           | Recintos a proteger (con coordenadas y radio de geofencing) |
| `Supervisor_Instalacion`| Tabla intermedia M:N supervisor ↔ instalación |
| `Turno`                 | Planificación de guardias (fecha, horario, instalación) |
| `Asistencia`            | Marcajes reales de entrada/salida |
| `Novedad`               | Incidentes reportados en turno |
| `Solicitud`             | Vacaciones, días libres, traslados, turnos extra |
| `Auditoria`             | Registro inmutable de todas las acciones del sistema |

### Relaciones clave

```
Usuario (1) ──────── (N) Turno
Usuario (1) ──────── (N) Asistencia
Usuario (1) ──────── (N) Novedad
Usuario (1) ──────── (N) Solicitud (como solicitante)
Usuario (1) ──────── (N) Solicitud (como revisor)
Usuario (1) ──────── (N) Supervisor_Instalacion
Instalacion (1) ──── (N) Turno
Instalacion (1) ──── (N) Asistencia
Instalacion (1) ──── (N) Novedad
Instalacion (1) ──── (N) Supervisor_Instalacion
Turno (1) ─────────── (N) Asistencia
Turno (1) ─────────── (N) Novedad
```

---

## Infraestructura de despliegue

| Servicio        | Proveedor   | Descripción |
|-----------------|-------------|-------------|
| API REST        | Railway     | Deploy automático desde `main`; usa `railway.json` |
| Frontend        | Vercel      | Deploy automático; usa `vercel.json` |
| Base de datos   | Supabase    | PostgreSQL gestionado |
| Caché / Tokens  | Redis       | Blacklist de JWT + caché de consultas frecuentes |
| Archivos        | AWS S3      | Fotos de novedades y documentos de guardias |
| Push            | Firebase    | Notificaciones a dispositivos móviles y tablet |

### Variables de entorno requeridas (Backend)

| Variable                    | Descripción |
|-----------------------------|-------------|
| `DATABASE_URL`              | Connection string PostgreSQL |
| `JWT_ACCESS_SECRET`         | Secreto para firmar access tokens |
| `JWT_REFRESH_SECRET`        | Secreto para firmar refresh tokens |
| `FRONTEND_URL`              | Origen permitido en CORS (producción) |
| `REDIS_URL`                 | URL de Redis (opcional; se degrada si no está) |
| `FIREBASE_PROJECT_ID`       | ID del proyecto Firebase |
| `FIREBASE_PRIVATE_KEY`      | Clave privada Firebase Admin |
| `FIREBASE_CLIENT_EMAIL`     | Email de servicio Firebase |
| `S3_BUCKET`                 | Nombre del bucket S3 |
| `S3_REGION`                 | Región AWS |
| `S3_ACCESS_KEY`             | Access Key AWS |
| `S3_SECRET_KEY`             | Secret Key AWS |
| `PORT`                      | Puerto del servidor (default: 3005) |
| `NODE_ENV`                  | `development` \| `production` |

### Variables de entorno requeridas (Frontend)

| Variable        | Descripción |
|-----------------|-------------|
| `VITE_API_URL`  | URL base de la API (ej. `https://api.geoconstanza.app/api/v1`) |

---

## Seguridad

- **JWT con blacklist**: al hacer logout, el token se agrega a Redis con TTL igual a su expiración restante.
- **RBAC granular**: cada endpoint declara los roles permitidos; el middleware `authorize()` valida en tiempo de ejecución.
- **Auditoría inmutable**: cada operación sensible registra `valores_antes` y `valores_despues` en la tabla `Auditoria`.
- **Helmet**: establece cabeceras HTTP de seguridad (CSP, HSTS, etc.).
- **Rate limiting**: protege endpoints públicos y autenticados contra abuso.
- **CORS estricto**: en producción solo se permite el origen definido en `FRONTEND_URL`.
- **Validación IMEI**: el dispositivo del guardia puede validarse por IMEI para prevenir accesos no autorizados.
- **2FA opcional**: disponible para roles `supervisor` y `admin` mediante OTP (otplib).
