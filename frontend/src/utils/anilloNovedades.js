import { COLOR_URGENCIA } from "./fichaInstalacion";

// Marcador de instalación en el mapa (Leaflet): punto del color del tipo de recinto y, si la instalación
// tiene algo pendiente, un anillo (de mayor a menor prioridad):
//   rojo       novedad crítica abierta (con pulso)
//   amarillo   novedad media abierta
//   sinmarcar  amarillo suave punteado: hay un guardia de turno que aún no marca entrada
// Las novedades de urgencia baja (verde) no llevan anillo.
// Estilos: .gc-marcador / .gc-anillo en components/ui/Grupo9Visual.css.

// `fila`: { novedades: { rojo, amarillo, ... }, sin_marcar } según GET /instalaciones/estado-mapa
export const nivelAnillo = (fila) => {
  if (!fila) return null;
  if (fila.novedades.rojo > 0) return "rojo";
  if (fila.novedades.amarillo > 0) return "amarillo";
  if (fila.sin_marcar > 0) return "sinmarcar";
  return null;
};

export const iconoInstalacion = (L, color, nivel = null) => L.divIcon({
  html: `<div class="gc-marcador">${nivel ? `<div class="gc-anillo gc-anillo-${nivel}"></div>` : ""}` +
    `<div style="width:20px;height:20px;background:${color};border:2.5px solid #0E1714;border-radius:50%;box-shadow:0 0 10px ${color};"></div></div>`,
  className: "", iconSize: [36, 36], iconAnchor: [18, 18], // área de clic de 36 px
});

export const COLORES_ANILLO = { rojo: COLOR_URGENCIA.rojo, amarillo: COLOR_URGENCIA.amarillo, sinmarcar: "#F2DC8A" };

// Consulta cada `cadaMs` el estado de cada instalación y actualiza el anillo de cada marcador.
// `marcadores`: { [instalacion_id]: { marker, col, urgencia } }. Devuelve la función que detiene el refresco.
export function iniciarAnillos({ L, apiBase, token, marcadores, cadaMs = 30000 }) {
  let activo = true;
  const refrescar = () => {
    fetch(`${apiBase}/instalaciones/estado-mapa`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(({ data }) => {
        if (!activo) return;
        Object.entries(marcadores).forEach(([id, m]) => {
          const nueva = nivelAnillo(data[id]);
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
