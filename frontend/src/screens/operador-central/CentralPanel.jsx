import { useState, useEffect, useRef, memo } from "react";
import { io } from "socket.io-client";
import { T, FONT } from "../../theme/theme";
import { Icon } from "../../components/ui/Icon";
import { KPI } from "../../components/ui/KPI";
import { SubHeader } from "../../components/ui/SubHeader";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";
import { cacheRead, cacheWrite, CACHE_KEYS } from "../../utils/cache";
import { API_URL as API_BASE, SOCKET_URL } from "../../config/api";
import { CARTO_TILE_URL, CARTO_TILE_OPTIONS } from "../../config/maps";
import { escaparHtml } from "../../utils/html";
import { esRutina } from "../../utils/novedades";
import { TarjetaNovedadCompacta, DetalleNovedadModal, ResolverModal } from "../supervisor/SupNovedades";

// Morado: selección y foco en las vistas de Central
const C_COLOR = "#7A4EBF";

// ─── ESTILOS POPUP LEAFLET ────────────────────────────────────────
const LEAFLET_STYLES = `
  .gc-popup .leaflet-popup-content-wrapper {
    background:#1C2E28;border:1px solid #2C4038;color:#F3EFE6;
    border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,.6);
    font-family:var(--font-ui);font-size:13px;
  }
  .gc-popup .leaflet-popup-tip { background:#1C2E28; }
  .gc-popup .leaflet-popup-close-button { color:#7C8F85 !important; }
  .gc-popup-warn .leaflet-popup-content-wrapper {
    background:#0E1714;border:1px solid #FFBE2E44;color:#F0A35E;
    border-radius:10px;font-family:var(--font-ui);font-size:12px;
  }
  .gc-popup-warn .leaflet-popup-tip { background:#0E1714; }
  .leaflet-control-attribution { display:none !important; }
  .leaflet-control-zoom a {
    background:#1C2E28 !important;border-color:#2C4038 !important;color:#A8B7AE !important;
  }
  .leaflet-control-zoom a:hover { background:#22372F !important;color:#7A4EBF !important; }
  .leaflet-tile-pane .leaflet-tile {
    filter: invert(100%) hue-rotate(180deg) brightness(78%) contrast(92%) saturate(70%) !important;
  }
`;

