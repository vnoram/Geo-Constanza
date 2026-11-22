import * as Tabs from "@radix-ui/react-tabs";
import { FONT, T } from "../../theme/theme";

/** Control segmentado (Radix Tabs): para alternar entre pocas vistas, por ejemplo Mensual / Trimestral. */
export function Segmentado({ etiqueta, value, onChange, opciones }) {
  return (
    <Tabs.Root value={value} onValueChange={onChange}>
      <Tabs.List aria-label={etiqueta} style={{
        display: "inline-flex", padding: 2, gap: 2, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radius,
      }}>
        {opciones.map((o) => (
          <Tabs.Trigger key={o.valor} value={o.valor} className="segmentado-opcion" style={{
            minHeight: 28, padding: "0 12px", border: 0, borderRadius: 4, fontSize: 12, fontFamily: FONT.ui, cursor: "pointer",
            background: value === o.valor ? T.bgCard : "transparent", color: value === o.valor ? T.text : T.textMut,
            fontWeight: value === o.valor ? 600 : 500, boxShadow: value === o.valor ? `inset 0 0 0 1px ${T.border}` : "none",
          }}>{o.etiqueta}</Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
