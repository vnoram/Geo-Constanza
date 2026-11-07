# Historias de Usuario

> Placeholder generado a partir de las pantallas y endpoints existentes en el
> código (agosto 2026). El Informe de Formulación tiene una Tabla 1 con la
> redacción oficial de HU-01 a HU-06 — reemplazar el contenido de abajo por
> esa tabla literal cuando se tenga el documento a mano. Esta tabla solo sirve
> para no dejar el archivo vacío y como mapa código ↔ funcionalidad.

| ID | Rol | Historia | Pantalla / endpoint |
|---|---|---|---|
| HU-01 | GGSS en Pauta | Como guardia en pauta, quiero marcar entrada/salida por tablet dentro de mi geocerca, para registrar mi asistencia sin intervención manual. | `screens/ggss-en-pauta/PautaTurno.jsx` → `POST /asistencia/entrada-tablet` |
| HU-02 | GGSS en Pauta / Libre | Como guardia, quiero reportar una novedad con foto y ubicación durante mi turno, para que supervisión sea notificada en tiempo real. | `screens/ggss-en-pauta/PautaNovedades.jsx` → `POST /novedades` |
| HU-03 | GGSS Libre | Como guardia libre, quiero ver los turnos disponibles y postular a ellos, para trabajar de forma eventual. | `screens/ggss-libre/LibreTurnos.jsx` → `GET /turnos/disponibles` |
| HU-04 | Supervisor | Como supervisor, quiero ver y resolver/escalar las novedades de mis instalaciones asignadas, para actuar sobre incidentes en curso. | `screens/supervisor/SupNovedades.jsx` → `PATCH /novedades/:id/resolver`, `/escalar` |
| HU-05 | Operador Central | Como operador central, quiero generar la pauta 4x4 en lote y ver un dashboard en tiempo real, para planificar turnos y monitorear la operación global. | `screens/operador-central/CentralPanel.jsx` → `POST /turnos/pauta-4x4`, `GET /dashboard/hoy` |
| HU-06 | Administrador | Como administrador, quiero gestionar usuarios e instalaciones y consultar la auditoría, para mantener el sistema y trazar cambios. | `screens/administrador/AdminUsuarios.jsx`, `AdminInstalaciones.jsx` → `GET /auditoria` |

## Estado de implementación — Sprint 5, ramas apiladas

Esta sección complementa el mapa anterior; no sustituye la redacción oficial del informe ni registra cierres en Azure Boards. Los cambios están en PR a `main`, sin merge ni despliegue. Una validación local no equivale a aceptación de producción.

| Historia / trabajo | Implementado y probado localmente | Pendiente de aceptación o implementación |
|---|---|---|
| HU-02 — registrar novedad con foto y ubicación | Foto opcional hasta 10 MB, GPS/geocerca, folio, permisos, evento por instalación y creación/historial transaccional; pruebas con PostgreSQL Docker. | Azure y GPS físicos; aceptación y despliegue explícitos. |
| HU-08 — asignar y seguir novedades hasta cierre (Sprint 5) | Responsable activo, estado `en_atencion`, escalar/resolver con comentario obligatorio, historial, auditoría y notificación FCM opcional; rollback y concurrencia probados. | Entrega FCM a dispositivos reales y aceptación integral. No se renumera HU-04 del mapa previo. |
| HU-03 / AB#62 — cobertura GGSS Libre | Backend de vacantes compatibles, solicitud vinculada al turno, aprobación/asignación transaccional y notificación. | Interfaz de postulación completa y enrolamiento FCM del cliente; tratamiento de regímenes excepcionales. No marcar la historia completa solo por estos endpoints. |
| AB#67 — reglas de cobertura | Rechazo por solape y horas; base ordinaria de 42 horas, reducción a 40 desde 26-04-2028 y control diario de 10 horas, con topes contractuales menores. El usuario autorizó basarse en fuentes oficiales. | Contratos, descansos, colación, sistemas por promedio y autorizaciones excepcionales por instalación/empresa. No certifica cumplimiento laboral integral. |
| HU-05 / AB#97 — panel consolidado | Tolerancia por instalación, default 15; conteo de puestos sin cobertura y visualización en Supervisor/Central. | Revisión con datos operativos; configuración por API disponible, formulario específico no incorporado. |
| HU-06 / AB#125 — auditoría y PDF | Listado real, filtros aplicados, exportación de todas las filas filtradas, fechas chilenas y permiso admin; lectura del PDF y UI 390/1440 px verificadas. | Volúmenes masivos de bitácora y aceptación operativa. |
| AB#41 / AB#49 — pruebas de servicios | Suites de auth, usuarios e instalaciones; validación de roles/geocercas y respuestas públicas sin credenciales. | **2FA real y reset de contraseña siguen sin implementar**. Cobertura del código existente no significa que esos flujos estén terminados. |

Base verificada al cierre de C8 y ajuste normativo solicitado: **21 suites y 247 tests**, con la integración PostgreSQL habilitada, lint backend y build frontend aprobados en Docker. No se cerraron historias automáticamente. Ver [informe con fuentes](INFORME_SPRINT5.md), [API](API.md) y [ADR](ADR/README.md) para contratos, decisiones y límites de verificación.
