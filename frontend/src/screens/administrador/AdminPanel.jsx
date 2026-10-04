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

// ─── ESTILOS POPUP LEAFLET ───────────────────────────────────────
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
  .leaflet-control-zoom a:hover { background:#22372F !important;color:#3E9A72 !important; }
  .gc-dark-tile, .leaflet-tile-pane .leaflet-tile {
    filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(95%) !important;
  }
`;

// ─── LEAFLET CDN ─────────────────────────────────────────────────
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

// ─── MAPA DE INSTALACIONES ───────────────────────────────────────
const MapaInstalaciones = memo(function MapaInstalaciones({ token, ultimaUbicacion, guardiasIniciales = {} }) {
  const containerRef         = useRef(null);
  const mapRef               = useRef(null);
  const guardiasRef          = useRef({});
  // Capturar en ref para no relanzar el efecto de init cuando cambie el prop
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
            html: `<div style="width:14px;height:14px;background:#3E9A72;border:2.5px solid #0E1714;border-radius:50%;box-shadow:0 0 10px #3E9A72,0 0 20px #00E5B022;"></div>`,
            className: "", iconSize: [14, 14], iconAnchor: [7, 7],
          });
          L.marker([inst.latitud, inst.longitud], { icon })
            .addTo(map)
            .bindPopup(`<b>${inst.nombre}</b><br><span style="color:#A8B7AE;font-size:11px">${inst.direccion || "—"}</span><br><span style="color:#3E9A72;font-size:11px">Radio: ${inst.radio_geofence_m ?? 100}m</span>`, { className: "gc-popup" });
          L.circle([inst.latitud, inst.longitud], {
            radius: inst.radio_geofence_m ?? 100, color: "#3E9A72",
            fillColor: "#3E9A72", fillOpacity: 0.06, weight: 1.5, dashArray: "4 4",
          }).addTo(map);
        });
        if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });

        // Trazar ubicaciones de guardias persistidas en caché (marcadores semitransparentes)
        Object.values(guardiasInicialesRef.current).forEach((ub) => {
          const { guardia_id, latitud, longitud, estado, hora } = ub;
          if (!latitud || !longitud) return;
          const color = estado === "tardio" ? "#F0A35E" : "#3E9A72";
          const icon = L.divIcon({
            html: `<div style="width:9px;height:9px;background:${color};border:2px solid #0E1714;border-radius:50%;opacity:0.55;box-shadow:0 0 6px ${color};"></div>`,
            className: "", iconSize: [9, 9], iconAnchor: [4, 4],
          });
          const t = hora ? new Date(hora).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" }) : "—";
          guardiasRef.current[guardia_id] = L.marker([latitud, longitud], { icon })
            .addTo(map)
            .bindPopup(
              `<b>Última ubicación conocida</b><br>Hora: ${t}<br><span style="color:${color};font-size:10px">${estado === "tardio" ? "Tardío" : "A tiempo"} (sesión anterior)</span>`,
              { className: estado === "tardio" ? "gc-popup-warn" : "gc-popup" },
            );
        });
      })
      .catch((e) => console.error("[Mapa] Error cargando instalaciones:", e))
      .finally(() => setCargando(false));

    return () => { map.remove(); mapRef.current = null; };
  }, [mapReady, token]);

  useEffect(() => {
    if (!ultimaUbicacion || !mapRef.current || !window.L) return;
    const L = window.L;
    const { guardia_id, latitud, longitud, estado, hora } = ultimaUbicacion;
    guardiasRef.current[guardia_id]?.remove();
    const color = estado === "tardio" ? "#F0A35E" : "#3E9A72";
    const icon = L.divIcon({
      html: `<div style="width:10px;height:10px;background:${color};border:2px solid #0E1714;border-radius:50%;box-shadow:0 0 8px ${color};"></div>`,
      className: "", iconSize: [10, 10], iconAnchor: [5, 5],
    });
    const t = new Date(hora).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
    guardiasRef.current[guardia_id] = L.marker([latitud, longitud], { icon })
      .addTo(mapRef.current)
      .bindPopup(`<b>Guardia detectado</b><br>Entrada: ${t}<br><span style="color:${color}">${estado === "tardio" ? "Tardío" : "A tiempo"}</span>`,
        { className: estado === "tardio" ? "gc-popup-warn" : "gc-popup" })
      .openPopup();
  }, [ultimaUbicacion]);

  return (
    <div style={{ position: "relative", marginBottom: 20 }}>
      {cargando && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: T.bgCard, borderRadius: 8, fontSize: 12, color: T.textMut }}>
          Cargando mapa...
        </div>
      )}
      <div ref={containerRef} className="central-map" style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}`, background: "#0E1714" }} />
      <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, color: T.textSec }}>
        <span><span style={{ color: T.accent }}>●</span> Instalación y geocerca</span>
        <span><span style={{ color: T.accent }}>●</span> A tiempo</span>
        <span><span style={{ color: T.yellow }}>●</span> Tardío</span>
      </div>
    </div>
  );
});

