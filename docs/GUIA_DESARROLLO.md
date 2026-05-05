# 🛠️ Guía de Desarrollo — Geo Constanza

## Requisitos previos

| Herramienta   | Versión mínima | Uso |
|---------------|----------------|-----|
| Node.js       | 20.x           | Runtime backend y frontend |
| npm           | 9.x            | Gestión de paquetes |
| PostgreSQL     | 14.x           | Base de datos |
| Git           | 2.x            | Control de versiones |
| Docker        | 20.x (opcional)| PostgreSQL / Redis local |

---

## Configuración del entorno local

### 1. Clonar el repositorio

```bash
git clone https://github.com/vnoram/Geo-Constanza.git
cd Geo-Constanza
```

### 2. Configurar el Backend

```bash
cd backend
npm install
```

Crea el archivo de variables de entorno:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales locales (ver sección de variables abajo).

### 3. Configurar la Base de Datos

Con Docker (recomendado para desarrollo local):

```bash
docker run --name geo-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=geo_constanza \
  -p 5432:5432 -d postgres:16
```

Ejecutar migraciones y seed de datos:

```bash
cd backend
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Configurar el Frontend

```bash
cd frontend
npm install
```

Crea `.env.local` en la carpeta `frontend/`:

```env
VITE_API_URL=http://localhost:3005/api/v1
```

### 5. Iniciar en modo desarrollo

En dos terminales paralelas:

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

**URLs de acceso:**
- Frontend: `http://localhost:5173`
- API: `http://localhost:3005/api/v1`
- Health check: `http://localhost:3005/api/v1/health`
- Prisma Studio: `npm run db:studio` → `http://localhost:5555`

---

## Variables de entorno

### Backend (`backend/.env.local`)

```env
# Servidor
PORT=3005
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Base de datos
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/geo_constanza"

# JWT (¡nunca commitear valores reales!)
JWT_ACCESS_SECRET=desarrollo_secret_acceso_cambiar_en_prod
JWT_REFRESH_SECRET=desarrollo_secret_refresh_cambiar_en_prod
JWT_ACCESS_EXPIRY_GGSS=30m
JWT_ACCESS_EXPIRY_SUPERVISOR=2h
JWT_ACCESS_EXPIRY_ADMIN=4h
JWT_REFRESH_EXPIRY=7d

# Redis (opcional en desarrollo)
# REDIS_URL=redis://localhost:6379

# Firebase (opcional en desarrollo, comentar si no se usa)
# FIREBASE_PROJECT_ID=
# FIREBASE_PRIVATE_KEY=
# FIREBASE_CLIENT_EMAIL=

# AWS S3 (opcional en desarrollo)
# S3_BUCKET=
# S3_REGION=
# S3_ACCESS_KEY=
# S3_SECRET_KEY=
```

### Frontend (`frontend/.env.local`)

```env
VITE_API_URL=http://localhost:3005/api/v1
```

---

## Scripts disponibles

### Backend

| Script             | Descripción |
|--------------------|-------------|
| `npm run dev`      | Inicia con nodemon (hot-reload) |
| `npm start`        | Inicia en modo producción |
| `npm test`         | Ejecuta tests con cobertura |
| `npm run test:watch` | Tests en modo observación |
| `npm run lint`     | Lint del código fuente |
| `npm run lint:fix` | Corrige problemas de lint automáticamente |
| `npm run db:migrate` | Ejecuta migraciones Prisma |
| `npm run db:seed`  | Carga datos iniciales de prueba |
| `npm run db:studio`| Abre Prisma Studio (GUI de BD) |
| `npm run db:generate` | Regenera el cliente Prisma |

### Frontend

| Script                | Descripción |
|-----------------------|-------------|
| `npm run dev`         | Inicia Vite en desarrollo |
| `npm run build`       | Build de producción |
| `npm run preview`     | Vista previa del build |
| `npm run lint`        | Lint del código |

---

## Estructura del código

### Backend — Convenciones

**Capas de responsabilidad:**

```
routes/      → define URLs y aplica middlewares (authenticate, authorize)
controllers/ → recibe req/res, llama al service, responde con JSON
services/    → toda la lógica de negocio (Prisma, validaciones complejas)
middlewares/ → funciones reutilizables entre rutas
config/      → inicialización de conexiones externas (DB, Redis, JWT, etc.)
```

**Reglas:**
- Los controllers **no** tienen lógica de negocio; solo transforman req → service → res.
- Los services **no** conocen `req` ni `res`; reciben parámetros tipados.
- Las validaciones de schema van en el service usando Zod cuando aplica.
- Los errores se propagan con `next(error)` para que `errorHandler` los gestione.
- Toda operación sensible llama a `registrarAuditoria()`.

