import { useState, useEffect, useRef, memo } from "react";
import { io } from "socket.io-client";
import { T } from "../../theme/theme";
import { KPI } from "../../components/ui/KPI";
import { SubHeader } from "../../components/ui/SubHeader";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";

const API_BASE   = import.meta.env.VITE_API_URL || "http://localhost:3005/api/v1";
const SOCKET_URL = API_BASE.replace("/api/v1", "");

// ─── ESTILOS POPUP LEAFLET ───────────────────────────────────────
const LEAFLET_STYLES = `
  .gc-popup .leaflet-popup-content-wrapper {
    background:#0D1A2D;border:1px solid #1A2D4A;color:#E4EAF2;
    border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,.6);
    font-family:'Outfit',sans-serif;font-size:13px;
  }
  .gc-popup .leaflet-popup-tip { background:#0D1A2D; }
  .gc-popup .leaflet-popup-close-button { color:#4A5E78 !important; }
  .gc-popup-warn .leaflet-popup-content-wrapper {
    background:#1a1200;border:1px solid #FFBE2E44;color:#FFBE2E;
    border-radius:10px;font-family:'Outfit',sans-serif;font-size:12px;
  }
  .gc-popup-warn .leaflet-popup-tip { background:#1a1200; }
  .leaflet-control-attribution { display:none !important; }
  .leaflet-control-zoom a {
    background:#0D1A2D !important;border-color:#1A2D4A !important;color:#7B8FA8 !important;
  }
  .leaflet-control-zoom a:hover { background:#122240 !important;color:#00E5B0 !important; }
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
const MapaInstalaciones = memo(function MapaInstalaciones({ token, ultimaUbicacion }) {
  const containerRef    = useRef(null);
  const mapRef          = useRef(null);
  const guardiasRef     = useRef({});
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
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd",
    }).addTo(map);
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
            html: `<div style="width:14px;height:14px;background:#00E5B0;border:2.5px solid #060D18;border-radius:50%;box-shadow:0 0 10px #00E5B0,0 0 20px #00E5B022;"></div>`,
            className: "", iconSize: [14, 14], iconAnchor: [7, 7],
          });
          L.marker([inst.latitud, inst.longitud], { icon })
            .addTo(map)
            .bindPopup(`<b>${inst.nombre}</b><br><span style="color:#7B8FA8;font-size:11px">${inst.direccion || "—"}</span><br><span style="color:#00E5B0;font-size:11px">Radio: ${inst.radio_geofence_m ?? 100}m</span>`, { className: "gc-popup" });
          L.circle([inst.latitud, inst.longitud], {
            radius: inst.radio_geofence_m ?? 100, color: "#00E5B0",
            fillColor: "#00E5B0", fillOpacity: 0.06, weight: 1.5, dashArray: "4 4",
          }).addTo(map);
        });
        if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
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
    const color = estado === "tardio" ? "#FFBE2E" : "#00E5B0";
    const icon = L.divIcon({
      html: `<div style="width:10px;height:10px;background:${color};border:2px solid #060D18;border-radius:50%;box-shadow:0 0 8px ${color};"></div>`,
      className: "", iconSize: [10, 10], iconAnchor: [5, 5],
    });
    const t = new Date(hora).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    guardiasRef.current[guardia_id] = L.marker([latitud, longitud], { icon })
      .addTo(mapRef.current)
      .bindPopup(`<b>Guardia detectado</b><br>Entrada: ${t}<br><span style="color:${color}">${estado === "tardio" ? "⚠️ Tardío" : "✓ A tiempo"}</span>`,
        { className: estado === "tardio" ? "gc-popup-warn" : "gc-popup" })
      .openPopup();
  }, [ultimaUbicacion]);

  return (
    <div style={{ position: "relative", marginBottom: 20 }}>
      {cargando && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: T.bgCard, borderRadius: 14, fontSize: 12, color: T.textMut }}>
          Cargando mapa...
        </div>
      )}
      <div ref={containerRef} style={{ height: 260, borderRadius: 14, overflow: "hidden", border: `1px solid ${T.border}`, background: "#060D18" }} />
      <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 10, color: T.textMut }}>
        <span><span style={{ color: T.accent }}>●</span> Instalación</span>
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
        const color = d.rojo > 0 ? "#FF5270" : d.amarillo > 0 ? "#FFBE2E" : "#00E5B0";
        return (
          <g key={d.fecha}>
            <rect x={x} y={y} width={slotW} height={h} fill={color} opacity={0.85} rx={3} />
            {d.total === 0 && <rect x={x} y={H - 2} width={slotW} height={2} fill="#1A2D4A" rx={1} />}
            <text x={x + slotW / 2} y={H + 14} textAnchor="middle" fontSize="7" fill="#4A5E78">{d.label}</text>
            {d.total > 0 && (
              <text x={x + slotW / 2} y={y - 4} textAnchor="middle" fontSize="8" fill="#E4EAF2" fontWeight="700">{d.total}</text>
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
    { label: "Presentes", value: presentes,  color: "#00E5B0" },
    { label: "Tardíos",   value: tardios,    color: "#FFBE2E" },
    { label: "Ausentes",  value: faltantes,  color: "#FF5270" },
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
        <circle cx={CX} cy={CY} r={r - 2} fill="#060D18" />
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#E4EAF2">{total}</text>
        <text x={CX} y={CY + 9} textAnchor="middle" fontSize="7" fill="#4A5E78">TURNOS</text>
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
    reconnecting: { dot: T.yellow,  label: "Reconectando..." },
    disconnected: { dot: T.red,     label: "Sin conexión" },
  }[status] ?? { dot: T.textMut, label: status };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textMut, marginBottom: 14 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, boxShadow: status === "connected" ? `0 0 6px ${cfg.dot}` : "none" }} />
      {cfg.label}
    </div>
  );
}

function MiniStat({ value, label, color }) {
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${color}22`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value ?? "—"}</div>
      <div style={{ fontSize: 10, color: T.textMut, marginTop: 2 }}>{label}</div>
    </div>
  );
}

