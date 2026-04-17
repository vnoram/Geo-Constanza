# 🛡️ Geo Constanza

> **Plataforma integral de gestión y monitoreo de personal de seguridad privada**

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 Descripción

**Geo Constanza** es una solución SaaS especializada en la **gestión operacional y monitoreo en tiempo real** de guardias de seguridad privada. 

A diferencia de sistemas tradicionales, Geo Constanza integra:

- ✅ **Monitoreo geolocalizado** en tiempo real con validación de geofencing
- ✅ **Control de asistencia** mediante tablet en instalación (95%) + fallback móvil (5%)
- ✅ **Gestión inteligente de turnos** con algoritmo 4x4 automatizado
- ✅ **Sistema de alertas** para incidentes críticos y anomalías
- ✅ **BI avanzado** con KPIs de desempeño operacional
- ✅ **RBAC granular** para 5 roles distintos (Pauta, Libre, Supervisor, Central, Admin)

**Cumple con la Ley N° 21.659** de Seguridad Privada vigente desde noviembre de 2025.

---

## 🎯 Características Principales

### 🔐 Seguridad y Control
- Autenticación JWT con 2FA opcional
- RBAC (Control de Acceso Basado en Roles)
- Auditoría inmutable de todos los cambios
- Validación de dispositivos por IMEI
- Encriptación de datos sensibles

### 📊 Monitoreo y Análisis
- Dashboard en tiempo real para Central
- Mapa de ubicaciones GPS en vivo
- KPIs de desempeño operacional
- Reportería automatizada
- Análisis de tendencias históricas

### 👥 Gestión de Personal
- Creación y administración de usuarios por rol
- Asignación automática de turnos (pauta 4x4)
- Solicitudes de vacaciones/cambios/turnos extras
- Gestión de instalaciones y supervisores
- Documentación digital de empleados

### 📱 Aplicaciones Móviles
- **App Tablet (Kiosk)**: Entrada/salida sin contacto
- **App Móvil Empresa**: Reporte de incidentes en tiempo real
- **App Móvil Personal**: Solicitud de turnos y disponibilidad

### ⚙️ Operacional
- Escalamiento automático de incidentes
- Notificaciones push inteligentes
- Integración con servicios externos (Firebase, AWS S3)
- Respaldos automáticos
- Modo fallback para contingencias

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    GEO CONSTANZA STACK                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FRONTEND                BACKEND                  DATOS    │
│  ┌──────────────┐       ┌──────────────┐       ┌─────────┐ │
│  │ React 18     │       │ Node.js 18+  │       │ Postgres│ │
│  │ Vite         │◄────►│ Express      │◄─────►│ Prisma  │ │
│  │ Styled Comp. │       │ Socket.io    │       │ PostGIS │ │
│  └──────────────┘       └──────────────┘       └─────────┘ │
│                                │                             │
│                        ┌───────┴───────┐                    │
│                        │               │                    │
│                     ┌──────────┐   ┌──────────┐            │
│                     │  Redis   │   │ Firebase │            │
│                     │  (caché) │   │  (push)  │            │
│                     └──────────┘   └──────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Inicio Rápido

### Requisitos Previos

- **Node.js** v18 o superior
- **PostgreSQL** 14 o superior
- **Docker** (opcional, para bases de datos locales)
- **Git** para clonar el repositorio

### Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tuusuario/geo-constanza.git
   cd geo-constanza
   ```

2. **Instalar dependencias**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend (si aplica)
   cd ../frontend
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env.local
   # Editar .env.local con tus credenciales
   ```

4. **Inicializar base de datos**
   ```bash
   cd backend
   npx prisma migrate dev --name init
   npx prisma db seed  # Opcional: cargar datos de prueba
   ```

5. **Iniciar desarrollo**
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run dev
   
   # Terminal 2: Frontend
   cd frontend
   npm run dev
   ```

6. **Acceder a la aplicación**
   - Frontend: `http://localhost:5173`
   - API: `http://localhost:3005`
   - Documentación API: `http://localhost:3005/api/docs`

---

## 📁 Estructura del Proyecto

