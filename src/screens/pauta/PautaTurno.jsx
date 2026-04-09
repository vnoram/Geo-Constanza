import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Badge } from "../../components/ui/Badge";
import { KPI } from "../../components/ui/KPI";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function PautaTurno({ user }) {
  return (
    <div>
      <SectionHeader title="Mi Turno Actual" sub="Información de tu turno en curso" />
      <div style={{
        background: `linear-gradient(135deg, ${T.accentGhost}, transparent)`,
        border: `1px solid ${T.accent}33`, borderRadius: 16, padding: 20, marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 11, color: T.accentDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2 }}>EN TURNO</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginTop: 4 }}>Centro Comercial Arauco</div>
            <div style={{ fontSize: 13, color: T.textSec, marginTop: 4 }}>06:00 — 14:00 · Turno Diurno</div>
          </div>
          <div style={{
            width: 10, height: 10, borderRadius: "50%", background: T.accent,
            boxShadow: `0 0 12px ${T.accent}`, marginTop: 4,
            animation: "pulse 2s infinite",
          }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Badge>Activo</Badge>
          <Badge color="accent">Tablet OK</Badge>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <KPI label="Entrada" value="06:02" sub="Normal" />
        <KPI label="Horas" value="2h 28m" sub="de 8h programadas" />
      </div>

      {/* Fallback Button */}
      <div style={{
        background: T.bgCard, border: `1px dashed ${T.border}`,
        borderRadius: 14, padding: 16, textAlign: "center",
      }}>
        <div style={{ fontSize: 12, color: T.textMut, marginBottom: 10 }}>
          ⚠️ Solo usar si la tablet no está disponible
        </div>
        <Btn variant="ghost">📍 Marcaje Fallback</Btn>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