// ─── LEAFLET CDN ──────────────────────────────────────────────────
function useLeafletCDN(onReady) {
  useEffect(() => {
    if (window.L) { onReady(); return; }
    if (!document.getElementById("leaflet-css")) {
      const css = document.createElement("link");
      css.id = "leaflet-css"; css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload  = () => onReady();
    s.onerror = () => console.error("[Leaflet] Error al cargar CDN");
    document.head.appendChild(s);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

// ─── MAPA DE TODAS LAS INSTALACIONES ─────────────────────────────
// Central ve TODAS las instalaciones (sin filtro de supervisor_id).
const MapaInstalaciones = memo(function MapaInstalaciones({ token, ultimaUbicacion, guardiasIniciales = {} }) {
  const containerRef         = useRef(null);
  const mapRef               = useRef(null);
  const guardiasRef          = useRef({});
  const guardiasInicialesRef = useRef(guardiasIniciales);
  const [mapReady,  setMapReady]  = useState(false);
  const [cargando,  setCargando]  = useState(true);

  useLeafletCDN(() => setMapReady(true));

  useEffect(() => {
    if (!mapReady || !containerRef.current || mapRef.current) return;
    if (!document.getElementById("gc-map-styles")) {
      const el = document.createElement("style");
      el.id = "gc-map-styles"; el.textContent = LEAFLET_STYLES;
      document.head.appendChild(el);
    }
    const L   = window.L;
    const map = L.map(containerRef.current, { center: [-33.45, -70.65], zoom: 12, attributionControl: false });
    L.tileLayer(CARTO_TILE_URL, CARTO_TILE_OPTIONS).addTo(map);
    mapRef.current = map;

    fetch(`${API_BASE}/instalaciones`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const lista = Array.isArray(data) ? data : (data.data ?? []);
        const pts = [];
        lista.forEach((inst) => {
          if (!inst.latitud || !inst.longitud) return;
          pts.push([inst.latitud, inst.longitud]);
          const icon = L.divIcon({
            html: `<div style="width:14px;height:14px;background:${C_COLOR};border:2.5px solid #0E1714;border-radius:50%;box-shadow:0 0 10px ${C_COLOR},0 0 20px ${C_COLOR}22;"></div>`,
            className: "", iconSize: [14, 14], iconAnchor: [7, 7],
          });
          L.marker([inst.latitud, inst.longitud], { icon })
            .addTo(map)
            .bindPopup(
              `<b>${escaparHtml(inst.nombre)}</b><br>` +
              `<span style="color:#A8B7AE;font-size:11px">${escaparHtml(inst.direccion || "—")}</span><br>` +
              `<span style="color:${C_COLOR};font-size:11px">Radio: ${inst.radio_geofence_m ?? 100}m · ${escaparHtml(inst.nivel_criticidad ?? "Media")}</span>`,
              { className: "gc-popup" },
            );
          L.circle([inst.latitud, inst.longitud], {
            radius: inst.radio_geofence_m ?? 100, color: C_COLOR,
            fillColor: C_COLOR, fillOpacity: 0.06, weight: 1.5, dashArray: "4 4",
          }).addTo(map);
        });
        if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });

        // Pintar ubicaciones persistidas en caché
        Object.values(guardiasInicialesRef.current).forEach((ub) => {
          const { guardia_id, latitud, longitud, estado, hora } = ub;
          if (!latitud || !longitud) return;
          const color = estado === "tardio" ? "#F0A35E" : C_COLOR;
          const icon = L.divIcon({
            html: `<div style="width:9px;height:9px;background:${color};border:2px solid #0E1714;border-radius:50%;opacity:0.55;box-shadow:0 0 6px ${color};"></div>`,
            className: "", iconSize: [9, 9], iconAnchor: [4, 4],
          });
          const t = hora ? new Date(hora).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" }) : "—";
          guardiasRef.current[guardia_id] = L.marker([latitud, longitud], { icon })
            .addTo(map)
            .bindPopup(
              `<b>Última ubicación conocida</b><br>Hora: ${t}<br>` +
              `<span style="color:${color};font-size:10px">${estado === "tardio" ? "Tardío" : "A tiempo"} (sesión anterior)</span>`,
              { className: estado === "tardio" ? "gc-popup-warn" : "gc-popup" },
            );
        });
      })
      .catch((e) => console.error("[CentralMapa] Error:", e))
      .finally(() => setCargando(false));

    return () => { map.remove(); mapRef.current = null; };
  }, [mapReady, token]);

  // Actualizar marcador en tiempo real al recibir evento de socket
  useEffect(() => {
    if (!ultimaUbicacion || !mapRef.current || !window.L) return;
    const L = window.L;
    const { guardia_id, latitud, longitud, estado, hora } = ultimaUbicacion;
    guardiasRef.current[guardia_id]?.remove();
    const color = estado === "tardio" ? "#F0A35E" : C_COLOR;
    const icon = L.divIcon({
      html: `<div style="width:10px;height:10px;background:${color};border:2px solid #0E1714;border-radius:50%;box-shadow:0 0 8px ${color};"></div>`,
      className: "", iconSize: [10, 10], iconAnchor: [5, 5],
    });
    const t = new Date(hora).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
    guardiasRef.current[guardia_id] = L.marker([latitud, longitud], { icon })
      .addTo(mapRef.current)
      .bindPopup(
        `<b>Guardia detectado</b><br>Entrada: ${t}<br>` +
        `<span style="color:${color}">${estado === "tardio" ? "Tardío" : "A tiempo"}</span>`,
        { className: estado === "tardio" ? "gc-popup-warn" : "gc-popup" },
      )
      .openPopup();
  }, [ultimaUbicacion]);

  return (
    <div style={{ position: "relative", marginBottom: 20 }}>
      {cargando && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: T.bgCard, borderRadius: 8, fontSize: 12, color: T.textMut,
        }}>
          Cargando mapa...
        </div>
      )}
      <div
        className="central-map"
        ref={containerRef}
        style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}`, background: "#0E1714" }}
      />
      <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 10, color: T.textMut }}>
        <span><span style={{ color: C_COLOR }}>●</span> Instalación</span>
        <span><span style={{ color: C_COLOR }}>●</span> A tiempo</span>
        <span><span style={{ color: T.yellow }}>●</span> Tardío</span>
      </div>
    </div>
  );
});

// ─── KPI DONUT COMPACTO ───────────────────────────────────────────
function GraficoDonut({ presentes = 0, tardios = 0, faltantes = 0 }) {
  const segmentos = [
    { label: "Presentes", value: presentes,  color: C_COLOR },
    { label: "Tardíos",   value: tardios,    color: "#F0A35E" },
    { label: "Ausentes",  value: faltantes,  color: "#E86A2A" },
  ].filter((s) => s.value > 0);

  const total = segmentos.reduce((s, d) => s + d.value, 0);
  const CX = 55, CY = 55, R = 45, r = 28;

  if (total === 0) {
    return (
      <div style={{ textAlign: "center", color: T.textMut, fontSize: 12, paddingTop: 30 }}>
        Sin datos hoy
      </div>
    );
  }

  let angle = -Math.PI / 2;
  const pol = (a) => ({ x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) });
  const ipl = (a) => ({ x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) });

  const paths = segmentos.map((seg) => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const a0 = angle, a1 = angle + sweep;
    angle = a1;
    const p0 = pol(a0), p1 = pol(a1), q0 = ipl(a0), q1 = ipl(a1);
    const lg = sweep > Math.PI ? 1 : 0;
    const d = `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${lg} 1 ${p1.x} ${p1.y} L ${q1.x} ${q1.y} A ${r} ${r} 0 ${lg} 0 ${q0.x} ${q0.y} Z`;
    return { ...seg, d };
  });

  return (
    <div>
      <svg width={110} height={110} viewBox="0 0 110 110">
        {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} opacity={0.9} />)}
        <circle cx={CX} cy={CY} r={r - 2} fill="#0E1714" />
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#F3EFE6">{total}</text>
        <text x={CX} y={CY + 9} textAnchor="middle" fontSize="7" fill="#7C8F85">TURNOS</text>
      </svg>
      <div style={{ marginTop: 6 }}>
        {segmentos.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.textMut, marginBottom: 3 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
            {s.label}: <span style={{ color: s.color, fontWeight: 700 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── INDICADOR DE CONEXIÓN ────────────────────────────────────────
function SocketBadge({ status }) {
  const cfg = {
    connected:    { dot: C_COLOR,   label: "En vivo" },
    reconnecting: { dot: T.yellow,  label: "Reconectando..." },
    disconnected: { dot: T.red,     label: "Sin conexión" },
  }[status] ?? { dot: T.textMut, label: status };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textMut, marginBottom: 14 }}>
      <div style={{
        width: 7, height: 7, borderRadius: "50%", background: cfg.dot,
        boxShadow: status === "connected" ? `0 0 6px ${cfg.dot}` : "none",
      }} />
      {cfg.label}
    </div>
  );
}

function MiniStat({ value, label, color }) {
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${color}22`, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value ?? "—"}</div>
      <div style={{ fontSize: 10, color: T.textMut, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── Aviso en vivo: un supervisor escaló una novedad a Central ─────
function AvisoEscalada({ data, onClose }) {
  if (!data) return null;
  return (
    <div role="alert" style={{
      background: T.redGhost, border: `1px solid ${T.red}`, borderRadius: 8, padding: 14, marginBottom: 12,
      display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: T.red, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
          <Icon name="triangle-alert" size={16} /> Novedad escalada — {data.instalacion?.nombre}
        </div>
        <div style={{ fontSize: 13, color: T.text }}>{data.tipo}: {data.descripcion}</div>
        <div style={{ fontSize: 12, color: T.textMut, marginTop: 4 }}>Escalada por {data.escalada_por?.nombre}</div>
      </div>
      <button className="touch-target" aria-label="Cerrar aviso" onClick={onClose} style={{
        background: "none", border: "none", color: T.textMut, fontSize: 18, cursor: "pointer",
      }}><Icon name="x" size={16} /></button>
    </div>
  );
}

// ─── Modal: derivar una novedad crítica a un supervisor de la instalación ───
function DerivarModal({ novedad, token, onClose, onSuccess }) {
  const [opciones, setOpciones] = useState(null);
  const [elegido, setElegido]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/novedades/${novedad.id}/responsables`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setOpciones((Array.isArray(d) ? d : []).filter((u) => u.rol === "supervisor")))
      .catch(() => setOpciones([]));
  }, [novedad.id, token]);

  const derivar = async () => {
    if (!elegido) { setError("Elige a qué supervisor derivar."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/novedades/${novedad.id}/asignar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ responsable_id: elegido }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || json.message || "No se pudo derivar la novedad.");
      onSuccess(novedad.id, opciones.find((o) => o.id === elegido));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="responsive-modal-overlay" style={{
      position: "fixed", inset: 0, zIndex: 100, background: "rgba(14,23,20,0.85)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div className="responsive-modal" style={{
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: 24, width: "100%", maxWidth: 400,
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: T.focusText, marginBottom: 12 }}>Derivar a supervisor</div>
        <div style={{ fontSize: 13, color: T.textSec, marginBottom: 14 }}>
          <strong style={{ color: T.red }}>{novedad.tipo}</strong>{" — "}{novedad.instalacion?.nombre}
        </div>
        <label style={{ display: "block", fontSize: 12, color: T.textSec, marginBottom: 6 }}>
          Supervisores que cubren esta instalación
        </label>
        {opciones === null && <div style={{ fontSize: 12, color: T.textMut, marginBottom: 12 }}>Cargando…</div>}
        {opciones && opciones.length === 0 && (
          <div style={{ fontSize: 12, color: T.textMut, marginBottom: 12 }}>
            No hay otros supervisores activos que cubran esta instalación.
          </div>
        )}
        {opciones && opciones.length > 0 && (
          <select value={elegido} onChange={(e) => { setElegido(e.target.value); setError(null); }} style={{
            width: "100%", padding: "10px 12px", marginBottom: 12, background: T.bgInput, border: `1px solid ${T.border}`,
            borderRadius: 8, color: elegido ? T.text : T.textMut, fontSize: 14, fontFamily: "var(--font-ui)",
          }}>
            <option value="">Selecciona un supervisor…</option>
            {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        )}
        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: T.redGhost, color: T.red, fontSize: 13 }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="touch-target gc-accion-btn gc-accion-btn--naranja" onClick={onClose} disabled={loading} style={{
            background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.radius, color: T.text,
            minHeight: 40, padding: "0 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui)",
          }}>Cancelar</button>
          <button className="touch-target gc-accion-btn gc-accion-btn--morado" onClick={derivar}
            disabled={loading || !opciones || opciones.length === 0} style={{
            background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.radius, color: T.text,
            minHeight: 40, padding: "0 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui)",
          }}>{loading ? "Derivando…" : "Derivar"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── PANEL DE INCIDENTES (sección "incidentes") ───────────────────
// Central ve las novedades de TODAS las instalaciones. Mismo diseño que el supervisor:
// tarjetas compactas y, al pulsar una, ventana de detalle.
function IncidentesPanel({ token }) {
  const [novedades, setNovedades] = useState([]);
  const [loading, setLoading]    = useState(true);
  const [vista, setVista]        = useState("escaladas"); // escaladas | criticas | resueltas
  const [detalle, setDetalle]    = useState(null);
  const [resolverTarget, setResolver] = useState(null);
  const [derivarTarget, setDerivar] = useState(null);
  const [alertaEscalada, setAlertaEscalada] = useState(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/novedades`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setNovedades(Array.isArray(json) ? json : (json.data ?? []));
    } catch (e) {
      console.error("[CentralIncidentes]", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Aviso en vivo cuando un supervisor escala una novedad
  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: (cb) => cb({ token: localStorage.getItem("gc_token") || token }), transports: ["websocket"], reconnectionDelay: 2000 });
    socket.on("novedad:escalada_central", (data) => { setAlertaEscalada(data); cargar(); });
    return () => { socket.disconnect(); };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Central trabaja las ESCALACIONES de los supervisores; lo demás es de consulta.
  const incidencias = novedades.filter((n) => !esRutina(n)); // rondas/rutina no son incidentes
  const grupos = {
    escaladas: incidencias.filter((n) => n.estado === "escalada"),
    criticas:  incidencias.filter((n) => n.urgencia === "rojo" && n.estado !== "resuelta" && n.estado !== "escalada"), // las escaladas van en su propia pestaña
    resueltas: incidencias.filter((n) => n.estado === "resuelta"),
  };
  const TABS = [
    { id: "escaladas", label: "Escaladas" },
    { id: "criticas",  label: "Críticas" },
    { id: "resueltas", label: "Resueltas" },
  ];
  const VACIO = {
    escaladas: "No hay incidentes escalados por los supervisores.",
    criticas:  "No hay incidentes críticos pendientes de atención.",
    resueltas: "Aún no hay incidentes resueltos.",
  };
  const visibles = grupos[vista];

  return (
    <div className="operations-screen">
      <SectionHeader title="Incidentes" sub="Escalaciones de supervisores y críticos de todas las instalaciones" />
      <AvisoEscalada data={alertaEscalada} onClose={() => setAlertaEscalada(null)} />

      <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {TABS.map((t) => {
          const activo = vista === t.id;
          return (
            <button key={t.id} role="tab" aria-selected={activo} className="touch-target gc-tab-btn"
              onClick={() => setVista(t.id)} style={{
                padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: "var(--font-ui)",
                background: activo ? "rgba(122,78,191,0.22)" : "transparent",
                color: activo ? "#D2C6EE" : T.textSec,
                border: `1px solid ${activo ? "rgba(159,131,214,0.75)" : T.border}`,
              }}>
              {t.label} ({grupos[t.id].length})
            </button>
          );
        })}
        <button className="touch-target gc-accion-btn gc-accion-btn--morado" onClick={cargar} style={{
          marginLeft: "auto", padding: "6px 12px", borderRadius: 8,
          border: `1px solid ${T.border}`, background: "transparent",
          color: T.textSec, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)",
        }}>
          ↻ Actualizar
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", color: T.textMut, fontSize: 13, padding: 32 }}>
          Cargando incidentes...
        </div>
      )}

      {!loading && visibles.length === 0 && (
        <div style={{
          textAlign: "center", color: T.textMut, fontSize: 13,
          background: T.bgCard, border: `1px solid ${T.border}`,
          borderRadius: 8, padding: "32px 16px",
        }}>
          {VACIO[vista]}
        </div>
      )}

      <div className="nov-list">
        {visibles.map((n) => (
          <TarjetaNovedadCompacta key={n.id} n={n} onClick={() => setDetalle(n)} />
        ))}
      </div>

      {detalle && (
        <DetalleNovedadModal
          novedad={novedades.find((x) => x.id === detalle.id) ?? detalle}
          onClose={() => setDetalle(null)}
          // Central resuelve las escaladas; el resto es solo consulta
          onResolver={detalle.estado === "escalada" ? () => { const n = detalle; setDetalle(null); setResolver(n); } : undefined}
          // Escalada, o crítica abierta que nadie atiende (p. ej. supervisor ausente): Central la deriva
          onDerivar={detalle.estado === "escalada" || (detalle.estado === "abierta" && detalle.urgencia === "rojo") ? () => { const n = detalle; setDetalle(null); setDerivar(n); } : undefined}
        />
      )}

      {derivarTarget && (
        <DerivarModal
          novedad={derivarTarget}
          token={token}
          onClose={() => setDerivar(null)}
          onSuccess={(id, sup) => {
            setNovedades((prev) => prev.map((n) => n.id === id ? { ...n, estado: "en_atencion", responsable: sup ? { id: sup.id, nombre: sup.nombre } : n.responsable } : n));
            setDerivar(null);
          }}
        />
      )}

      {resolverTarget && (
        <ResolverModal
          novedad={resolverTarget}
          onClose={() => setResolver(null)}
          onSuccess={(id) => {
            setNovedades((prev) => prev.map((n) => n.id === id ? { ...n, estado: "resuelta", fecha_atencion: new Date().toISOString() } : n));
            setResolver(null);
          }}
        />
      )}
    </div>
  );
}

