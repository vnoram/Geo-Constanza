import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { Btn } from "../../components/ui/Btn";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";
import { API_URL as API_BASE, SOCKET_URL } from "../../config/api";

const TOKEN_KEY    = "gc_token";
const UMBRAL_PRECISION_NOVEDAD_M = 100;

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
  return new Date(dateStr).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
}

// ─── Modal: Reportar Novedad ─────────────────────────────────────────
function ReportarModal({ onClose, onSuccess }) {
  const [tipo, setTipo]           = useState("");
  const [descripcion, setDesc]    = useState("");
  const [loading, setLoading]     = useState(false);
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | loading | ok | error
  const [precisionGps, setPrecisionGps] = useState(null);
  const [error, setError]         = useState(null);
  const [foto, setFoto]           = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const coordsRef                 = useRef(null);

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) { setFoto(null); setFotoPreview(null); return; }
    if (!file.type.startsWith("image/")) {
      setError("El archivo seleccionado no es una imagen.");
      e.target.value = "";
      return;
    }
    setError(null);
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  // Obtener GPS al abrir el modal
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setPrecisionGps(Math.round(pos.coords.accuracy));
        setGpsStatus("ok");
      },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!tipo) { setError("Selecciona el tipo de novedad."); return; }
    if (!descripcion.trim()) { setError("Ingresa una descripción."); return; }

    setLoading(true);
    try {
      if (foto) {
        // Con foto: multipart/form-data directo al mismo endpoint (ya soporta campo "foto")
        const form = new FormData();
        form.append("tipo", tipo);
        form.append("descripcion", descripcion.trim());
        if (coordsRef.current?.lat != null) form.append("latitud", coordsRef.current.lat);
        if (coordsRef.current?.lng != null) form.append("longitud", coordsRef.current.lng);
        if (coordsRef.current?.accuracy != null) form.append("precision_m", coordsRef.current.accuracy);
        form.append("foto", foto);

        const token = localStorage.getItem(TOKEN_KEY);
        const res = await fetch(`${API_BASE}/novedades`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      } else {
        await api.post("/novedades", {
          tipo,
          descripcion: descripcion.trim(),
          latitud:  coordsRef.current?.lat  ?? null,
          longitud: coordsRef.current?.lng  ?? null,
          precision_m: coordsRef.current?.accuracy ?? null,
        });
      }
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
    <div className="guard-modal-overlay" style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(14,23,20,0.85)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div className="responsive-modal guard-report-modal" style={{
        background: T.bgCard, border: `1px solid ${T.border}`,
        borderRadius: 8, padding: 24, width: "100%", maxWidth: 420,
      }}>
        <div className="guard-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: T.text }}>Reportar Novedad</span>
          <button className="touch-target" aria-label="Cerrar" onClick={onClose} style={{
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
            {gpsStatus === "ok"      && `📍 Precisión de tu ubicación: ±${precisionGps} m`}
            {gpsStatus === "error"   && "⚠️ GPS no disponible — se reportará sin coordenadas"}
            {gpsStatus === "idle"    && "📡 Iniciando GPS..."}
          </span>
        </div>

        {gpsStatus === "ok" && precisionGps > UMBRAL_PRECISION_NOVEDAD_M && (
          <div style={{
            background: T.yellowGhost, border: `1px solid ${T.yellow}44`,
            borderRadius: 8, padding: "8px 12px", marginBottom: 16,
            fontSize: 12, color: T.yellow,
          }}>
            ⚠️ Tu ubicación en este equipo es imprecisa. Usa tu celular o tablet en la instalación.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Tipo */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: T.textSec, marginBottom: 6 }}>
              Tipo de Novedad *
            </label>
            <select
              className="touch-target"
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px",
                background: T.bgInput, border: `1px solid ${T.border}`,
                borderRadius: 8, color: tipo ? T.text : T.textMut,
                fontSize: 14, outline: "none", fontFamily: "var(--font-ui)",
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
              className="touch-target"
              value={descripcion}
              onChange={e => setDesc(e.target.value)}
              placeholder="Describe brevemente lo ocurrido..."
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", resize: "vertical",
                background: T.bgInput, border: `1px solid ${T.border}`,
                borderRadius: 8, color: T.text, fontSize: 14,
                outline: "none", fontFamily: "var(--font-ui)",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Foto (opcional) */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: T.textSec, marginBottom: 6 }}>
              Foto (opcional)
            </label>
            <input
              className="touch-target"
              type="file"
              accept="image/*"
              onChange={handleFoto}
              style={{
                width: "100%", padding: "8px 12px",
                background: T.bgInput, border: `1px solid ${T.border}`,
                borderRadius: 8, color: T.text, fontSize: 13,
                fontFamily: "var(--font-ui)", boxSizing: "border-box",
              }}
            />
            {fotoPreview && (
              <img
                src={fotoPreview}
                alt="Vista previa"
                style={{
                  marginTop: 8, maxWidth: "100%", maxHeight: 160,
                  borderRadius: 8, border: `1px solid ${T.border}`, display: "block",
                }}
              />
            )}
          </div>

          {error && (
            <div style={{
              marginBottom: 12, padding: "8px 12px", borderRadius: 8,
              background: T.redGhost, color: T.red, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <div className="guard-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
    <div className="guard-screen">
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
          background: T.bgCard, borderRadius: 8, border: `1px solid ${T.border}`,
        }}>
          No hay novedades registradas en este turno.
        </div>
      )}

      {novedades.map(n => {
        const urgencia = n.urgencia ?? "verde";
        const colors   = URGENCIA_COLOR[urgencia] ?? URGENCIA_COLOR.verde;
        return (
          <div className="guard-card" key={n.id} style={{
            background: T.bgCard, border: `1px solid ${T.border}`,
            borderLeft: `4px solid ${colors.border}`,
            borderRadius: 8, padding: 14, marginBottom: 8,
          }}>
            <div className="guard-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
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
