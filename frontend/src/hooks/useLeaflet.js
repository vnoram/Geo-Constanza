import { useEffect, useState } from "react";

const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

// Carga Leaflet desde CDN una sola vez y devuelve `true` cuando está listo.
// Reutiliza el <script> si otra pantalla ya lo inyectó.
export function useLeaflet() {
  const [listo, setListo] = useState(() => !!window.L);

  useEffect(() => {
    if (window.L) return;
    if (!document.getElementById("leaflet-css")) {
      const css = document.createElement("link");
      css.id = "leaflet-css";
      css.rel = "stylesheet";
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
    }
    let script = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = LEAFLET_JS;
      document.head.appendChild(script);
    }
    const onLoad = () => setListo(true);
    const onError = () => console.error("[Leaflet] Error al cargar CDN");
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, []);

  return listo;
}
