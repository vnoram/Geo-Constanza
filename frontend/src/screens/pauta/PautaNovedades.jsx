import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { Btn } from "../../components/ui/Btn";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3005";

const TIPOS_NOVEDAD = [
  "Robo",
  "Robo en progreso",
  "Intrusión",
  "Incendio",
  "Agresión",
  "Emergencia médica",
  "Falla técnica",
  "Puerta abierta",
  "Acceso no autorizado",
  "Vandalismo",
  "Alarma activada",
  "Mantenimiento",
  "Ronda",
  "Sin novedad",
  "Cambio de turno",
];

const URGENCIA_COLOR = {
  rojo:     { border: T.red,    badge: "red" },
  amarillo: { border: T.yellow, badge: "yellow" },
  verde:    { border: T.accent, badge: "accent" },
};

function formatHora(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

// ─── Modal: Reportar Novedad ─────────────────────────────────────────
function ReportarModal({ onClose, onSuccess }) {
  const [tipo, setTipo]           = useState("");
  const [descripcion, setDesc]    = useState("");
  const [loading, setLoading]     = useState(false);
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | loading | ok | error
  const [error, setError]         = useState(null);
  const coordsRef                 = useRef(null);

  // Obtener GPS al abrir el modal
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsStatus("ok");
      },
      () => setGpsStatus("error"),
      { timeout: 8000, maximumAge: 30000 },
    );
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!tipo) { setError("Selecciona el tipo de novedad."); return; }
    if (!descripcion.trim()) { setError("Ingresa una descripción."); return; }

    setLoading(true);
    try {
      await api.post("/novedades", {
        tipo,
        descripcion: descripcion.trim(),
        latitud:  coordsRef.current?.lat  ?? null,
        longitud: coordsRef.current?.lng  ?? null,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || "Error al reportar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const gpsColors = {
    ok:      { bg: T.accentGhost,  border: T.accent + "44", text: T.accent },
    error:   { bg: T.redGhost,     border: T.red    + "44", text: T.red    },
    loading: { bg: T.yellowGhost,  border: T.yellow + "44", text: T.yellow },
    idle:    { bg: T.yellowGhost,  border: T.yellow + "44", text: T.yellow },
  };
  const gpsStyle = gpsColors[gpsStatus];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(6,13,24,0.85)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: 24, width: "100%", maxWidth: 420,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: T.text }}>Reportar Novedad</span>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: T.textMut,
            fontSize: 20, cursor: "pointer", lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Indicador GPS */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
          padding: "8px 12px", borderRadius: 8,
          background: gpsStyle.bg, border: `1px solid ${gpsStyle.border}`,
        }}>
          <span style={{ fontSize: 13, color: gpsStyle.text }}>
            {gpsStatus === "loading" && "📡 Obteniendo ubicación..."}
            {gpsStatus === "ok"      && "📍 Ubicación capturada correctamente"}
            {gpsStatus === "error"   && "⚠️ GPS no disponible — se reportará sin coordenadas"}
            {gpsStatus === "idle"    && "📡 Iniciando GPS..."}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Tipo */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: T.textSec, marginBottom: 6 }}>
              Tipo de Novedad *
            </label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px",
                background: T.bgInput, border: `1px solid ${T.border}`,
                borderRadius: 8, color: tipo ? T.text : T.textMut,
                fontSize: 14, outline: "none", fontFamily: "'Outfit', sans-serif",
                appearance: "none", boxSizing: "border-box",
              }}
            >
              <option value="" disabled>Selecciona un tipo...</option>
              {TIPOS_NOVEDAD.map(t => (
                <option key={t} value={t} style={{ background: T.bgCard }}>{t}</option>
              ))}
            </select>
          </div>

          {/* Descripción */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: T.textSec, marginBottom: 6 }}>
              Descripción *
            </label>
            <textarea
              value={descripcion}
              onChange={e => setDesc(e.target.value)}
              placeholder="Describe brevemente lo ocurrido..."
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", resize: "vertical",
                background: T.bgInput, border: `1px solid ${T.border}`,
                borderRadius: 8, color: T.text, fontSize: 14,
                outline: "none", fontFamily: "'Outfit', sans-serif",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 12, padding: "8px 12px", borderRadius: 8,
              background: T.redGhost, color: T.red, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Btn>
            <Btn loading={loading}>Enviar Reporte</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Pantalla principal ──────────────────────────────────────────────
export function PautaNovedades({ user }) {
  const [novedades, setNovedades] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const socketRef                 = useRef(null);

  const cargarNovedades = async () => {
    try {
      const res = await api.get("/novedades");
      setNovedades(res.data ?? []);
    } catch {
      // Mantener lista actual si hay error de red
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarNovedades();

    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    if (user?.instalacion_asignada_id) {
      socket.emit("join:instalacion", user.instalacion_asignada_id);
    }

    // Refrescar lista al recibir nueva novedad en la instalación
    socket.on("novedad:nueva", () => cargarNovedades());

    return () => socket.disconnect();
  }, [user?.instalacion_asignada_id]);

  const handleSuccess = () => {
    setShowModal(false);
    cargarNovedades();
  };

  return (
    <div>
      <SectionHeader
        title="Novedades"
        sub="Reporta incidencias durante tu turno"
        action={{ label: "+ Reportar", onClick: () => setShowModal(true) }}
      />

      {loading && (
        <div style={{ textAlign: "center", color: T.textMut, padding: 32, fontSize: 14 }}>
          Cargando novedades...
        </div>
      )}

      {!loading && novedades.length === 0 && (
        <div style={{
          textAlign: "center", color: T.textMut, padding: 32, fontSize: 14,
          background: T.bgCard, borderRadius: 12, border: `1px solid ${T.border}`,
        }}>
          No hay novedades registradas en este turno.
        </div>
      )}

      {novedades.map(n => {
        const urgencia = n.urgencia ?? "verde";
        const colors   = URGENCIA_COLOR[urgencia] ?? URGENCIA_COLOR.verde;
        return (
          <div key={n.id} style={{
            background: T.bgCard, border: `1px solid ${T.border}`,
            borderLeft: `4px solid ${colors.border}`,
            borderRadius: 12, padding: 14, marginBottom: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{n.tipo}</span>
              <Badge color={colors.badge}>{urgencia}</Badge>
            </div>
            <div style={{ fontSize: 12, color: T.textMut, marginBottom: 6 }}>
              {formatHora(n.created_at)} · {n.descripcion}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <Badge color={n.estado === "abierta" ? "yellow" : n.estado === "escalada" ? "red" : "accent"}>
                {n.estado}
              </Badge>
              {n.gps_dentro_rango === false && (
                <Badge color="yellow">GPS fuera de rango</Badge>
              )}
            </div>
          </div>
        );
      })}

      {showModal && (
        <ReportarModal
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
