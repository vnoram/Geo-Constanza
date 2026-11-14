import { T } from "../../theme/theme";
import { Icon } from "./Icon";
import { franjaDe, franjaDeHora } from "../../utils/novedades";

// Sol (07:00–18:59) o luna (19:00–06:59) según la hora de Chile de la novedad.
// Recibe la fecha/hora ISO de un evento, o la hora de inicio "HH:MM" de un turno (prop `hora`).
export function IconoFranja({ fecha, hora, size = 15 }) {
  const dia = (hora ? franjaDeHora(hora) : franjaDe(fecha)) === "dia";
  const neon = dia ? T.neonDay : T.neonNight;
  return (
    <span
      title={dia ? "Día" : "Noche"} role="img" aria-label={dia ? "Día" : "Noche"}
      style={{ display: "inline-flex", flex: "none", filter: `drop-shadow(0 0 3px ${neon}) drop-shadow(0 0 7px ${neon}aa)` }}
    >
      <Icon name={dia ? "sun" : "moon"} size={size} color={neon} />
    </span>
  );
}
