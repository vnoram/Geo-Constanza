import { T } from "../../theme/theme";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function LibreSolicitudes() {
  return (
    <div>
      <SectionHeader title="Solicitudes" sub="Gestiona tus peticiones" action={{ label: "+ Nueva", onClick: () => {} }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { icon: "🏖️", label: "Vacaciones" },
          { icon: "➕", label: "Turno Extra" },
          { icon: "🚫", label: "Ausencia" },
          { icon: "🔄", label: "Cambio Inst." },
        ].map((t, i) => (
          <button key={i} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
            padding: "14px 10px", color: T.text, fontSize: 12, fontWeight: 600,
            cursor: "pointer", textAlign: "center", fontFamily: "'Outfit', sans-serif",
            transition: "all 0.15s",
          }}>{t.icon} {t.label}</button>
        ))}
      </div>
      <div style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 13 }}>
        📝 No tienes solicitudes activas
      </div>
    </div>
  );
}
