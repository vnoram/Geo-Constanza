import { useState, useEffect, useRef, memo } from "react";
import { io } from "socket.io-client";
import { T } from "../../theme/theme";
import { KPI } from "../../components/ui/KPI";
import { SubHeader } from "../../components/ui/SubHeader";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";
import { cacheRead, cacheWrite, CACHE_KEYS } from "../../utils/cache";

const API_BASE   = import.meta.env.VITE_API_URL || "http://localhost:3005/api/v1";
const SOCKET_URL = API_BASE.replace("/api/v1", "");

// Color de marca para el rol Central
const C_COLOR = "#4FC3F7"; // Azul cian — diferente al verde (admin) y amarillo (supervisor)

// ─── ESTILOS POPUP LEAFLET ────────────────────────────────────────
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
  .leaflet-control-zoom a:hover { background:#122240 !important;color:#4FC3F7 !important; }
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
            html: `<div style="width:14px;height:14px;background:${C_COLOR};border:2.5px solid #060D18;border-radius:50%;box-shadow:0 0 10px ${C_COLOR},0 0 20px ${C_COLOR}22;"></div>`,
            className: "", iconSize: [14, 14], iconAnchor: [7, 7],
          });
          L.marker([inst.latitud, inst.longitud], { icon })
            .addTo(map)
            .bindPopup(
              `<b>${inst.nombre}</b><br>` +
              `<span style="color:#7B8FA8;font-size:11px">${inst.direccion || "—"}</span><br>` +
              `<span style="color:${C_COLOR};font-size:11px">Radio: ${inst.radio_geofence_m ?? 100}m · ${inst.nivel_criticidad ?? "Media"}</span>`,
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
          const color = estado === "tardio" ? "#FFBE2E" : C_COLOR;
          const icon = L.divIcon({
            html: `<div style="width:9px;height:9px;background:${color};border:2px solid #060D18;border-radius:50%;opacity:0.55;box-shadow:0 0 6px ${color};"></div>`,
            className: "", iconSize: [9, 9], iconAnchor: [4, 4],
          });
          const t = hora ? new Date(hora).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "—";
          guardiasRef.current[guardia_id] = L.marker([latitud, longitud], { icon })
            .addTo(map)
            .bindPopup(
              `<b>Última ubicación conocida</b><br>Hora: ${t}<br>` +
              `<span style="color:${color};font-size:10px">${estado === "tardio" ? "⚠️ Tardío" : "✓ A tiempo"} (sesión anterior)</span>`,
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
    const color = estado === "tardio" ? "#FFBE2E" : C_COLOR;
    const icon = L.divIcon({
      html: `<div style="width:10px;height:10px;background:${color};border:2px solid #060D18;border-radius:50%;box-shadow:0 0 8px ${color};"></div>`,
      className: "", iconSize: [10, 10], iconAnchor: [5, 5],
    });
    const t = new Date(hora).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    guardiasRef.current[guardia_id] = L.marker([latitud, longitud], { icon })
      .addTo(mapRef.current)
      .bindPopup(
        `<b>Guardia detectado</b><br>Entrada: ${t}<br>` +
        `<span style="color:${color}">${estado === "tardio" ? "⚠️ Tardío" : "✓ A tiempo"}</span>`,
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
          background: T.bgCard, borderRadius: 14, fontSize: 12, color: T.textMut,
        }}>
          Cargando mapa...
        </div>
      )}
      <div
        ref={containerRef}
        style={{ height: 280, borderRadius: 14, overflow: "hidden", border: `1px solid ${T.border}`, background: "#060D18" }}
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
    const p0 = pol(a0), p1 = pol(a1), q0 = ipl(a0), q1 = ipl(a1);
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
    <div style={{ background: T.bgCard, border: `1px solid ${color}22`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value ?? "—"}</div>
      <div style={{ fontSize: 10, color: T.textMut, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── PANEL DE INCIDENTES (sección "incidentes") ───────────────────
// Central puede ver y gestionar novedades de TODAS las instalaciones.
function IncidentesPanel({ token }) {
  const [novedades, setNovedades] = useState([]);
  const [loading, setLoading]    = useState(true);
  const [filtro, setFiltro]      = useState("todas"); // todas | abierta | escalada

  const cargar = async () => {
    setLoading(true);
    try {
      const params = filtro !== "todas" ? `?estado=${filtro}` : "";
      const res  = await fetch(`${API_BASE}/novedades${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setNovedades(Array.isArray(json) ? json : (json.data ?? []));
    } catch (e) {
      console.error("[CentralIncidentes]", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [filtro]); // eslint-disable-line react-hooks/exhaustive-deps

  const URGENCIA_COLOR = { verde: T.accent, amarillo: T.yellow, rojo: T.red };
  const ESTADO_COLOR   = { abierta: T.yellow, escalada: T.red, resuelta: T.accent };

  const FILTROS = [
    { id: "todas",   label: "Todas" },
    { id: "abierta", label: "Abiertas" },
    { id: "escalada",label: "Escaladas" },
  ];

  return (
    <div>
      <SectionHeader title="Incidentes" sub="Todas las instalaciones" />

      {/* Filtros */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {FILTROS.map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)} style={{
            padding: "6px 14px", borderRadius: 8, border: `1px solid ${filtro === f.id ? C_COLOR + "66" : T.border}`,
            background: filtro === f.id ? `${C_COLOR}15` : "transparent",
            color: filtro === f.id ? C_COLOR : T.textMut,
            fontSize: 12, fontWeight: filtro === f.id ? 700 : 500,
            cursor: "pointer", fontFamily: "'Outfit', sans-serif",
          }}>
            {f.label}
          </button>
        ))}
        <button onClick={cargar} style={{
          marginLeft: "auto", padding: "6px 12px", borderRadius: 8,
          border: `1px solid ${T.border}`, background: "transparent",
          color: T.textMut, fontSize: 11, cursor: "pointer",
          fontFamily: "'Outfit', sans-serif",
        }}>
          ↻ Actualizar
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", color: T.textMut, fontSize: 13, padding: 32 }}>
          Cargando incidentes...
        </div>
      )}

      {!loading && novedades.length === 0 && (
        <div style={{
          textAlign: "center", color: T.textMut, fontSize: 13,
          background: T.bgCard, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: "32px 16px",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          Sin incidentes {filtro !== "todas" ? `en estado "${filtro}"` : "registrados"}
        </div>
      )}

      {novedades.map((n) => {
        const urgColor   = URGENCIA_COLOR[n.urgencia]  ?? T.textMut;
        const estadoColor = ESTADO_COLOR[n.estado]      ?? T.textMut;
        const hora = new Date(n.created_at).toLocaleString("es-CL", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        });
        return (
          <div key={n.id} style={{
            background: T.bgCard, border: `1px solid ${urgColor}22`,
            borderLeft: `3px solid ${urgColor}`,
            borderRadius: 12, padding: "12px 14px", marginBottom: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{n.tipo}</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 7px",
                  borderRadius: 8, background: `${urgColor}22`, color: urgColor,
                  textTransform: "uppercase",
                }}>
                  {n.urgencia}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 7px",
                  borderRadius: 8, background: `${estadoColor}22`, color: estadoColor,
                  textTransform: "uppercase",
                }}>
                  {n.estado}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: T.textSec, marginBottom: 4 }}>{n.descripcion}</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.textMut }}>
              <span>🏢 {n.instalacion?.nombre ?? "—"}</span>
              <span>👤 {n.usuario?.nombre ?? "—"}</span>
              <span>{hora}</span>
            </div>
          </div>
        );
      })}
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

    const socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket"], reconnectionDelay: 2000 });
    socketRef.current = socket;

    socket.on("connect",           () => { console.log("[CentralPanel] Socket:", socket.id); setSocketStatus("connected"); });
    socket.on("disconnect",        () => setSocketStatus("disconnected"));
    socket.on("connect_error",     () => setSocketStatus("reconnecting"));
    socket.on("reconnect_attempt", () => setSocketStatus("reconnecting"));

    socket.on("admin:dashboard_update", () => fetchStats());

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
    <div>
      <SectionHeader title="Monitoreo Central" sub="Vista global de todas las instalaciones" />
      <SocketBadge status={socketStatus} />

      {/* KPIs de cobertura */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <MiniStat value={stats.presentes} label="Presentes"  color={C_COLOR}  />
          <MiniStat value={stats.tardios}   label="Tardíos"    color={T.yellow} />
          <MiniStat value={stats.faltantes} label="Faltantes"  color={T.red}    />
        </div>
      )}

      {/* Alerta novedades escaladas */}
      {kpis?.novedadesEscaladas > 0 && (
        <div style={{
          background: T.redGhost, border: `1px solid ${T.red}`, borderRadius: 10,
          padding: "10px 14px", marginBottom: 14, fontSize: 13, color: T.red,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          🚨 {kpis.novedadesEscaladas} incidente{kpis.novedadesEscaladas !== 1 ? "s" : ""} escalado{kpis.novedadesEscaladas !== 1 ? "s" : ""} requieren atención
        </div>
      )}

      {/* Donut de estado de guardias + instalaciones */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 20, alignItems: "start" }}>
          {/* Resumen por instalación */}
          {kpis?.resumenPorInstalacion?.length > 0 && (
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 14px 10px" }}>
              <div style={{ fontSize: 10, color: T.textSec, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
                Estado por Instalación
              </div>
              {kpis.resumenPorInstalacion.map((inst) => (
                <div key={inst.id} style={{
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
                      <span style={{ fontSize: 10, color: T.red, fontWeight: 700 }}>
                        ⚠ {inst.novedadesActivas}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 12px" }}>
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
          ? "🔵 Sincronización automática activa"
          : "⚪ Actualización manual requerida"}
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
