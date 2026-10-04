import { T, FONT } from "../../theme/theme";

// primary = acción principal (naranja) · secondary = contorno neutro · ghost = sin borde
export function Btn({ children, onClick, loading, variant = "primary", disabled, full, className = "" }) {
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";
  const inactivo = loading || disabled;
  return (
    <button
      className={`touch-target ${className}`.trim()}
      onClick={onClick}
      disabled={inactivo}
      style={{
        width: full ? "100%" : "auto",
        minHeight: 40,
        padding: "0 18px",
        background: disabled ? T.border : isPrimary ? T.alert : "transparent",
        color: disabled ? T.textMut : isPrimary ? T.ink : T.text,
        border: isPrimary || isGhost ? "1px solid transparent" : `1px solid ${T.border}`,
        borderRadius: T.radius, fontSize: 14, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: FONT.ui,
        transition: "background 0.15s, border-color 0.15s",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "Procesando…" : children}
    </button>
  );
}
