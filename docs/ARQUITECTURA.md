# Arquitectura

> Este documento describe la arquitectura tal como existe hoy en el código.
> Si el Informe de Formulación (sección VII) numera capas o componentes de
> forma distinta, ajustar la nomenclatura aquí para que coincida — este
> archivo no tuvo acceso directo al texto del informe, solo al prompt de
> reestructuración derivado de él.

## Vista general

```
frontend (Vite + React, Vercel)  ──HTTP/JSON + WebSocket──▶  backend (Express, Railway)
                                                                        │
                                                              ┌─────────┴─────────┐
                                                              │                   │
                                                         PostgreSQL          Azure Blob Storage
                                                         (vía Prisma)        (fotos de novedades)
```

## Backend (`backend/src`)

- **`app.js` / `server.js`** — arma la app Express (middlewares, rutas) y
  levanta el servidor HTTP + Socket.IO.
- **`routes/`** — un router por recurso (`novedades.routes.js`,
  `turnos.routes.js`, …), monta `authenticate` + `authorize(...roles)` por
  endpoint (ver [API.md](API.md)).
- **`controllers/`** — adaptan `req`/`res` y delegan en `services/`.
- **`services/`** — lógica de negocio y acceso a datos (Prisma). Es la única
  capa que debe conocer el modelo de datos.
- **`middlewares/`** — `auth.js` (JWT), `rbac.js` (control de acceso por rol),
  `rateLimiter.js`, `auditLog.js`, `errorHandler.js`.
- **`constants/`** — nombres de dominio compartidos: `roles.js`,
  `urgencias.js`, `estados.js` (ver [ROLES.md](ROLES.md)).
- **`socket/socketManager.js`** — eventos en tiempo real (`novedad:nueva`,
  `alerta_critica_central`, `admin:dashboard_update`, …), usados por
  `novedades.service.js` para notificar a supervisores/central.
- **`utils/azureStorage.js`** — subida de fotos de novedades a Azure Blob
  Storage (con validación de tipo/tamaño y reintentos).
- **`validators/`** — reservado para esquemas de validación de entrada
  (actualmente vacío; ver README dentro de la carpeta).

## Frontend (`frontend/src`)

- **`screens/`** — organizado por rol: `ggss-en-pauta/`, `ggss-libre/`,
  `supervisor/`, `operador-central/`, `administrador/`, `auth/`.
- **`components/layout/AppShell.jsx`** — shell principal que renderiza la
  screen correcta según `rol` y sección activa.
- **`components/{maps,geocercas,novedades}/`** — reservados para componentes
  compartidos (mapa en tiempo real con Leaflet, edición/preview de geocercas,
  UI de novedades reutilizable entre roles).
- **`context/`, `hooks/`, `services/`** — estado de sesión, llamadas HTTP a la
  API y hooks compartidos.
- **`constants/roles.js`** — mismos nombres de rol que el backend.

## Conceptos de dominio (ver también el informe)

- **Geocerca / geofencing**: radio (`Instalacion.radio_geofence_m`) alrededor
  de una instalación; `geovalidacion.service.js` calcula si una coordenada
  cae dentro de ese radio. Se usa tanto para **asistencia** como para el
  campo `gps_dentro_rango` de una **novedad**.
- **Novedad**: término único para lo que en otros sistemas se llamaría
  "incidente" o "alerta" — no usar esos términos como sinónimos en código
  nuevo.
- **Escalación de novedades**: `novedades.service.js#escalar` cambia el
  estado a `escalada` y emite `novedad:escalada`; la urgencia `rojo` en una
  instalación de `nivel_criticidad: 'Alta'` dispara además
  `alerta_critica_central` automáticamente al crear la novedad.
- **Algoritmo de turnos 4x4**: `turnos.service.js` (endpoint
  `POST /api/v1/turnos/pauta-4x4`), genera la pauta fija de guardias
  `GGSS_EN_PAUTA`.
- **Dashboard de Business Intelligence**: `dashboard.service.js` y
  `reportes.service.js` (KPIs de asistencia, novedades por semana, estado de
  guardias, resumen mensual por instalación).

## Persistencia futura (PostGIS)

`Instalacion.latitud`/`longitud` se mantienen como `Float` por compatibilidad
con los datos existentes. Una migración futura a un tipo `geometry` de
PostGIS permitiría geocercas no circulares y consultas espaciales nativas —
ver el comentario correspondiente en `prisma/schema.prisma`.
