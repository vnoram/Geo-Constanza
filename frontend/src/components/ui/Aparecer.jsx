import "./Presentacion.css";
import { createContext, useContext, useEffect, useId, useState } from "react";
import { motion as Motion, useIsPresent, useReducedMotion } from "framer-motion";

const Lotes = createContext(null);

/** Animación de presentación. Cada lote se reproduce una sola vez por pantalla. */
export function Aparecer({ children, grupo, elemento = "div", salida = false, desplazar = true, style, ...props }) {
  const identidad = useId();
  const heredado = useContext(Lotes);
  const [propio] = useState(() => new Map());
  const registro = heredado ?? propio;
  const [entrada] = useState(() => {
    if (!grupo) return { animar: true, demora: 0 };
    const lote = registro.get(grupo) ?? { cerrado: false, indices: new Map() };
    registro.set(grupo, lote);
    if (lote.cerrado) return { animar: false, demora: 0 };
    if (!lote.indices.has(identidad)) lote.indices.set(identidad, lote.indices.size);
    return { animar: !lote.cerrado, demora: Math.min(lote.indices.get(identidad), 7) * 0.03 };
  });
  useEffect(() => {
    if (grupo) registro.get(grupo).cerrado = true;
  }, [grupo, registro]);
  const reducir = useReducedMotion();
  const presente = useIsPresent();
  const Tag = Motion[elemento];
  const oculto = { opacity: 0, y: desplazar ? 8 : 0 };
  return (
    <Lotes.Provider value={registro}>
      <Tag {...props} data-gc-presentacion="" inert={!presente ? true : undefined}
        initial={reducir || !entrada.animar ? false : oculto}
        animate={{ opacity: 1, y: 0 }}
        exit={salida ? (reducir ? { opacity: 1, y: 0 } : oculto) : undefined}
        transition={{ duration: reducir ? 0 : 0.2, delay: presente && !reducir ? entrada.demora : 0 }}
        style={{ ...style, ...(!presente ? { pointerEvents: "none" } : {}) }}>
        {children}
      </Tag>
    </Lotes.Provider>
  );
}
