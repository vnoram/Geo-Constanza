import { T } from "../../theme/theme";

export function Btn({ children, onClick, loading, variant = "primary", disabled, full }) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        width: full ? "100%" : "auto",
        padding: isPrimary ? "14px 32px" : "10px 20px",
        background: disabled ? T.textMut : isPrimary ? T.accent : "transparent",
        color: isPrimary ? T.bg : T.accent,
        border: isPrimary ? "none" : `1.5px solid ${T.accent}`,
        borderRadius: 12, fontSize: 14, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: 0.5, transition: "all 0.2s",
        opacity: loading ? 0.7 : 1,
        boxShadow: isPrimary && !disabled ? `0 4px 20px ${T.accentGlow}` : "none",
      }}
    >
      {loading ? "⏳ Procesando..." : children}
    </button>
  );
}
