import { T } from "../../theme/theme";

export function KPI({ label, value, sub, accent }) {
  return (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: "16px 14px", flex: 1, minWidth: 100,
    }}>
      <div style={{ fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent || T.accent, lineHeight: 1, fontFamily: "'Outfit', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.textMut, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}
