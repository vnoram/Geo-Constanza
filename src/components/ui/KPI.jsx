import { T } from "../../theme/theme";

export function KPI({ label, value, sub, accent = T.accent }) {
  return (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: 16,
    }}>
      <div style={{ fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: T.textMut, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
