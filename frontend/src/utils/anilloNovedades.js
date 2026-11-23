import { COLOR_URGENCIA } from "./fichaInstalacion";

// Marcador de instalación en el mapa (Leaflet): punto del color del tipo de recinto y, si la instalación
// tiene novedades abiertas, un anillo del color de la urgencia más alta (rojo > amarillo > verde).
// Estilos: .gc-marcador / .gc-anillo en components/ui/Grupo9Visual.css.

export const urgenciaMaxima = (fila) => {
  if (!fila || !fila.total) return null;
  if (fila.rojo > 0) return "rojo";
  if (fila.amarillo > 0) return "amarillo";
  return "verde";
};

export const iconoInstalacion = (L, color, urgencia = null) => L.divIcon({
  html: `<div class="gc-marcador">${urgencia ? `<div class="gc-anillo gc-anillo-${urgencia}"></div>` : ""}` +
    `<div style="width:20px;height:20px;background:${color};border:2.5px solid #0E1714;border-radius:50%;box-shadow:0 0 10px ${color};"></div></div>`,
  className: "", iconSize: [36, 36], iconAnchor: [18, 18], // área de clic de 36 px
});

export const COLORES_ANILLO = COLOR_URGENCIA;

// Consulta cada `cadaMs` las novedades abiertas por instalación y actualiza el anillo de cada marcador.
// `marcadores`: { [instalacion_id]: { marker, col, urgencia } }. Devuelve la función que detiene el refresco.
export function iniciarAnillos({ L, apiBase, token, marcadores, cadaMs = 30000 }) {
  let activo = true;
  const refrescar = () => {
    fetch(`${apiBase}/instalaciones/estado-novedades`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(({ data }) => {
        if (!activo) return;
        Object.entries(marcadores).forEach(([id, m]) => {
          const nueva = urgenciaMaxima(data[id]);
          if (nueva === m.urgencia) return;
          m.marker.setIcon(iconoInstalacion(L, m.col, nueva));
          m.urgencia = nueva;
        });
      })
      .catch(() => {}); // sin anillos hasta el próximo intento; el mapa sigue funcionando
  };
  refrescar();
  const timer = setInterval(refrescar, cadaMs);
  return () => { activo = false; clearInterval(timer); };
}
