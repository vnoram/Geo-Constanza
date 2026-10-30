# ADR 0005 — Calendario operacional en hora de Chile

**Estado:** implementada, con pruebas de turnos nocturnos y cambios de hora.

## Contexto

El calendario de operación es chileno y el servidor puede ejecutar con otra zona horaria. Un turno nocturno comienza un día y termina al siguiente; el cambio horario puede alterar sus horas reales.

## Decisión

Usar `backend/src/utils/fechaChile.js` como punto común para `America/Santiago`. Mantener instantes absolutos como `Date`; derivar fecha/hora de calendario chileno de forma explícita, sin fijar un desfase UTC constante. Los campos de fecha de turno son `@db.Date` y sus horas se interpretan con `intervaloTurno`.

- Intervalos semiabiertos: inicio incluido y fin excluido; los turnos contiguos no se solapan.
- Consultas de hoy consideran nocturnos de ayer que aún no terminan.
- Los filtros de auditoría incluyen el día chileno completo, también en el PDF.
- El folio usa el año chileno de creación de la novedad, no el año UTC ni el año actual de consulta.
- Horas semanales de cobertura: duración real repartida entre semanas ISO lunes-domingo en calendario chileno. Tras instrucción del usuario y consulta oficial, la base ordinaria es 42, limitada a 40 para coberturas desde el 26-04-2028; una configuración menor se respeta y una mayor no eleva el techo nacional. Se comprueba también un máximo ordinario de 10 horas por turno y acumuladas por día. Fuentes y alcance conservador en el [informe](../INFORME_SPRINT5.md).
- Tolerancia de instalación: entero de minutos, default 15, compartido por asistencia, detección de vacantes y paneles.

## Alternativas y consecuencias

- Depender de la zona del proceso produce resultados distintos entre máquinas; se descarta.
- Un desplazamiento fijo UTC no modela cambios de hora; se descarta.
- Las ambigüedades y horas inexistentes siguen la política explícita de `instanteChile`, cubierta por tests. Comparar o sumar horas de pared sin convertir a instantes puede producir errores.

## Evidencia

`fechaChile.js`, `utils/__tests__/fechaChile.test.js`, `services/cobertura.service.js`, `utils/cobertura.js`, `services/__tests__/cobertura.test.js` y `tolerancia.instalacion.test.js`.
