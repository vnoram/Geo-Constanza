import { T } from "../../theme/theme";

export function Placeholder({ section }) {
  return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
      <div style={{ fontWeight: 700, fontSize: 16 }}>Sección: {section}</div>
      <div style={{ color: T.textMut, fontSize: 13, marginTop: 6 }}>
        Conectar con API backend en la siguiente fase
      </div>
    </div>
  );
}
