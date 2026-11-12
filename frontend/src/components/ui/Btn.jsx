import { T, FONT } from "../../theme/theme";
import { Icon } from "./Icon";

// Estándar (docs/ESTANDAR_UI.md): los rellenos (primary / aprobar / rechazar) van suaves en reposo y se
// rellenan del color al pasar el mouse (ver index.css). primary = acción principal (naranja)
// · secondary = contorno neutro · ghost = sin borde. Secondary y ghost se decoloran a morado en hover.
export function Btn({ children, onClick, loading, variant = "primary", disabled, full, className = "", icon, style: estilo, ...props }) {
  // aprobar = verde oscuro (confirmar/aceptar) · rechazar = naranja (rechazar/destructivo) · primary = naranja (acción principal)
  const isAprobar = variant === "aprobar";
  const isPrimary = variant === "primary" || variant === "rechazar" || isAprobar;
  const isGhost = variant === "ghost";
  const inactivo = loading || disabled;
  return (
    <button
      {...props}
      className={`touch-target ${isAprobar ? "gc-btn-aprobar" : variant === "rechazar" ? "gc-btn-rechazar" : isPrimary ? "gc-btn-principal" : "gc-accion-btn gc-accion-btn--morado"} ${className}`.trim()}
      onClick={onClick}
      disabled={inactivo}
      style={{
        width: full ? "100%" : "auto",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        minHeight: 40,
        padding: "0 18px",
        background: disabled ? T.border : isAprobar ? T.accentDim : isPrimary ? T.alert : "transparent",
        color: disabled ? T.textMut : isAprobar ? T.white : isPrimary ? T.ink : T.text,
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
