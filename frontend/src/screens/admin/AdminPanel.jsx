import { useState, useEffect, useRef, memo } from "react";
import { io } from "socket.io-client";
import { T } from "../../theme/theme";
import { KPI } from "../../components/ui/KPI";
import { SubHeader } from "../../components/ui/SubHeader";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";

const API_BASE   = import.meta.env.VITE_API_URL || "http://localhost:3005/api/v1";
const SOCKET_URL = API_BASE.replace("/api/v1", "");

// ─── ESTILOS POPUP LEAFLET (tema oscuro/neón) ────────────────────
const LEAFLET_STYLES = `
  .gc-popup .leaflet-popup-content-wrapper {
    background: #0D1A2D;
    border: 1px solid #1A2D4A;
    color: #E4EAF2;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.6);
    font-family: 'Outfit', sans-serif;
    font-size: 13px;
  }
  .gc-popup .leaflet-popup-tip { background: #0D1A2D; }
  .gc-popup .leaflet-popup-close-button { color: #4A5E78 !important; }
  .gc-popup-guardia .leaflet-popup-content-wrapper {
    background: #1a1200;
    border: 1px solid #FFBE2E44;
    color: #FFBE2E;
    border-radius: 10px;
    font-family: 'Outfit', sans-serif;
    font-size: 12px;
  }
  .gc-popup-guardia .leaflet-popup-tip { background: #1a1200; }
  .leaflet-control-attribution { display: none !important; }
  .leaflet-control-zoom a {
    background: #0D1A2D !important;
    border-color: #1A2D4A !important;
    color: #7B8FA8 !important;
  }
  .leaflet-control-zoom a:hover { background: #122240 !important; color: #00E5B0 !important; }
`;

