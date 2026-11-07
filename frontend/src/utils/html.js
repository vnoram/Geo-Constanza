// Escapa texto antes de interpolarlo en HTML (popups de Leaflet usan innerHTML).
const MAPA = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escaparHtml = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => MAPA[c]);
