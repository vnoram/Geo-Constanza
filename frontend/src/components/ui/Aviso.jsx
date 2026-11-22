import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { FONT, T } from "../../theme/theme";

/** Se monta una sola vez en la raíz: contenedor de las notificaciones. */
export function Notificaciones() {
  return (
    <Toaster
      position="bottom-center"
      offset={16}
      toastOptions={{
        duration: 5000,
        style: {
          background: T.bgCard, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.radius,
          fontFamily: FONT.ui, fontSize: 13, boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
        },
      }}
    />
  );
}

/** Reemplaza al cartel fijo de confirmación: muestra `mensaje` como notificación cuando cambia. */
export function Aviso({ mensaje }) {
  useEffect(() => {
    if (mensaje) toast.success(mensaje);
  }, [mensaje]);
  return null;
}
