import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { FONT, T } from "../../theme/theme";

/**
 * Selector desplegable (Radix Select) para filtros compactos.
 * `opciones`: [{ valor, etiqueta }]; `valor` puede ser número o texto y `onChange` devuelve el mismo tipo.
 */
export function Selector({ id, etiqueta, value, onChange, opciones, placeholder, bloque = false, capitalizar = false }) {
  const actual = opciones.find((o) => o.valor === value);
  const cambiar = (texto) => {
    const elegida = opciones.find((o) => String(o.valor) === texto);
    if (elegida) onChange(elegida.valor);
  };
  const mayuscula = capitalizar ? { textTransform: "capitalize" } : null;
  return (
    <Select.Root value={value === "" || value == null ? "" : String(value)} onValueChange={cambiar}>
      <Select.Trigger id={id} aria-label={id ? undefined : etiqueta} className="selector-trigger" style={{
        display: bloque ? "flex" : "inline-flex", width: bloque ? "100%" : undefined, boxSizing: "border-box",
        alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: bloque ? 44 : 32,
        background: bloque ? T.bgInput : T.bgCard, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.radius,
        padding: bloque ? "0 12px" : "0 10px", fontSize: bloque ? 13 : 12, fontFamily: FONT.ui, cursor: "pointer", textAlign: "left", ...mayuscula,
      }}>
        <span style={{ ...mayuscula, color: actual ? T.text : T.textMut, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{actual?.etiqueta ?? placeholder ?? ""}</span>
        <Select.Icon asChild><ChevronDown size={14} color={T.textMut} /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} align="end" className="selector-contenido" style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, zIndex: 1200,
          boxShadow: "0 12px 32px rgba(0,0,0,0.5)", maxHeight: "min(320px, var(--radix-select-content-available-height))",
          minWidth: "var(--radix-select-trigger-width)", overflow: "hidden", fontFamily: FONT.ui,
        }}>
          <Select.Viewport style={{ padding: 4 }}>
            {opciones.map((o) => (
              <Select.Item key={String(o.valor)} value={String(o.valor)} className="selector-item" style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 34,
                padding: "0 10px", borderRadius: 4, fontSize: 12, color: T.text, cursor: "pointer", outline: "none", ...mayuscula,
              }}>
                <Select.ItemText>{o.etiqueta}</Select.ItemText>
                <Select.ItemIndicator><Check size={13} color={T.accent} /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
