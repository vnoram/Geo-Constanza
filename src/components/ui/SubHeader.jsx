import { T } from "../../theme/theme";

export function SubHeader({ title }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: T.textMut,
      textTransform: "uppercase", letterSpacing: 1.5,
      marginBottom: 10, marginTop: 16,
    }}>
      {title}
    </div>
  );
}
