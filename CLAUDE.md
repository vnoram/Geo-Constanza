# Geo Constanza — reglas del repositorio

## Trazabilidad con Azure Boards (regla fija)

Este repositorio está conectado a Azure Boards (organización `testigos-de-washo`, proyecto `Geo Constanza`).

- Todo commit y todo Pull Request debe incluir el ID de la historia o tarea de Azure Boards con el formato `AB#<id>`.
- En los mensajes de commit, el `AB#<id>` va al final de la primera línea o en el cuerpo. Ejemplo: `feat(novedades): agregar folio a la novedad AB#83`.
- En la descripción del PR, usar `Fixes AB#<id>` cuando el merge deja la historia terminada, y `AB#<id>` simple cuando solo avanza o se relaciona con ella.
- Si no se sabe a qué historia corresponde el cambio, preguntar antes de commitear. No inventar un ID.
- Las ramas pueden incluir el ID, por ejemplo `feat/AB83-folio-novedad`.

## Referencia rápida de historias (ID de work item)

| ID | Historia |
|---|---|
| 83 | HU-02 Registrar novedad con foto y ubicación |
| 90 | HU-08 Asignar y seguir novedades hasta su cierre |
| 72 | HU-01 Registrar asistencia con validación de geocerca |
| 49 | HU-10 Configurar instalaciones y geocercas |
| 41 | HU-11 Administrar usuarios y roles |
| 57 | HU-13 Configurar pautas de turno 4x4 |
| 62 | HU-03 Solicitar cobertura de turno vacante |
| 67 | HU-07 Aprobar o rechazar solicitudes de cobertura |
| 97 | HU-09 Consultar estado consolidado de instalaciones |
| 102 | HU-04 Visualizar ubicación y estado de los guardias en mapa |
| 108 | HU-05 Recibir y gestionar alertas críticas |
| 116 | HU-06 Consultar dashboard e indicadores |
| 125 | HU-12 Consultar bitácora de acciones |
| 32 | HT-10 Diseñar prototipos de interfaz |
| 26 | HT-05 Configurar Azure DevOps y repositorio |

Los IDs de tareas hijas se consultan en el tablero. Ante duda, usar el ID de la historia padre.