const ACCIONES = [
  { label: "Crear Usuario",           icon: "👤" },
  { label: "Nueva Instalación",       icon: "🏢" },
  { label: "Importar Turnos (Lote)",  icon: "📥" },
  { label: "Auditoría de Cambios",    icon: "🔍" },
  { label: "Configuración",           icon: "⚙️" },
];

// ─── PANTALLA PRINCIPAL ──────────────────────────────────────────
export function AdminPanel() {
  const { token } = useAuth();
  const [stats,           setStats]           = useState(null);
  const [analytics,       setAnalytics]       = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [socketStatus,    setSocketStatus]    = useState("disconnected");
  const [ultimaUbicacion, setUltimaUbicacion] = useState(null);
  const socketRef = useRef(null);

  const fetchStats = async () => {
    try {
      const res  = await fetch(`${API_BASE}/dashboard/hoy`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok) setStats(json);
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
      if (res.ok) setAnalytics(json);
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
      setUltimaUbicacion(p);
    });

    return () => { socket.disconnect(); };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = stats?.adminStats;

  return (
    <div>
      <SectionHeader title="Panel Central" sub="Vista general del sistema" />
      <SocketBadge status={socketStatus} />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <KPI label="Guardias"      value={loading ? "—" : (s?.totalGuardias      ?? "—")} sub="activos"     accent="#B98CFF" />
        <KPI label="Instalaciones" value={loading ? "—" : (s?.totalInstalaciones ?? "—")} sub="operativas"  accent="#B98CFF" />
        <KPI label="Turnos Hoy"    value={loading ? "—" : (stats?.total          ?? "—")} sub="programados" accent={T.accent} />
        <KPI label="Cobertura"     value={loading ? "—" : `${s?.coberturaMensual ?? 0}%`} sub="mensual"     accent={T.accent} />
      </div>

      {/* Mini stats */}
      {!loading && stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <MiniStat value={stats.presentes} label="Presentes" color={T.accent} />
          <MiniStat value={stats.tardios}   label="Tardíos"   color={T.yellow} />
          <MiniStat value={stats.faltantes} label="Faltantes" color={T.red}    />
        </div>
      )}

      {/* Alerta novedades */}
      {s?.novedadesAbiertas > 0 && (
        <div style={{ background: T.redGhost, border: `1px solid ${T.red}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: T.red, display: "flex", alignItems: "center", gap: 8 }}>
          🚨 {s.novedadesAbiertas} novedad{s.novedadesAbiertas !== 1 ? "es" : ""} abierta{s.novedadesAbiertas !== 1 ? "s" : ""} sin resolver
        </div>
      )}

      {/* ── Gráficos de Gestión ── */}
      <SubHeader title="Gráficos de Gestión" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 20, alignItems: "start" }}>
        {/* Barras: novedades últimos 7 días */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 14px 10px" }}>
          <div style={{ fontSize: 10, color: T.textSec, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
            Novedades · Últimos 7 Días
          </div>
          {analytics ? (
            <GraficoBarras data={analytics} />
          ) : (
            <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMut, fontSize: 11 }}>
              Cargando...
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 9, color: T.textMut }}>
            <span><span style={{ color: T.red }}>■</span> Crítico</span>
            <span><span style={{ color: T.yellow }}>■</span> Medio</span>
            <span><span style={{ color: T.accent }}>■</span> Bajo</span>
          </div>
        </div>

        {/* Donut: estado guardias hoy */}
        {!loading && stats && (
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 12px" }}>
            <div style={{ fontSize: 10, color: T.textSec, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
              Estado Hoy
            </div>
            <GraficoDonut presentes={stats.presentes} tardios={stats.tardios} faltantes={stats.faltantes} />
          </div>
        )}
      </div>

      {/* Mapa */}
      <SubHeader title="Instalaciones · Mapa en Vivo" />
      <MapaInstalaciones token={token} ultimaUbicacion={ultimaUbicacion} />

      {/* Acciones */}
      <SubHeader title="Acciones Rápidas" />
      {ACCIONES.map((a, i) => (
        <div key={i} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: 13, marginBottom: 5, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <span style={{ fontSize: 15 }}>{a.icon}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</span>
        </div>
      ))}

      <div style={{ fontSize: 10, color: T.textMut, textAlign: "center", marginTop: 14 }}>
        {socketStatus === "connected" ? "🔴 Sincronización automática activa" : "⚪ Actualización manual requerida"}
      </div>
    </div>
  );
}