// ─── CARGA DINÁMICA DE LEAFLET DESDE CDN ─────────────────────────
function useLeafletCDN(onReady) {
  useEffect(() => {
    if (window.L) { onReady(); return; }

    if (!document.getElementById("leaflet-css")) {
      const css = document.createElement("link");
      css.id   = "leaflet-css";
      css.rel  = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
    }

    const script = document.createElement("script");
    script.src    = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => onReady();
    script.onerror = () => console.error("[Leaflet] Error al cargar desde CDN");
    document.head.appendChild(script);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

// ─── MAPA DE INSTALACIONES ───────────────────────────────────────
const MapaInstalaciones = memo(function MapaInstalaciones({ token, ultimaUbicacion }) {
  const mapContainerRef  = useRef(null);
  const mapInstanceRef   = useRef(null);
  const guardiaMarkersRef = useRef({});  // guardia_id → marker
  const [mapReady, setMapReady] = useState(false);
  const [cargando, setCargando] = useState(true);

  useLeafletCDN(() => setMapReady(true));

  // ── Inicializar mapa ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapContainerRef.current || mapInstanceRef.current) return;

    // Inyectar estilos personalizados
    if (!document.getElementById("gc-map-styles")) {
      const style = document.createElement("style");
      style.id   = "gc-map-styles";
      style.textContent = LEAFLET_STYLES;
      document.head.appendChild(style);
    }

    const L = window.L;
    const map = L.map(mapContainerRef.current, {
      center: [-33.45, -70.65],  // Santiago, Chile
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    });

    // Tiles oscuros CartoDB Dark Matter (sin API key)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    mapInstanceRef.current = map;

    // ── Cargar instalaciones ──────────────────────────────────
    fetch(`${API_BASE}/instalaciones`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const lista = Array.isArray(data) ? data : (data.data ?? []);
        const bounds = [];

        lista.forEach((inst) => {
          if (!inst.latitud || !inst.longitud) return;
          bounds.push([inst.latitud, inst.longitud]);

          // Marcador neon para cada instalación
          const icon = L.divIcon({
            html: `
              <div style="
                width:14px;height:14px;background:#00E5B0;
                border:2.5px solid #060D18;border-radius:50%;
                box-shadow:0 0 10px #00E5B0,0 0 20px #00E5B022;
              "></div>`,
            className: "",
            iconSize:   [14, 14],
            iconAnchor: [7, 7],
          });

          const popup = `
            <div style="min-width:140px">
              <div style="font-weight:800;font-size:14px;margin-bottom:4px">${inst.nombre}</div>
              <div style="color:#7B8FA8;font-size:11px">${inst.direccion || "Sin dirección"}</div>
              <div style="color:#00E5B0;font-size:11px;margin-top:6px">
                Radio: ${inst.radio_geofence_m ?? 100}m
              </div>
            </div>`;

          L.marker([inst.latitud, inst.longitud], { icon })
            .addTo(map)
            .bindPopup(popup, { className: "gc-popup" });

          // Círculo de geocerca
          L.circle([inst.latitud, inst.longitud], {
            radius:      inst.radio_geofence_m ?? 100,
            color:       "#00E5B0",
            fillColor:   "#00E5B0",
            fillOpacity: 0.06,
            weight:      1.5,
            dashArray:   "4 4",
          }).addTo(map);
        });

        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        }
      })
      .catch((e) => console.error("[MapaInstalaciones] Error cargando instalaciones:", e))
      .finally(() => setCargando(false));

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [mapReady, token]);

  // ── Actualizar marcador del guardia al recibir ubicación ────
  useEffect(() => {
    if (!ultimaUbicacion || !mapInstanceRef.current || !window.L) return;
    const L   = window.L;
    const map = mapInstanceRef.current;
    const { guardia_id, latitud, longitud, estado } = ultimaUbicacion;

    // Eliminar marcador previo del mismo guardia
    if (guardiaMarkersRef.current[guardia_id]) {
      guardiaMarkersRef.current[guardia_id].remove();
    }

    const color  = estado === "tardio" ? "#FFBE2E" : "#00E5B0";
    const shadow = estado === "tardio" ? "#FFBE2E" : "#00E5B0";

    const icon = L.divIcon({
      html: `
        <div style="
          width:10px;height:10px;background:${color};
          border:2px solid #060D18;border-radius:50%;
          box-shadow:0 0 8px ${shadow};
        "></div>`,
      className: "",
      iconSize:   [10, 10],
      iconAnchor: [5, 5],
    });

    const hora = new Date(ultimaUbicacion.hora).toLocaleTimeString("es-CL", {
      hour: "2-digit", minute: "2-digit",
    });

    guardiaMarkersRef.current[guardia_id] = L.marker([latitud, longitud], { icon })
      .addTo(map)
      .bindPopup(
        `<div>
          <div style="font-weight:700;margin-bottom:3px">Guardia detectado</div>
          <div style="font-size:11px">Entrada: ${hora}</div>
          <div style="font-size:11px;margin-top:3px;color:${color}">
            ${estado === "tardio" ? "⚠️ Tardío" : "✓ A tiempo"}
          </div>
        </div>`,
        { className: estado === "tardio" ? "gc-popup-guardia" : "gc-popup" },
      )
      .openPopup();

    console.log("[MapaInstalaciones] Marcador guardia actualizado:", guardia_id);
  }, [ultimaUbicacion]);

  return (
    <div style={{ position: "relative", marginBottom: 20 }}>
      {cargando && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: T.bgCard, borderRadius: 14,
          fontSize: 12, color: T.textMut,
        }}>
          Cargando mapa...
        </div>
      )}
      <div
        ref={mapContainerRef}
        style={{
          height: 290, borderRadius: 14, overflow: "hidden",
          border: `1px solid ${T.border}`,
          background: "#060D18",
        }}
      />
      <div style={{
        display: "flex", gap: 14, marginTop: 8, fontSize: 10, color: T.textMut,
      }}>
        <span>
          <span style={{ color: T.accent }}>●</span> Instalación · geocerca
        </span>
        <span>
          <span style={{ color: T.yellow }}>●</span> Guardia (tardío)
        </span>
        <span>
          <span style={{ color: T.accent }}>●</span> Guardia (a tiempo)
        </span>
      </div>
    </div>
  );
});

