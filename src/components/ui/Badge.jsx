import { T } from "../../theme/theme";

const COLORS = {
  accent: { bg: T.accentGhost, color: T.accent },
  red: { bg: T.redGhost, color: T.red },
  yellow: { bg: T.yellowGhost, color: T.yellow },
  default: { bg: `${T.border}44`, color: T.textSec },
};

export function Badge({ children, color = "default" }) {
  const c = COLORS[color] || COLORS.default;
  return (
    <span style={{
      background: c.bg, color: c.color,
      fontSize: 10, fontWeight: 700, padding: "3px 8px",
      borderRadius: 6, textTransform: "uppercase", letterSpacing: 0.8,
    }}>
      {children}
    </span>
  );
}
