import { T } from "../../theme/theme";

export function Btn({ children, onClick, loading, disabled, full, variant = "primary" }) {
  const isGhost = variant === "ghost";
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: full ? "100%" : "auto",
        padding: "11px 20px",
        borderRadius: 12,
        border: isGhost ? `1px solid ${T.border}` : "none",
        background: isGhost ? "transparent" : disabled || loading
          ? T.bgCardHover
          : `linear-gradient(135deg, ${T.accent}, ${T.accentDim})`,
        color: isGhost ? T.textSec : disabled || loading ? T.textMut : "#000",
        fontSize: 14,
        fontWeight: 700,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        transition: "opacity 0.15s",
        opacity: disabled || loading ? 0.6 : 1,
      }}
    >
      {loading ? "Cargando..." : children}
    </button>
  );
}
