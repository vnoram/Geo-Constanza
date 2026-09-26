import { useEffect, useRef } from "react";
import { T } from "../../theme/theme";
import { useLeaflet } from "../../hooks/useLeaflet";
import { CARTO_TILE_URL, CARTO_TILE_OPTIONS } from "../../config/maps";

const CENTRO_POR_DEFECTO = [-33.4489, -70.6693]; // Santiago
const ZOOM_PUNTO = 17;

const PIN_HTML = `
  <div style="position:relative;width:30px;height:42px;">
    <svg width="30" height="42" viewBox="0 0 30 42" style="filter:drop-shadow(0 4px 8px rgba(0,0,0,.6))">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 11.2 15 27 15 27s15-15.8 15-27C30 6.7 23.3 0 15 0z" fill="${T.accent}"/>
      <circle cx="15" cy="15" r="6" fill="${T.bg}"/>
    </svg>
  </div>`;

const ESTILOS_MAPA = `
  .gc-map-picker .leaflet-control-zoom a {
    background:${T.bgCard} !important;border-color:${T.border} !important;color:${T.textSec} !important;
  }
  .gc-map-picker .leaflet-control-zoom a:hover { background:${T.bgCardHover} !important;color:${T.accent} !important; }
  .gc-map-picker.leaflet-container { cursor: crosshair; background:${T.bgInput}; }
  .gc-dark-tile, .leaflet-tile-pane .leaflet-tile {
    filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(95%) !important;
  }
`;

const coordValida = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

// ─── MAPA SELECTOR DE UBICACIÓN ──────────────────────────────────
// - Click en el mapa o arrastrar el pin → onCambio(lat, lng)
// - Si lat/lng cambian desde fuera (autocompletado o edición manual) → el mapa se centra ahí
export function MapaUbicacion({ latitud, longitud, radio, onCambio, alto = 420, className }) {
  const leafletListo = useLeaflet();
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const pinRef = useRef(null);
  const circuloRef = useRef(null);
  const onCambioRef = useRef(onCambio);
  // Última posición emitida por el propio mapa, para no re-centrar al arrastrar
  const emitidaRef = useRef(null);
  const emitirRef = useRef(null);

  useEffect(() => {
    onCambioRef.current = onCambio;
  }, [onCambio]);

  const lat = parseFloat(latitud);
  const lng = parseFloat(longitud);
  const hayPunto = coordValida(lat, lng);
  const radioM = Math.max(parseInt(radio, 10) || 0, 0);

  // Inicialización
  useEffect(() => {
    if (!leafletListo || !contenedorRef.current || mapaRef.current) return;
    if (!document.getElementById("gc-map-picker-styles")) {
      const el = document.createElement("style");
      el.id = "gc-map-picker-styles";
      el.textContent = ESTILOS_MAPA;
      document.head.appendChild(el);
    }
    const L = window.L;
    const mapa = L.map(contenedorRef.current, {
      center: hayPunto ? [lat, lng] : CENTRO_POR_DEFECTO,
      zoom: hayPunto ? ZOOM_PUNTO : 12,
      attributionControl: false,
    });
    L.tileLayer(CARTO_TILE_URL, CARTO_TILE_OPTIONS).addTo(mapa);

    const emitir = (latlng) => {
      const nLat = +latlng.lat.toFixed(6);
      const nLng = +latlng.lng.toFixed(6);
      emitidaRef.current = [nLat, nLng];
      onCambioRef.current?.(nLat, nLng);
    };

    mapa.on("click", (e) => emitir(e.latlng));
    mapaRef.current = mapa;
    emitirRef.current = emitir;

    // El mapa vive dentro de un modal: recalcular tamaño una vez pintado
    setTimeout(() => mapa.invalidateSize(), 150);

    return () => {
      mapa.remove();
      mapaRef.current = null;
      pinRef.current = null;
      circuloRef.current = null;
    };
  }, [leafletListo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar pin + geocerca con las props
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    const L = window.L;

    if (!hayPunto) {
      pinRef.current?.remove();
      circuloRef.current?.remove();
      pinRef.current = null;
      circuloRef.current = null;
      return;
    }

    if (!pinRef.current) {
      const icon = L.divIcon({ html: PIN_HTML, className: "", iconSize: [30, 42], iconAnchor: [15, 42] });
      pinRef.current = L.marker([lat, lng], { icon, draggable: true, autoPan: true }).addTo(mapa);
      pinRef.current.on("drag", (e) => circuloRef.current?.setLatLng(e.target.getLatLng()));
      pinRef.current.on("dragend", (e) => emitirRef.current(e.target.getLatLng()));
      circuloRef.current = L.circle([lat, lng], {
        radius: radioM,
        color: T.accent,
        fillColor: T.accent,
        fillOpacity: 0.1,
        weight: 1.5,
        dashArray: "4 4",
      }).addTo(mapa);
    } else {
      pinRef.current.setLatLng([lat, lng]);
      circuloRef.current.setLatLng([lat, lng]);
    }
    circuloRef.current.setRadius(radioM);

    // Centrar sólo si el cambio vino de fuera del mapa
    const emitida = emitidaRef.current;
    const vieneDelMapa = emitida && emitida[0] === lat && emitida[1] === lng;
    if (!vieneDelMapa) {
      mapa.setView([lat, lng], Math.max(mapa.getZoom(), ZOOM_PUNTO - 1), { animate: true });
    }
    emitidaRef.current = null;
  }, [leafletListo, lat, lng, hayPunto, radioM]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        height: alto,
        borderRadius: 14,
        overflow: "hidden",
        border: `1.5px solid ${T.border}`,
        background: T.bgInput,
      }}
    >
      <div ref={contenedorRef} className="gc-map-picker" style={{ position: "absolute", inset: 0 }} />

      {!leafletListo && (
        <div style={overlayCentro}>Cargando mapa...</div>
      )}

      {leafletListo && !hayPunto && (
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 500,
            background: "rgba(13,26,45,0.92)",
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            color: T.textSec,
            pointerEvents: "none",
          }}
        >
          👆 Busca la dirección en el formulario o <b style={{ color: T.accent }}>haz click en el mapa</b> para ubicar la instalación.
        </div>
      )}

      {leafletListo && hayPunto && (
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            zIndex: 500,
            background: "rgba(13,26,45,0.92)",
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 11,
            color: T.textSec,
            pointerEvents: "none",
          }}
        >
          Arrastra el pin para ajustar la posición exacta
        </div>
      )}
    </div>
  );
}

const overlayCentro = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  color: T.textMut,
};
