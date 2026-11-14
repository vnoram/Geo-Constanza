# Estándar de interfaz de Geo Constanza

Todo cambio visual nuevo debe cumplir esta lista. Si algo se decide en una pantalla, se aplica en todas.

## 1. Botones

| Tipo | Cómo se usa | Cómo se ve |
|---|---|---|
| Aprobar / aceptar / confirmar positivo | `<Btn variant="aprobar">` | Suave en reposo (tinte verde, borde verde); al pasar el mouse se rellena de verde oscuro `T.accentDim`. |
| Rechazar / destructivo | `<Btn variant="rechazar">` | Suave en reposo (tinte naranja, borde naranja); al pasar el mouse se rellena de naranja `T.alert`. Aprobar y rechazar siempre van juntos con estos colores. |
| Crear / nuevo («Nueva empresa», «+ Turno extra», «+ Reportar») | acción de `SectionHeader` o `<Btn variant="morado">` | Suave en reposo (tinte morado, borde morado); morado pleno en hover. |
| Acción principal neutra (Enviar, Guardar, Consultar) | `<Btn>` (variant `primary`) | Igual que rechazar: suave en reposo y naranja pleno en hover. |
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
- Ningún botón es llamativo en reposo: todos los rellenos son suaves (tinte + borde) y toman el color pleno solo al pasar el mouse. Las clases viven en `index.css` (`gc-btn-principal`, `gc-btn-rechazar`, `gc-btn-aprobar`, `gc-btn-morado`); un botón suelto las usa en vez de pintar su propio fondo.
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

## 6. Novedades y franjas Día/Noche

Todas las vistas que listan novedades (guardia, supervisor, operador central) usan los mismos componentes: `NovedadesPorDia`, `NovedadMini` e `IconoFranja` (`frontend/src/components/ui/`).

- **Carrusel semanal:** una semana (lunes a domingo) a la vez, con los 7 días siempre visibles aunque no tengan novedades ("Sin novedades"). Las flechas navegan libremente hacia atrás, haya o no registros; la flecha siguiente se bloquea en la semana actual. No hay vista "por día".
- **Días independientes:** cada día tiene el alto que necesite. Dentro del día se separa Día y Noche con una línea y un rótulo. En teléfono los días van en una sola columna y los vacíos ocupan una línea.
- **Recientes (últimas 12 h):** lista simple, sin calendario, con el mismo separador Día/Noche. Pendientes, Resueltas y Libro de rondas usan la semana.
- **Tarjeta (`NovedadMini`):** hora grande, tipo con el color de urgencia y el ícono de franja a su derecha, instalación (si aplica), descripción (máx. 3 líneas) y estado. Las rondas del libro van en verde y no se escalan ni se derivan.
- **Franja:** Día = inicio entre 07:00 y 18:59 (sol neón amarillo); Noche = 19:00 a 06:59 (luna neón violeta). La regla vive en `utils/novedades.js` (`franjaDe`, `franjaDeHora`) y también se usa en los turnos (Mi Turno y lista de turnos del guardia).

## 7. Paneles tipo dashboard

- Pantalla de gestión = **fila de KPI** arriba (componente `KPI`, 3 a 5 indicadores con `sub` explicativo; `accent` verde para lo sano, amarillo para lo pendiente) + **tarjetas** en `grid` con `repeat(auto-fill, minmax(min(100%, 340px), 1fr))`, no tablas. En teléfono queda una columna.
- Tarjeta: nombre y datos clave arriba, bloque secundario con fondo `T.bgInput`, métricas en `FONT.mono`, acciones abajo (`marginTop: auto`). Borde izquierdo de 3 px para el estado (verde activo, amarillo atención); lo inactivo se atenúa con `opacity`.
- Ejemplos: `EmpresasPanel` (empresas) y `PlataformaDispositivos` (equipos por empresa, con filas por equipo dentro de cada bloque).

## 8. Enrolamiento de equipos

- Equipo **principal**: la plataforma invita por correo al administrador de gestión (uno habilitado por empresa; para invitar otro se deshabilita el actual). El administrador invita los demás equipos desde su panel.
- Al llegar desde un enlace de invitación, `LoginScreen` cambia a modo enrolamiento (`PasosEnrolamiento`, título «Enrolar equipo», botón «Iniciar sesión y enrolar equipo», sin «¿Olvidaste tu contraseña?» ni credenciales de demostración).
- No hay canje manual de códigos en el login.

## 9. Lista de comprobación antes de entregar una pantalla

1. ¿Los botones son `Btn` o llevan `gc-accion-btn`?
2. ¿Hay algún `alert`, `confirm`, `prompt` o `<input type="date">` fuera de las excepciones?
3. ¿Los colores salen de `theme/theme.js` y no de valores sueltos?
4. ¿Se ve bien en pantalla angosta (sin scroll horizontal de la página)?
5. ¿Hay textos duros de ejemplo («mock») en vez de datos reales?
