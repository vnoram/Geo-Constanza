import { T } from "../../theme/theme";

export function SubHeader({ title }) {
  return (
    <div style={{
      fontSize: 12, color: T.textSec, fontWeight: 500, marginBottom: 8, marginTop: 16,
    }}>{title}</div>
  );
}