// ─── GRÁFICO DE BARRAS SVG ───────────────────────────────────────
function GraficoBarras({ data }) {
  const H = 80, slotW = 28, gap = 7;
  const max  = Math.max(...data.map((d) => d.total), 1);
  const svgW = data.length * (slotW + gap) - gap;

  return (
    <svg
      width="100%" height={H + 24}
      viewBox={`0 0 ${svgW} ${H + 24}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: "visible" }}
    >
      {data.map((d, i) => {
        const x    = i * (slotW + gap);
        const h    = d.total > 0 ? Math.max((d.total / max) * H, 4) : 2;
        const y    = H - h;
        const color = d.rojo > 0 ? "#E86A2A" : d.amarillo > 0 ? "#F0A35E" : "#3E9A72";
        return (
          <g key={d.fecha}>
            <rect x={x} y={y} width={slotW} height={h} fill={color} opacity={0.85} rx={3} />
            {d.total === 0 && <rect x={x} y={H - 2} width={slotW} height={2} fill="#2C4038" rx={1} />}
            <text x={x + slotW / 2} y={H + 14} textAnchor="middle" fontSize="7" fill="#7C8F85">{d.label}</text>
            {d.total > 0 && (
              <text x={x + slotW / 2} y={y - 4} textAnchor="middle" fontSize="8" fill="#F3EFE6" fontWeight="700">{d.total}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── GRÁFICO DONUT SVG ───────────────────────────────────────────
function GraficoDonut({ presentes = 0, tardios = 0, faltantes = 0 }) {
  const segmentos = [
    { label: "Presentes", value: presentes,  color: "#3E9A72" },
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
    const p0 = pol(a0), p1 = pol(a1);
    const q0 = ipl(a0), q1 = ipl(a1);
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

// ─── INDICADOR DE CONEXIÓN ───────────────────────────────────────
function SocketBadge({ status }) {
  const cfg = {
    connected:    { dot: T.accent,  label: "En vivo" },
    reconnecting: { dot: T.yellow,  label: "Reconectando…" },
    disconnected: { dot: T.alert,   label: "Sin conexión" },
  }[status] ?? { dot: T.textMut, label: status };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: T.textSec }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot, flex: "none" }} />
      {cfg.label}
    </div>
  );
}

function MiniStat({ value, label, color }) {
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "12px 14px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 500, color, fontFamily: FONT.mono, fontVariantNumeric: "tabular-nums" }}>{value ?? "—"}</span>
    </div>
  );
}

const ACCIONES = [
  { label: "Crear usuario",          icon: "user-round" },
  { label: "Nueva instalación",      icon: "building-2" },
  { label: "Importar turnos (lote)", icon: "download" },
  { label: "Auditoría de cambios",   icon: "search" },
  { label: "Configuración",          icon: "settings" },
];

// ─── PANTALLA PRINCIPAL ──────────────────────────────────────────
export function AdminPanel() {
  const { token } = useAuth();

  // ── Estado con semilla desde caché (silent refresh en segundo plano) ──
  const [stats,              setStats]           = useState(() => cacheRead(CACHE_KEYS.adminStats));
  const [analytics,          setAnalytics]       = useState(() => cacheRead(CACHE_KEYS.adminAnalytics));
  // Si había datos cacheados, no mostramos spinner invasivo
  const [loading,            setLoading]         = useState(() => cacheRead(CACHE_KEYS.adminStats) === null);
  const [socketStatus,       setSocketStatus]    = useState("disconnected");
  // Mapa completo de ubicaciones de guardias { [guardia_id]: { latitud, longitud, estado, hora } }
  const [guardiasUbicacion,  setGuardiasUbicacion] = useState(
    () => cacheRead(CACHE_KEYS.adminGuardiasMapa) ?? {},
  );
  // Última actualización individual (dispara el efecto del marcador en tiempo real)
  const [ultimaUbicacion, setUltimaUbicacion] = useState(null);
  const socketRef = useRef(null);

  const fetchStats = async () => {
    try {
      const res  = await fetch(`${API_BASE}/dashboard/hoy`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok) { setStats(json); cacheWrite(CACHE_KEYS.adminStats, json); }
    } catch (e) {
      console.error("[AdminPanel] fetchStats:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res  = await fetch(`${API_BASE}/reportes/semana`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok) { setAnalytics(json); cacheWrite(CACHE_KEYS.adminAnalytics, json); }
    } catch (e) {
      console.error("[AdminPanel] fetchAnalytics:", e);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchAnalytics();

    const socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket"], reconnectionDelay: 2000 });
    socketRef.current = socket;

    socket.on("connect",          ()  => { console.log("[AdminPanel] Socket:", socket.id); setSocketStatus("connected"); });
    socket.on("disconnect",       ()  => setSocketStatus("disconnected"));
    socket.on("connect_error",    ()  => setSocketStatus("reconnecting"));
    socket.on("reconnect_attempt",()  => setSocketStatus("reconnecting"));

    socket.on("admin:dashboard_update", (p) => {
      console.log("[AdminPanel] Dashboard update →", p);
      fetchStats();
      fetchAnalytics();
    });

    socket.on("guardia:ubicacion", (p) => {
      console.log("[AdminPanel] Ubicación guardia →", p);
      // Actualizar el marcador en tiempo real
      setUltimaUbicacion(p);
      // Persistir la ubicación en el mapa completo y en caché
      setGuardiasUbicacion((prev) => {
        const next = { ...prev, [p.guardia_id]: p };
        cacheWrite(CACHE_KEYS.adminGuardiasMapa, next);
        return next;
      });
    });

    return () => { socket.disconnect(); };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = stats?.adminStats;
  const n = s?.novedadesAbiertas ?? 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <SectionHeader title="Panel central" sub="Vista general del sistema" />
        <SocketBadge status={socketStatus} />
      </div>

      {/* Indicadores: datos cacheados al instante; "—" solo si aún no hay nada */}
      <div className="central-kpis">
        <KPI label="Guardias"      value={s?.totalGuardias      ?? (loading ? "…" : "—")} sub="activos" />
        <KPI label="Instalaciones" value={s?.totalInstalaciones ?? (loading ? "…" : "—")} sub="operativas" />
        <KPI label="Turnos hoy"    value={stats?.total          ?? (loading ? "…" : "—")} sub="programados" />
        <KPI label="Cobertura"     value={s ? `${s.coberturaMensual ?? 0}%` : (loading ? "…" : "—")} sub="mensual" accent={T.accent} />
        {stats && <MiniStat value={stats.presentes} label="Presentes" color={T.accent} />}
        {stats && <MiniStat value={stats.tardios}   label="Tardíos"   color={T.yellow} />}
        {stats && <MiniStat value={stats.faltantes} label="Faltantes" color={T.alert} />}
      </div>

      {n > 0 && (
        <div style={{ background: T.alertGhost, border: `1px solid ${T.alert}`, borderRadius: T.radius, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: T.text, display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="triangle-alert" size={18} color={T.alert} />
          {n} novedad{n !== 1 ? "es" : ""} abierta{n !== 1 ? "s" : ""} sin resolver
        </div>
      )}

      {/* El mapa es la pieza principal; los gráficos van en la columna lateral */}
      <div className="central-grid">
        <section aria-label="Instalaciones en el mapa">
          <SubHeader title="Instalaciones · mapa en vivo" />
          <MapaInstalaciones
            token={token}
            ultimaUbicacion={ultimaUbicacion}
            guardiasIniciales={guardiasUbicacion}
          />
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: T.textSec, marginBottom: 10 }}>Novedades · últimos 7 días</div>
            {analytics ? (
              <GraficoBarras data={analytics} />
            ) : (
              <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMut, fontSize: 12 }}>
                Cargando…
              </div>
            )}
            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: T.textSec }}>
              <span><span style={{ color: T.alert }}>■</span> Crítico</span>
              <span><span style={{ color: T.yellow }}>■</span> Medio</span>
              <span><span style={{ color: T.accent }}>■</span> Bajo</span>
            </div>
          </div>

          {stats && (
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "12px 14px" }}>
              <div style={{ fontSize: 12, color: T.textSec, marginBottom: 10 }}>Estado hoy</div>
              <GraficoDonut presentes={stats.presentes} tardios={stats.tardios} faltantes={stats.faltantes} />
            </div>
          )}

          <div>
            <SubHeader title="Acciones rápidas" />
            {ACCIONES.map((a, i) => (
              <div key={i} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, minHeight: 40, padding: "0 12px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <Icon name={a.icon} size={17} color={T.textSec} />
                <span style={{ fontWeight: 500, fontSize: 13, flex: 1 }}>{a.label}</span>
                <Icon name="chevron-right" size={15} color={T.textMut} />
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div style={{ fontSize: 11, color: T.textMut, marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: socketStatus === "connected" ? T.accent : T.textMut }} />
        {socketStatus === "connected" ? "Sincronización automática activa" : "Actualización manual requerida"}
      </div>
    </div>
  );
}
