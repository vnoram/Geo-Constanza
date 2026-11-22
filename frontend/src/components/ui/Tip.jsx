import * as Tooltip from "@radix-ui/react-tooltip";
import { FONT, T } from "../../theme/theme";

/** Tooltip accesible (Radix): se muestra al pasar el mouse o al enfocar con teclado. */
export function Tip({ texto, children, lado = "top" }) {
  if (!texto) return children;
  return (
    <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side={lado} sideOffset={6} collisionPadding={12} style={{
            background: T.bgCard, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.radius,
            padding: "6px 10px", fontSize: 12, fontFamily: FONT.ui, maxWidth: 280, zIndex: 1300,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}>
            {texto}
            <Tooltip.Arrow width={10} height={5} style={{ fill: T.border }} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
