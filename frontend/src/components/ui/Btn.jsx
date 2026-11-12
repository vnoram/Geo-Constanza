import { T, FONT } from "../../theme/theme";
import { Icon } from "./Icon";

// Estándar (docs/ESTANDAR_UI.md): primary = acción principal (naranja, se aclara al pasar el mouse)
// · secondary = contorno neutro · ghost = sin borde. Secondary y ghost se decoloran a morado en hover.
export function Btn({ children, onClick, loading, variant = "primary", disabled, full, className = "", icon, style: estilo, ...props }) {
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";
  const inactivo = loading || disabled;
  return (
    <button
      {...props}
      className={`touch-target ${isPrimary ? "gc-btn-principal" : "gc-accion-btn gc-accion-btn--morado"} ${className}`.trim()}
      onClick={onClick}
      disabled={inactivo}
      style={{
        width: full ? "100%" : "auto",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
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
        ...estilo,
      }}
    >
      {!loading && icon && <Icon name={icon} size={16} />}
      {loading ? "Procesando…" : children}
    </button>
  );
}