```
geo-constanza/
├── backend/
│  ├── src/
│  │  ├── controllers/       # Lógica de endpoints
│  │  ├── services/          # Lógica de negocio
│  │  ├── middlewares/       # Auth, RBAC, errores
│  │  ├── routes/            # Definición de rutas
│  │  ├── validators/        # Validaciones de entrada
│  │  ├── config/            # Configuración (DB, JWT, Redis)
│  │  └── app.ts             # Aplicación principal
│  ├── prisma/
│  │  ├── schema.prisma      # Definición de modelos
│  │  └── migrations/        # Historial de cambios BD
│  ├── .env.example
│  └── package.json
│
├── frontend/
│  ├── src/
│  │  ├── components/        # Componentes React
│  │  ├── pages/             # Páginas por rol
│  │  ├── hooks/             # Custom hooks
│  │  ├── services/          # Llamadas a API
│  │  ├── styles/            # Estilos globales
│  │  └── App.tsx            # Aplicación principal
│  └── package.json
│
├── docs/
│  ├── ARQUITECTURA.md       # Detalles técnicos
│  ├── API.md                # Documentación de endpoints
│  └── GUIA_DESARROLLO.md    # Guía para contribuidores
│
└── README.md
```

---

## 🔑 Variables de Entorno

### Backend (.env.local)

```env
# SERVIDOR
PORT=3005
NODE_ENV=development

# BASE DE DATOS
DATABASE_URL="postgresql://user:password@localhost:5432/geo_constanza"

# REDIS
REDIS_URL="redis://localhost:6379"

# JWT
JWT_ACCESS_SECRET=tu_secreto_access_token_aqui
JWT_REFRESH_SECRET=tu_secreto_refresh_token_aqui
JWT_ACCESS_EXPIRY_GGSS=30m
JWT_ACCESS_EXPIRY_SUPERVISOR=2h
JWT_ACCESS_EXPIRY_ADMIN=4h
JWT_REFRESH_EXPIRY=7d

# FIREBASE
FIREBASE_PROJECT_ID=tu_proyecto_firebase
FIREBASE_PRIVATE_KEY=tu_clave_privada
FIREBASE_CLIENT_EMAIL=tu_email_firebase

# AWS S3
S3_BUCKET=geo-constanza-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY=tu_access_key
S3_SECRET_KEY=tu_secret_key

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:8081

# RATE LIMITING
RATE_LIMIT_PUBLIC=100
RATE_LIMIT_AUTHENTICATED=500
```

---

## 👥 Roles y Permisos

### 5 Roles Definidos

| Rol | Dispositivo | Funciones Principales |
|-----|-------------|----------------------|
| **GGSS En Pauta** | Tablet + Móvil Empresa | Marcar entrada/salida, reportar novedades |
| **GGSS Libre** | Móvil Personal | Solicitar turnos, pedir vacaciones, traslados |
| **Supervisor** | Móvil Profesional | Monitoreo de instalación, aprobar solicitudes |
| **Central** | Web (PC) | Monitoreo global, gestión de incidentes, BI |
| **Admin** | Web (PC) | Configuración, CRUD usuarios, respaldos |

**Documentación detallada:** Ver [`docs/ROLES.md`](docs/ROLES.md)

---

## 🔄 Flujos Principales

### 1. Marcar Entrada/Salida (GGSS En Pauta)
```
TABLET (95%)              MÓVIL FALLBACK (5%)
┌──────────────┐         ┌──────────────┐
│ Lee QR       │         │ Abre app     │
│ Valida turno │ ───────►│ Toca botón   │
│ Marca entrada│         │ Marca entrada│
│ Flag: false  │         │ Flag: true   │
└──────────────┘         └──────────────┘
```

### 2. Solicitar Turno (GGSS Libre)
```
GGSS Libre         Supervisor           Sistema
┌─────────┐        ┌──────────┐       ┌────────┐
│ Solicita│───────►│ Revisa   │──────►│ Aprueba│
│ turno   │        │ Aprueba/ │       │ Notif. │
└─────────┘        │ Rechaza  │       └────────┘
                   └──────────┘
```

