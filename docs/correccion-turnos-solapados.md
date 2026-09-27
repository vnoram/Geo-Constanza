# Corrección de turnos solapados y asistencia

## Ubicación y alcance

Trabajo realizado en la rama `claude/interactive-map-interface-c0dk0o`, en una copia local del repositorio dentro de `C:\Users\vnora\OneDrive\Escritorio\carrera\Geo Constanza\geo-constanza-web`. El repositorio de origen estaba limpio y se conserva intacto en `C:\Users\vnora\OneDrive\Escritorio\cosas variadas\carrera\Geo Constanza\geo-constanza-web`. Los commits están en esta copia; no se hizo push ni despliegue.

No se copió `.env`, no se conectó a producción, no se modificaron datos reales ni el esquema Prisma y no se ejecutaron migraciones. Las dependencias de prueba y compilación se copiaron de los `node_modules` del repositorio de origen: `npm ci --offline --ignore-scripts` no pudo acceder a la caché local. No se cambiaron manifiestos ni lockfiles.

## Causas y cambios por archivo

| Archivo | Causa y corrección |
|---|---|
| `backend/src/utils/fechaChile.js` | Las horas de pared se interpretaban como UTC o como hora del servidor. Añade `instanteChile`, `intervaloTurno`, `seSolapan` y `turnoVigente`, con `Intl` y zona `America/Santiago`. `turnosDeHoy` usa el fin real del nocturno. |
| `backend/src/services/turnos.service.js` | La validación solo comparaba horas del mismo día. Consulta desde el día anterior hasta el siguiente y compara intervalos; se aplica a crear, editar, lote y pauta 4x4 sin reemplazo. Edición excluye el propio id. El conflicto identifica turno, fecha, horario e instalación. La pauta usa medianoche UTC para las fechas `@db.Date`. |
| `backend/src/services/asistencia.service.js` | Elegir la fecha más reciente causaba entradas en otro turno y atrasos con desfase de 180 minutos. Selecciona por intervalo y tolerancia; calcula atraso desde el inicio chileno y extras desde el fin real. Consulta abiertas del guardia en todas las instalaciones y serializa los marcajes con una transacción y bloqueo PostgreSQL por guardia. La sincronización offline respeta el mismo bloqueo. El estado actual incluye `turno.estado` y devuelve también un turno vigente o próximo sin asistencia. |
| `frontend/src/screens/ggss-en-pauta/PautaTurno.jsx` | Repetía la selección por fecha reciente y descartaba `turno.estado`. Consume la selección del backend, conserva el estado del turno y limpia cachés obsoletos al recibir una respuesta válida. Los errores HTTP conservan el respaldo sin red. |
| `backend/scripts/detectar-solapamientos.js` | Detecta solapamientos por guardia y más de una asistencia abierta, devolviendo identificadores y detalles en JSON. No implementa escrituras. |
| `backend/src/utils/__tests__/fechaChile.test.js` | Pruebas de offsets, transiciones, nocturnos, contiguos y límites de tolerancia. |
| `backend/src/services/__tests__/turnos-asistencia.test.js` | Pruebas con Prisma simulado: validaciones de planificación, marcajes, estado actual, concurrencia simulada, sincronización y dashboard. |
| `backend/src/utils/__tests__/detectar-solapamientos.test.js` | Verifica el detector con datos sintéticos, sin cargar Prisma ni abrir conexiones. |

`dashboard.service.js` ya seleccionaba la asistencia por `turno_id`, sin filtrar por fecha de entrada. Se verificó mediante prueba que un nocturno vigente se muestra una vez con su asistencia. No se ocultan ni agrupan duplicados en la UI. El dashboard es una agenda de turnos: dos turnos legítimos del mismo guardia pueden tener dos filas; los solapamientos históricos siguen visibles hasta su revisión.

## Decisiones

