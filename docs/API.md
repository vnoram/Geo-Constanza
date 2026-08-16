# API

Base URL: `/api/v1`. Todas las rutas (salvo `auth/*`) requieren
`Authorization: Bearer <jwt>`. Los roles listados son los aceptados por
`authorize(...)` en cada ruta (ver [ROLES.md](ROLES.md) para el significado
de cada uno).

## Auth (`/auth`)
| Método | Ruta | Roles |
|---|---|---|
| POST | `/login` | público |
| POST | `/password/reset` | público |
| POST | `/refresh` | público |
| POST | `/logout` | autenticado |
| POST | `/2fa/verify` | público |

## Usuarios (`/usuarios`)
| Método | Ruta | Roles |
|---|---|---|
| GET | `/me` | autenticado |
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

## Novedades (`/novedades`)
| Método | Ruta | Roles |
|---|---|---|
| GET | `/` | pauta, libre, supervisor, central, admin |
| GET | `/:id` | pauta, libre, supervisor, central, admin |
| POST | `/` (multipart, campo `foto` opcional) | pauta, libre |
| PATCH | `/:id/resolver` | supervisor, central, admin |
| PATCH | `/:id/escalar` | supervisor |

## Solicitudes (`/solicitudes`)
| Método | Ruta | Roles |
|---|---|---|
| GET | `/` | pauta, libre, supervisor, central, admin |
| POST | `/` | pauta, libre |
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

---
Generado a partir de las definiciones reales en `backend/src/routes/*.routes.js`
(agosto 2026). Si se agregan/quitan endpoints, actualizar esta tabla junto
con el código — no hay generación automática de este documento.