### 3. Reportar Incidente (GGSS En Pauta)
```
GGSS En Pauta      Sistema              Supervisor    Central
┌─────────┐       ┌────────┐          ┌──────────┐  ┌────────┐
│ Reporta │──────►│ Asigna │─────────►│ Ve alerta│─►│ Si es  │
│ incidente│      │ prioridad          │ Contacta│   │ crítica│
└─────────┘       └────────┘          └──────────┘  └────────┘
                                      ↓
                                  Marcar resuelta
```

---

## 🧪 Testing

```bash
# Backend
cd backend
npm run test                # Ejecutar tests
npm run test:watch         # Modo observación
npm run test:coverage      # Cobertura

# Frontend
cd frontend
npm run test               # Ejecutar tests
npm run test:watch        # Modo observación
```

---

## 📚 Documentación

- **[ARQUITECTURA.md](docs/ARQUITECTURA.md)** - Detalle técnico de la solución
- **[API.md](docs/API.md)** - Documentación completa de endpoints
- **[ROLES.md](docs/ROLES.md)** - Definición de roles y permisos
- **[GUIA_DESARROLLO.md](docs/GUIA_DESARROLLO.md)** - Guía para desarrolladores
- **[CHANGELOG.md](CHANGELOG.md)** - Historial de cambios

---

## 🚢 Deployment

### Producción (Railway + Vercel)

```bash
# 1. Backend en Railway
git push railway main

# 2. Frontend en Vercel
vercel --prod

# 3. Database migrations (automáticas)
npx prisma migrate deploy
```

### Docker (Local o Cloud)

```bash
docker-compose up -d

# Acceder
# - API: http://localhost:3005
# - Frontend: http://localhost:5173
# - DB: localhost:5432
```

---

## 🤝 Contribuir

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

**Antes de contribuir, lee [GUIA_DESARROLLO.md](docs/GUIA_DESARROLLO.md)**

---

## 📊 KPIs y Objetivos

| KPI | Meta | Estado |
|-----|------|--------|
| % Cumplimiento de Rondas | 90% | En seguimiento |
| Tasa de Puntualidad | 95% | En seguimiento |
| Tiempo de Respuesta Incidentes | <10 min | En seguimiento |
| Disponibilidad del Sistema | 99.5% | En seguimiento |

---

## 🛠️ Stack Tecnológico

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **ORM**: Prisma
- **Real-time**: Socket.io
- **Autenticación**: JWT + 2FA
- **Base de Datos**: PostgreSQL + PostGIS
- **Cache**: Redis
- **Testing**: Jest + Supertest

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Styled Components
- **HTTP Client**: Axios
- **State Management**: Context API
- **Maps**: Leaflet + OpenStreetMap

### Infraestructura
- **API**: Railway
- **Frontend**: Vercel
- **Database**: Supabase (PostgreSQL)
- **File Storage**: AWS S3
- **Push Notifications**: Firebase Cloud Messaging
- **Monitoring**: (Por definir)

---

## 📞 Soporte

- **Issues**: [GitHub Issues](https://github.com/tuusuario/geo-constanza/issues)
- **Email**: support@geoconstanza.com
- **Documentación**: [docs/](docs/)

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver [`LICENSE`](LICENSE) para más detalles.

---

## 👨‍💼 Autor

**Desarrollado por:** Victor Norambuena / Testigos de Washo  
**Institución:** INACAP - Carrera de Ingeniería en Informática  

---

## 🙏 Agradecimientos

- INACAP por el apoyo académico
- Comunidad de software libre
- Todos los contribuidores
- Mi polola Texia Constanza Lefian Aucapan

---

## 📈 Roadmap

- [ ] Fase 1 (MVP): Core operativo
- [ ] Fase 2: Real-time con Socket.io
- [ ] Fase 3: BI avanzado
- [ ] Fase 4: Mobile nativa
- [ ] Fase 5: Integraciones con nómina

Ver [ROADMAP.md](docs/ROADMAP.md) para más detalles.

---

**Última actualización:** 17 de abril de 2026  
**Versión:** 1.0.0-beta

---

<div align="center">

Hecho con ❤️ para mejorar la seguridad en Chile

[⬆ Volver al inicio](#-geo-constanza)

</div>