**Nomenclatura de archivos:**
```
<dominio>.routes.js
<dominio>.controller.js
<dominio>.service.js
```

### Frontend — Convenciones

**Capas de responsabilidad:**

```
services/api.js    → toda comunicación HTTP (sin lógica de negocio)
context/           → estado global (AuthContext)
hooks/             → lógica de formularios y efectos reutilizables
screens/           → páginas completas agrupadas por rol
components/        → componentes reutilizables (UI, layout)
utils/             → funciones puras (cache, formatters, etc.)
```

**Reglas:**
- Usar `useAuth()` para acceder al usuario y token en cualquier componente.
- Todas las llamadas a la API pasan por `api.js`; nunca usar `fetch` directamente en componentes.
- Agrupar pantallas por rol bajo `screens/<rol>/`.

---

## Flujo de trabajo Git

### Ramas

| Rama        | Descripción |
|-------------|-------------|
| `main`      | Producción estable |
| `develop`   | Integración de features |
| `feature/*` | Nueva funcionalidad |
| `fix/*`     | Corrección de bugs |
| `hotfix/*`  | Parche urgente en producción |

### Convención de commits (Conventional Commits)

```
feat: agrega módulo de reportes mensuales
fix: corrige cálculo de horas extra en asistencia
chore: actualiza dependencias de seguridad
docs: añade documentación de endpoints de turnos
refactor: extrae lógica de geofencing a servicio propio
test: agrega tests para auth.service
```

### Proceso para agregar una nueva feature

```bash
git checkout develop
git pull origin develop
git checkout -b feature/nombre-de-la-feature

# ... desarrollar ...

git add .
git commit -m "feat: descripción de la feature"
git push origin feature/nombre-de-la-feature
# Abrir Pull Request hacia develop
```

---

## Base de datos

### Crear una nueva migración

```bash
cd backend
# Edita prisma/schema.prisma con los cambios
npx prisma migrate dev --name descripcion_del_cambio
```

### Resetear la base de datos local

```bash
npx prisma migrate reset
# Esto elimina todos los datos y vuelve a aplicar migraciones + seed
```

### Usuarios de prueba (seed)

Después de ejecutar `npm run db:seed`, estarán disponibles:

| RUT          | Password    | Rol        |
|--------------|-------------|------------|
| 11111111-1   | password123 | admin      |
| 22222222-2   | password123 | central    |
| 33333333-3   | password123 | supervisor |
| 44444444-4   | password123 | pauta      |
| 55555555-5   | password123 | libre      |

---

## Testing

### Backend

```bash
cd backend
npm test                 # Todos los tests con cobertura
npm run test:watch       # Modo observación (ideal durante desarrollo)
```

Los tests están en archivos `*.test.js` colocados junto al módulo que prueban o en un directorio `__tests__/`.

### Consideraciones

- Los tests de services usan mocks de Prisma para no depender de la base de datos real.
- Los tests de integración usan `supertest` para probar endpoints completos.
- La cobertura mínima esperada es del **70%** para services y controllers críticos.

---

## Despliegue

### Backend (Railway)

Railway detecta automáticamente cambios en `main` y ejecuta:

```
build:  npx prisma generate
start:  node src/server.js
```

La configuración está en `railway.json` en la raíz del proyecto.

**Variables de entorno en Railway:** configúralas en el panel de Railway bajo el servicio del backend.

### Frontend (Vercel)

Vercel detecta automáticamente cambios en `main` y ejecuta:

```
build: vite build
```

La configuración está en `frontend/vercel.json`.

**Variables de entorno en Vercel:** agrega `VITE_API_URL` apuntando a la URL pública del backend en Railway.

### Migraciones en producción

```bash
# Desde CI/CD o manualmente
npx prisma migrate deploy
```

Este comando aplica solo las migraciones pendientes sin modificar el schema ni resetear datos.

---

## Solución de problemas comunes

### El backend no arranca

1. Verificar que las 4 variables requeridas estén definidas: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `FRONTEND_URL`.
2. Verificar que PostgreSQL esté corriendo y el `DATABASE_URL` sea correcto.
3. Ejecutar `npx prisma generate` si los modelos fueron actualizados.

### Error de CORS en desarrollo

Asegurarse de que `FRONTEND_URL=http://localhost:5173` en el `.env.local` del backend.

### Redis no disponible

Redis es **opcional**. Si no está configurado, el sistema funciona degradado:
- Los tokens no se agregan a blacklist al hacer logout.
- No hay caché de consultas.

Para evitar el warning al iniciar, configurar `REDIS_URL` o ignorar el mensaje.

### Prisma Client desactualizado

```bash
cd backend
npx prisma generate
```

Ejecutar esto después de cualquier cambio en `schema.prisma`.