- Intervalos `[inicio, fin)`: dos turnos contiguos, como 06–14 y 14–22, están permitidos. A las 14:00 el primero ya no admite entrada.
- Entrada permitida desde 15 minutos antes. Llegar antes da cero minutos; `tardio` se aplica solo si el atraso supera 10 minutos.
- Entre varios turnos elegibles, se prefiere el que tiene asistencia abierta y después el que empezó antes; se registra un warning con los ids. Si hay varias asistencias abiertas, el estado actual prioriza un turno vigente y después el inicio más antiguo, con warning.
- Reintentar la entrada del mismo turno devuelve la asistencia abierta, sin nuevos eventos. Si existe una abierta de otro turno, devuelve 409 para exigir salida antes de otra entrada. El bloqueo transaccional evita que dos peticiones simultáneas superen juntas esta comprobación; se aplica también a `/sync`.
- Una consulta de estado ya no inventa la salida de una asistencia de más de 14 horas. Esas entradas permanecen abiertas y también bloquean otra entrada hasta registrar la salida o realizar una revisión administrativa. Se eligió esta conducta conservadora para no alterar horas trabajadas ni acumular registros abiertos abandonados.
- No se añadieron dependencias. En la hora repetida de otoño se elige la primera ocurrencia. Una hora inexistente en primavera avanza por la duración del salto (00:30 → 01:30). Esta política queda cubierta por pruebas con las reglas de `Intl` del runtime.
- No se añadieron restricciones de base ni una migración. Las validaciones de planificación son de aplicación; operaciones externas que escriban directamente en la base no están protegidas por ellas. El bloqueo de asistencia requiere que los escritores de entradas usen estas rutas. Su funcionamiento con PostgreSQL real no se ensayó contra producción: la prueba concurrente usa una transacción simulada.

## Verificación

Ejecutado el 27/09/2026, Node v24.14.1:

- `TZ=UTC npm test -- --runInBand`: **42 pruebas aprobadas**, 3 suites.
- `TZ=America/Santiago npm test -- --runInBand`: **42 pruebas aprobadas**, 3 suites.
- `npm run build` en frontend: **aprobado**.
- `npx --no-install eslint src/screens/ggss-en-pauta/PautaTurno.jsx`: **aprobado**.
- Comprobación ESLint adicional del backend modificado, script y pruebas con `no-undef`, `no-unreachable`, `no-dupe-keys` y `valid-typeof`: **aprobada**. No sustituye al lint completo.
- `git diff --check`: **aprobado**.
- `npm run lint` en backend: **bloqueado por configuración preexistente ausente**; ESLint 9 no encuentra `eslint.config.js/mjs/cjs`.
- `npx --no-install eslint .` en frontend: **5 errores preexistentes**, en archivos sin cambios: `AppShell.jsx` (2 variables sin usar), `AuthContext.jsx` (2 exportaciones incompatibles con la regla de Fast Refresh) y `LoginScreen.jsx` (1 variable sin usar).

En PowerShell, para repetir las pruebas desde `backend`:

```powershell
$env:TZ = 'UTC'
npm test -- --runInBand
$env:TZ = 'America/Santiago'
npm test -- --runInBand
```

Casos comprobados: nocturno 26/09 20–08 contra 27/09 00–14 da conflicto; contiguos y noches consecutivas se permiten; edición no choca consigo misma; 00:21 da 21 minutos, 21:41 da 101; una salida nocturna a 08:30 da 0.5 horas extra. Incluye UTC−4/UTC−3, transiciones de abril y septiembre, duplicados históricos y turno próximo de hoy.

## Detector de datos históricos

Desde `backend`, cuando se decida inspeccionar la base configurada:

```powershell
node scripts/detectar-solapamientos.js
```

Lee `backend/.env` (o `DATABASE_URL` del entorno) y devuelve JSON con `solapamientos` y `asistencias_duplicadas`. Usa una transacción PostgreSQL `READ ONLY` con instantánea consistente. No imprime la conexión ni requiere datos personales para identificar los casos.

Es estrictamente de solo lectura: `--aplicar` y cualquier argumento de escritura se rechazan antes de abrir la conexión. No se implementó cierre automático porque los datos no permiten inferir con seguridad la hora real de salida. El script **no se ejecutó contra ninguna base** durante este trabajo; se probó su función de análisis con datos sintéticos.