// ─── PANEL PRINCIPAL DE MONITOREO (sección "monitoreo") ──────────
function MonitoreoPanel({ token }) {
  const [stats,             setStats]           = useState(() => cacheRead(CACHE_KEYS.adminStats));
  const [loading,           setLoading]         = useState(() => cacheRead(CACHE_KEYS.adminStats) === null);
  const [socketStatus,      setSocketStatus]    = useState("disconnected");
  const [guardiasUbicacion, setGuardiasUbicacion] = useState(
    () => cacheRead(CACHE_KEYS.adminGuardiasMapa) ?? {},
  );
  const [ultimaUbicacion, setUltimaUbicacion] = useState(null);
  const socketRef = useRef(null);
  const [alertaEscalada, setAlertaEscalada] = useState(null); // novedad que un supervisor acaba de escalar

  const fetchStats = async () => {
    try {
      const res  = await fetch(`${API_BASE}/dashboard/hoy`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok) { setStats(json); cacheWrite(CACHE_KEYS.adminStats, json); }
    } catch (e) {
      console.error("[CentralPanel] fetchStats:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    const socket = io(SOCKET_URL, { auth: (cb) => cb({ token: localStorage.getItem("gc_token") || token }), transports: ["websocket"], reconnectionDelay: 2000 });
    socketRef.current = socket;

    socket.on("connect",           () => { console.log("[CentralPanel] Socket:", socket.id); setSocketStatus("connected"); });
    socket.on("disconnect",        () => setSocketStatus("disconnected"));
    socket.on("connect_error",     () => setSocketStatus("reconnecting"));
    socket.on("reconnect_attempt", () => setSocketStatus("reconnecting"));

    socket.on("admin:dashboard_update", () => fetchStats());
    socket.on("novedad:escalada_central", (data) => { setAlertaEscalada(data); fetchStats(); });

    socket.on("guardia:ubicacion", (p) => {
      setUltimaUbicacion(p);
      setGuardiasUbicacion((prev) => {
        const next = { ...prev, [p.guardia_id]: p };
        cacheWrite(CACHE_KEYS.adminGuardiasMapa, next);
        return next;
      });
    });

    return () => { socket.disconnect(); };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // KPIs del endpoint /dashboard/hoy — para central devuelve kpis globales
  const kpis = stats?.kpis;

  return (
    <div className="operations-screen">
      <SectionHeader title="Monitoreo Central" sub="Vista global de todas las instalaciones" />
      <SocketBadge status={socketStatus} />

      <AvisoEscalada data={alertaEscalada} onClose={() => setAlertaEscalada(null)} />

      {/* KPIs de cobertura */}
      <div className="metrics-grid" style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        <KPI
          label="Turnos Hoy"
          value={stats?.total ?? (loading ? "…" : "—")}
          sub="programados"
          accent={C_COLOR}
        />
        <KPI
          label="Cobertura"
          value={kpis ? `${kpis.coberturaDia ?? 0}%` : (loading ? "…" : "—")}
          sub="del día"
          accent={C_COLOR}
        />
        <KPI
          label="Novedades"
          value={kpis?.novedadesAbiertas ?? (loading ? "…" : "—")}
          sub="abiertas"
          accent={kpis?.novedadesAbiertas > 0 ? T.yellow : T.accent}
        />
        <KPI
          label="Escaladas"
          value={kpis?.novedadesEscaladas ?? (loading ? "…" : "—")}
          sub="sin resolver"
          accent={kpis?.novedadesEscaladas > 0 ? T.red : T.accent}
        />
      </div>

      {/* Mini stats de asistencia */}
      {stats && (
        <div className="metrics-grid metrics-grid--compact" style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          <MiniStat value={stats.presentes} label="Presentes"  color={C_COLOR}  />
          <MiniStat value={stats.tardios}   label="Tardíos"    color={T.yellow} />
          <MiniStat value={stats.faltantes} label="Faltantes"  color={T.red}    />
          <MiniStat value={stats.sinCobertura ?? 0} label="Sin cobertura" color={T.red} />
        </div>
      )}

      {/* Alerta novedades escaladas */}
      {kpis?.novedadesEscaladas > 0 && (
        <div style={{
          background: T.redGhost, border: `1px solid ${T.red}`, borderRadius: 8,
          padding: "10px 14px", marginBottom: 14, fontSize: 13, color: T.red,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Icon name="triangle-alert" size={17} /> {kpis.novedadesEscaladas} incidente{kpis.novedadesEscaladas !== 1 ? "s" : ""} escalado{kpis.novedadesEscaladas !== 1 ? "s" : ""} requieren atención
        </div>
      )}

      {/* Donut de estado de guardias + instalaciones */}
      {stats && (
        <div className="central-summary-grid" style={{ display: "grid", gap: 10, marginBottom: 20, alignItems: "start" }}>
          {/* Resumen por instalación */}
          {kpis?.resumenPorInstalacion?.length > 0 && (
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: "14px 14px 10px" }}>
              <div style={{ fontSize: 10, color: T.textSec, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
                Estado por Instalación
              </div>
              {kpis.resumenPorInstalacion.map((inst) => (
                <div className="responsive-list-row" key={inst.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 0", borderBottom: `1px solid ${T.border}`,
                  fontSize: 12,
                }}>
                  <span style={{ color: T.textSec }}>{inst.nombre}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{
                      fontSize: 9, padding: "2px 6px", borderRadius: 6,
                      background: inst.criticidad === "Alta" ? `${T.red}22` : inst.criticidad === "Media" ? `${T.yellow}22` : `${T.accent}22`,
                      color: inst.criticidad === "Alta" ? T.red : inst.criticidad === "Media" ? T.yellow : T.accent,
                    }}>
                      {inst.criticidad}
                    </span>
                    {inst.novedadesActivas > 0 && (
                      <span style={{ fontSize: 11, color: T.alert, fontWeight: 500, fontFamily: FONT.mono, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Icon name="triangle-alert" size={12} /> {inst.novedadesActivas}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: "14px 12px" }}>
            <div style={{ fontSize: 10, color: T.textSec, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
              Estado Hoy
            </div>
            <GraficoDonut presentes={stats.presentes} tardios={stats.tardios} faltantes={stats.faltantes} />
          </div>
        </div>
      )}

      {/* Mapa en vivo */}
      <SubHeader title="Mapa en Vivo · Todas las Instalaciones" />
      <MapaInstalaciones
        token={token}
        ultimaUbicacion={ultimaUbicacion}
        guardiasIniciales={guardiasUbicacion}
      />

      <div style={{ fontSize: 10, color: T.textMut, textAlign: "center", marginTop: 14 }}>
        {socketStatus === "connected"
          ? "Sincronización automática activa"
          : "Actualización manual requerida"}
      </div>
    </div>
  );
}

// ─── EXPORT PRINCIPAL ─────────────────────────────────────────────
// AppShell llama a este componente pasando `section` ("monitoreo" | "incidentes").
export function CentralPanel({ section = "monitoreo" }) {
  const { token } = useAuth();

  if (section === "incidentes") return <IncidentesPanel token={token} />;
  return <MonitoreoPanel token={token} />;
}
