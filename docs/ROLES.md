# Roles del sistema

Geo Constanza define 5 roles, alineados con el Informe de Formulación del
Proyecto de Título. El valor almacenado en `Usuario.rol` (string) es el que
aparece entre paréntesis; las constantes de código están en
`backend/src/constants/roles.js` y `frontend/src/constants/roles.js`.

| Rol del informe | Constante   | Valor en BD  | Descripción |
|---|---|---|---|
| GGSS en Pauta | `GGSS_EN_PAUTA` | `pauta` | Guardia con pauta fija 4x4 asignada a una instalación. Marca entrada/salida por tótem/tablet, reporta novedades, solicita turnos/permisos. |
| GGSS Libre | `GGSS_LIBRE` | `libre` | Guardia eventual, sin pauta fija; postula a turnos disponibles y solo puede reportar novedades durante un turno aprobado. |
| Supervisor | `SUPERVISOR` | `supervisor` | Responsable de una o más instalaciones (directas o por comuna de cobertura). Revisa/aprueba solicitudes, resuelve o escala novedades, ve reportes de su alcance. |
| Operador Central | `OPERADOR_CENTRAL` | `central` | Visión global en tiempo real: dashboard, mapa operativo, creación de turnos y pautas 4x4 en lote. |
| Administrador | `ADMINISTRADOR` | `admin` | Gestión de usuarios, instalaciones y auditoría. Acceso a todos los reportes. |

## Dónde se aplican

- **Backend**: cada ruta usa `authorize(...)` (`backend/src/middlewares/rbac.js`)
  con la lista de roles permitidos (ver [API.md](API.md)). Los services además
  filtran datos por alcance del usuario (ej. `novedades.service.js` limita las
  novedades visibles a `usuario_id` para GGSS, y a instalaciones asignadas o
  comunas de cobertura para Supervisor — ver `supervisor.helper.js`).
- **Frontend**: `frontend/src/theme/theme.js` define, por rol, las secciones
  de menú visibles; `frontend/src/screens/` está organizado por rol
  (`ggss-en-pauta/`, `ggss-libre/`, `supervisor/`, `operador-central/`,
  `administrador/`).

## Nota sobre `tipo_ggss`

El campo `Usuario.tipo_ggss` distingue, dentro del universo de guardias,
`'pauta'` (pauta fija) de `'libre'` (eventual) — es un campo aparte del `rol`
y hoy comparte los mismos dos valores por coincidencia histórica.