// ─── INDICADOR DE CONEXIÓN ───────────────────────────────────────
function SocketBadge({ status }) {
  const cfg = {
    connected:    { dot: T.accent,  label: "En vivo" },
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

// ─── MINI STAT ───────────────────────────────────────────────────
function MiniStat({ value, label, color }) {
  return (
    <div style={{
      background: T.bgCard, border: `1px solid ${color}22`,
      borderRadius: 10, padding: "10px 12px", textAlign: "center",
    }}>
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
  const [stats,          setStats]          = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [socketStatus,   setSocketStatus]   = useState("disconnected");
  const [ultimaUbicacion, setUltimaUbicacion] = useState(null);
  const socketRef = useRef(null);

  // ── Fetch de datos del dashboard ──────────────────────────────
  const fetchStats = async () => {
    try {
      const res  = await fetch(`${API_BASE}/dashboard/hoy`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) setStats(json);
    } catch (e) {
      console.error("[AdminPanel] Error cargando stats:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── Conexión socket ───────────────────────────────────────────
  useEffect(() => {
    fetchStats();

    const socket = io(SOCKET_URL, {
      auth:              { token },
      transports:        ["websocket"],
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[AdminPanel] Socket conectado:", socket.id);
      setSocketStatus("connected");
    });

    socket.on("disconnect", () => {
      console.log("[AdminPanel] Socket desconectado");
      setSocketStatus("disconnected");
    });

    socket.on("connect_error", (err) => {
      console.warn("[AdminPanel] Error de conexión socket:", err.message);
      setSocketStatus("reconnecting");
    });

    socket.on("reconnect_attempt", () => setSocketStatus("reconnecting"));

    // KPIs en tiempo real
    socket.on("admin:dashboard_update", (payload) => {
      console.log("[AdminPanel] Dashboard update →", payload);
      fetchStats();
    });

    // Ubicación de guardia → actualiza el mapa
    socket.on("guardia:ubicacion", (payload) => {
      console.log("[AdminPanel] Ubicación guardia recibida →", payload);
      setUltimaUbicacion(payload);
    });

    return () => {
      socket.disconnect();
      console.log("[AdminPanel] Socket cerrado al desmontar");
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = stats?.adminStats;

  return (
    <div>
      <SectionHeader title="Panel Central" sub="Vista general del sistema" />

      <SocketBadge status={socketStatus} />

      {/* KPIs principales */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <KPI label="Guardias"      value={loading ? "—" : (s?.totalGuardias       ?? "—")} sub="activos"     accent="#B98CFF" />
        <KPI label="Instalaciones" value={loading ? "—" : (s?.totalInstalaciones  ?? "—")} sub="operativas"  accent="#B98CFF" />
        <KPI label="Turnos Hoy"    value={loading ? "—" : (stats?.total           ?? "—")} sub="programados" accent={T.accent} />
        <KPI label="Cobertura"     value={loading ? "—" : `${s?.coberturaMensual  ?? 0}%`} sub="mensual"     accent={T.accent} />
      </div>

      {/* Breakdown presentes / tardíos / faltantes */}
      {!loading && stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <MiniStat value={stats.presentes} label="Presentes" color={T.accent} />
          <MiniStat value={stats.tardios}   label="Tardíos"   color={T.yellow} />
          <MiniStat value={stats.faltantes} label="Faltantes" color={T.red}    />
        </div>
      )}

      {/* Alerta novedades sin resolver */}
      {s?.novedadesAbiertas > 0 && (
        <div style={{
          background: T.redGhost, border: `1px solid ${T.red}`,
          borderRadius: 10, padding: "10px 14px", marginBottom: 14,
          fontSize: 13, color: T.red, display: "flex", alignItems: "center", gap: 8,
        }}>
          🚨 {s.novedadesAbiertas} novedad{s.novedadesAbiertas !== 1 ? "es" : ""} abierta{s.novedadesAbiertas !== 1 ? "s" : ""} sin resolver
        </div>
      )}

      {/* Mapa en vivo */}
      <SubHeader title="Instalaciones · Mapa en Vivo" />
      <MapaInstalaciones token={token} ultimaUbicacion={ultimaUbicacion} />

      <SubHeader title="Acciones Rápidas" />
      {ACCIONES.map((a, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 13, marginBottom: 5, display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        }}>
          <span style={{ fontSize: 15 }}>{a.icon}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</span>
        </div>
      ))}

      <div style={{ fontSize: 10, color: T.textMut, textAlign: "center", marginTop: 14 }}>
        {socketStatus === "connected"
          ? "🔴 Sincronización automática activa"
          : "⚪ Actualización manual requerida"}
      </div>
    </div>
  );
}
