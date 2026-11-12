# Estándar de interfaz de Geo Constanza

Todo cambio visual nuevo debe cumplir esta lista. Si algo se decide en una pantalla, se aplica en todas.

## 1. Botones

| Tipo | Cómo se usa | Cómo se ve |
|---|---|---|
| Aprobar / aceptar / confirmar positivo | `<Btn variant="aprobar">` | Verde oscuro `T.accentDim`, texto claro. |
| Rechazar / destructivo | `<Btn variant="rechazar">` | Naranja `T.alert`. Aprobar y rechazar siempre van juntos con estos colores. |
| Acción principal neutra (Enviar, Guardar, Consultar) | `<Btn>` (variant `primary`) | Naranja `T.alert`. |
| Secundaria / contorno | `<Btn variant="outline">` | Borde neutro. En hover se decolora a morado suave. |
| Ghost (sin borde) | `<Btn variant="ghost">` | Sin borde. En hover se decolora a morado suave. |
| Acción en tarjeta / lista | `<button className="touch-target gc-accion-btn gc-accion-btn--morado">` | Transparente con borde `T.border`. |
| Opción elegible (tipo, filtro, pestaña) | igual que la anterior + `aria-pressed` | Elegida: fondo `T.focusGhost`, borde `T.borderFocus`, texto `T.focusText`. |
| Destructiva | `gc-accion-btn--naranja` | En hover se tiñe de naranja. |
| Confirmación positiva | `gc-accion-btn--verde` | En hover se tiñe de verde. |

Reglas:
- `Btn` ya aplica el hover correcto: usarlo siempre que se pueda. Acepta `style` para ajustar tamaño.
- Un botón sin función real no se deja: se quita.
- Semántica de color: verde = aprobar/aceptar, naranja = rechazar/destructivo o acción principal. Un par aprobar/rechazar nunca se pinta con el mismo color.
- Todos los botones rellenos se aclaran un poco en hover (`gc-btn-principal`) sin cambiar de color.
- Nunca usar `<button>` sin estilo del navegador.

## 2. Avisos y confirmaciones

- Prohibido `window.alert`, `window.confirm` y `window.prompt`.
- Se usa `components/ui/Dialogo.jsx`: modo confirmar, modo motivo (`pedirMotivo`, obligatorio) y modo mensaje (`soloMensaje`). Los errores del servidor se muestran dentro del diálogo.
- Resultados simples: línea de texto `role="status"` en `T.accent` o `role="alert"` en `T.alert`.

## 3. Fechas y calendario

- Para elegir fechas se usa `components/ui/CalendarioRango.jsx`, no `<input type="date">`.
- Excepciones: filtros de rango de reportes y auditoría (dos fechas de consulta, no de agenda).
- Colores: morado suave = marcado, morado fuerte = destacado, naranja suave = hoy, verde neón `#39FF88` = ya en pauta (no se puede elegir). Días pasados deshabilitados.
- Cada pantalla decide qué hace cada toque:
  - Vacaciones: un toque y se marcan 21 días.
  - Ausentarse: un día, o dos toques para completar el rango.
  - Turno extra: marcar y desmarcar varios días.
  - Traslado: una sola fecha.
  - Pauta de administración: un toque y se marca el ciclo 4×4 completo.
- Principio: automático antes que manual; no pedir al usuario lo que se puede deducir.

## 4. Turnos

- Íconos de turno: sol (diurno) y luna (nocturno) en verde neón, junto al número del día.
- Mes: cuadros morados para los días de turno. Semana: lunes a domingo, por instalación y por guardia.
- Los turnos nocturnos aparecen en el día en que empiezan y se indica «(+1)».

## 5. Tarjetas, texto y marca

- Tema oscuro verdoso. Tarjetas `T.bgCard` con borde fino `T.border` y radio 8.
- Título de pantalla con `SectionHeader` (morado); subtítulo en gris.
- Poca información por pantalla: agrupar y resumir antes que listar todo.
- Rol del guardia en equipo personal: solo «GGSS».
- Estados con `Badge`: pendiente = amarillo, aprobada = verde, rechazada = rojo.

## 6. Lista de comprobación antes de entregar una pantalla

1. ¿Los botones son `Btn` o llevan `gc-accion-btn`?
2. ¿Hay algún `alert`, `confirm`, `prompt` o `<input type="date">` fuera de las excepciones?
3. ¿Los colores salen de `theme/theme.js` y no de valores sueltos?
4. ¿Se ve bien en pantalla angosta (sin scroll horizontal de la página)?
5. ¿Hay textos duros de ejemplo («mock») en vez de datos reales?
