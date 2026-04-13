import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { T } from "../../theme/theme";
import { KPI } from "../../components/ui/KPI";
import { SubHeader } from "../../components/ui/SubHeader";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";

const API_BASE   = import.meta.env.VITE_API_URL || "http://localhost:3005/api/v1";
const SOCKET_URL = API_BASE.replace("/api/v1", "");

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
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [socketStatus, setSocketStatus] = useState("disconnected");
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

    // Actualización en tiempo real: asistencia, novedad o turno
    socket.on("admin:dashboard_update", (payload) => {
      console.log("[AdminPanel] Actualización recibida →", payload);
      fetchStats();
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
        <KPI label="Guardias"     value={loading ? "—" : (s?.totalGuardias    ?? "—")} sub="activos"     accent="#B98CFF" />
        <KPI label="Instalaciones" value={loading ? "—" : (s?.totalInstalaciones ?? "—")} sub="operativas" accent="#B98CFF" />
        <KPI label="Turnos Hoy"   value={loading ? "—" : (stats?.total          ?? "—")} sub="programados" accent={T.accent} />
        <KPI label="Cobertura"    value={loading ? "—" : `${s?.coberturaMensual ?? 0}%`} sub="mensual"     accent={T.accent} />
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
