import { T, FONT } from "../../theme/theme";

export function KPI({ label, value, sub, accent }) {
  return (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: T.radius, padding: "12px 14px", flex: 1, minWidth: 100,
    }}>
      <div style={{ fontSize: 12, color: T.textSec, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: accent || T.text, lineHeight: 1, fontFamily: FONT.mono, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.textMut, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
