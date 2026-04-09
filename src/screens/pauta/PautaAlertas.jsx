import { T } from "../../theme/theme";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function PautaAlertas() {
  return (
    <div>
      <SectionHeader title="Alertas" sub="Notificaciones de tu turno" />
      <div style={{ background: T.yellowGhost, border: `1px solid ${T.yellow}22`, borderRadius: 12, padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: T.yellow, fontWeight: 600 }}>⚠️ Turno mañana: 06:00 — 14:00</div>
        <div style={{ fontSize: 11, color: T.textMut, marginTop: 4 }}>Centro Comercial Arauco · Confirmado</div>
      </div>
      <div style={{ background: T.accentGhost, border: `1px solid ${T.accent}22`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 13, color: T.accent, fontWeight: 600 }}>✅ Tu novedad fue recibida por supervisor</div>
        <div style={{ fontSize: 11, color: T.textMut, marginTop: 4 }}>Hace 15 minutos · A. Martínez</div>
      </div>
    </div>
  );
}
