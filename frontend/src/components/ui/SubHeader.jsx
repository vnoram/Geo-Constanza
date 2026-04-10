import { T } from "../../theme/theme";

export function SubHeader({ title }) {
  return (
    <div style={{
      fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.5,
      fontWeight: 700, marginBottom: 8, marginTop: 16,
    }}>{title}</div>
  );
}
