# Geo Constanza — mini informe de trabajo y criterio de jornada

**Corte:** 30 de octubre de 2026, hora de Chile. **Entorno:** Docker local; PR apilados, sin merge ni despliegue a Railway/Vercel.

## Qué se trabajó y cómo se repartió

El usuario aportó los requisitos y planes identificados como trabajo con ChatGPT: Prompt Maestro, Bloques 2 y 3 y sus correcciones. Codex revisó el repositorio, implementó los cambios, generó migraciones en una base desechable, ejecutó las pruebas y publicó las ramas/PR. Esta reconstrucción se basa en esos mensajes y en los commits verificables; no atribuye cambios independientes a otro chat cuyo historial no se inspeccionó.

El objetivo fue completar el registro de novedades y su seguimiento, cerrar fugas de permisos/eventos y añadir coberturas, notificaciones, auditoría y documentación. Cada rama parte de la anterior; todos los PR apuntan a `main` y siguen sin fusionarse.

| Trabajo | Resultado | PR |
|---|---|---|
| T1 | Cierre con comentario obligatorio, 400/404/409 y protección de cierre repetido. | [18](https://github.com/vnoram/Geo-Constanza/pull/18) |
| T2 | Permisos por instalación y validación de estado al gestionar novedades. | [19](https://github.com/vnoram/Geo-Constanza/pull/19) |
| T3 | Folio único con año de creación en Chile, visible en Pauta/Supervisor. | [20](https://github.com/vnoram/Geo-Constanza/pull/20) |
| T4 | Responsable activo y estado en atención. | [21](https://github.com/vnoram/Geo-Constanza/pull/21) |
| T5 | Historial transaccional y línea de tiempo. | [22](https://github.com/vnoram/Geo-Constanza/pull/22) |
| T6 | Auditoría de gestión de novedades y revisión de solicitudes. | [23](https://github.com/vnoram/Geo-Constanza/pull/23) |
| T7 | WebSockets autenticados y eventos limitados a sus destinatarios. | [24](https://github.com/vnoram/Geo-Constanza/pull/24) |
| T8 | Flujo funcional con PostgreSQL real, rollback, concurrencia, fotos y GPS simulado. | [25](https://github.com/vnoram/Geo-Constanza/pull/25) |
| T9 | Emojis reemplazados por Lucide y revisión móvil/escritorio. | [26](https://github.com/vnoram/Geo-Constanza/pull/26) |
| C1 | ESLint 9 CommonJS y corrección de elementos sin uso. | [27](https://github.com/vnoram/Geo-Constanza/pull/27) |
| C2 | Token propio del dispositivo, FCM y degradación sin credenciales. | [28](https://github.com/vnoram/Geo-Constanza/pull/28) |
| C3 | Detección de vacantes y solicitud vinculada al turno. | [29](https://github.com/vnoram/Geo-Constanza/pull/29) |
| C4 | Solapes y máximo semanal configurable; aprobación/asignación atómica. | [30](https://github.com/vnoram/Geo-Constanza/pull/30) |
| C5 | Tolerancia por instalación y puestos sin cobertura en los paneles. | [31](https://github.com/vnoram/Geo-Constanza/pull/31) |
| C6 | Suites de auth, usuarios e instalaciones; validaciones de roles/geocerca. | [32](https://github.com/vnoram/Geo-Constanza/pull/32) |
| C7 | Auditoría real, filtros y exportación PDF de todas las filas filtradas. | [33](https://github.com/vnoram/Geo-Constanza/pull/33) |
| C8 y ajuste solicitado de C4 | Cinco ADR, API, estado de historias y política ordinaria con fuentes. | Este PR: rama `feat/AB35-documentacion-sprint5` |

## Criterio nacional adoptado para las nuevas coberturas

La jornada ordinaria tiene un máximo semanal de **42 horas desde el 26-04-2026**, con siguiente reducción a **40 desde el 26-04-2028**. La base del producto se ajusta a esa gradualidad; una configuración contractual inferior se respeta y una superior no amplía el techo ordinario. Fuentes: [Ley 21.561, disposiciones transitorias (BCN)](https://www.bcn.cl/leychile/navegar?idNorma=1191554) y [DT, aplicación de la reducción](https://www.dt.gob.cl/portal/1626/w3-propertyname-2556.html).

La aprobación comprueba también **10 horas ordinarias por turno y acumuladas en un día chileno**; no usa una cobertura para autorizar horas extra. Es un control conservador del sistema, no una interpretación exhaustiva de todas las modalidades de jornada. Fuente: [DT, límites ordinarios, artículos 22 y 28](https://www.dt.gob.cl/portal/1628/w3-article-60058.html).

Para guardias, el marco excepcional contempla **4×4×12 con promedio semanal de 42**, sujeto a autorización específica y sus condiciones. Por eso no corresponde concluir que toda semana de un guardia debe tener idéntica duración, ni que un turno de 12 horas esté autorizado automáticamente. Fuente: [Resolución Exenta DT 2000-10525/2024, puntos 1.a y 2](https://dt.gob.cl/transparencia/Res_Exta_2000-10525-2024_Marco-Guardias-Vigilantes-Privados.pdf) y [trámite de autorización de jornada excepcional](https://www.dt.gob.cl/portal/1626/w3-article-117246.html).

**Alcance práctico:** estas validaciones actúan sobre aprobaciones nuevas vinculadas a vacantes, con semanas ISO y duración real del intervalo, sin descontar colación no registrada. No modelan autorización excepcional, pactos por promedio, horas extra, distribución de días, descansos/feriados ni límites contractuales individuales. Tampoco auditan automáticamente todos los turnos históricos o del generador 4×4. El modelo aún no conserva esos antecedentes: no se certifica cumplimiento laboral integral. Antes de operar el 4×4×12 debe verificarse el régimen aplicable con la documentación de la empresa y asesoría laboral; mientras no se implemente, estas coberturas no se aprueban como jornada ordinaria.

## Evidencia de pruebas

- Resultado final del backend: **21 suites, 247 tests aprobados**, con integración PostgreSQL habilitada, dentro de Docker Node 20. Lint backend y build frontend aprobados.
- Auth, usuarios e instalaciones: **100% de líneas**; auth tiene 93,75% de ramas, los otros dos 100%. Esto mide código existente, no funcionalidades ausentes.
- Verificación de rollback y cierre concurrente, recorrido de cobertura con base real, aislamiento de clientes WebSocket y texto del PDF filtrado.
- Íconos: cero coincidencias Unicode; 26 vistas revisadas a 390/1440 px. Auditoría: filtros y descarga comprobados en ambos anchos con API simulada y red externa bloqueada.
- Se añadieron seis migraciones entre ambos bloques: folio, responsable, historial, FCM, vacantes y tolerancia. Solo se aplicaron a PostgreSQL desechable Docker; la base habitual y producción no se migraron.

## Pendientes que no deben confundirse con trabajo terminado

1. **2FA/TOTP y reset de contraseña:** siguen siendo stubs; el login no exige MFA. C6 prueba ese estado, no lo resuelve.
2. **Proveedor/dispositivos:** FCM y Azure reales, enrolamiento FCM del cliente y GPS físico no se validaron en este trabajo.
3. **Cobertura excepcional:** faltan régimen/autorización por empresa o instalación, condiciones contractuales y UI completa de postulación. Los límites ordinarios no sustituyen ese desarrollo.
4. **Salida a producción:** revisar y fusionar PR en orden solo cuando el usuario lo decida; planificar migraciones, configuración y aceptación operativa por separado.

Los contratos detallados están en [API](API.md); las decisiones y sus límites en [ADR](ADR/README.md); el estado funcional en [historias de usuario](HISTORIAS_DE_USUARIO.md).
