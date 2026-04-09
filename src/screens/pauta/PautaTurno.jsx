import { useState, useEffect } from "react";
import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Badge } from "../../components/ui/Badge";
import { KPI } from "../../components/ui/KPI";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3005/api/v1";

export function PautaTurno({ user }) {
  const { token } = useAuth();
  const [turno, setTurno] = useState(null);
  const [loadingTurno, setLoadingTurno] = useState(true);
  const [loadingMarcaje, setLoadingMarcaje] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  // Cargar turno de hoy al montar
  useEffect(() => {
    const fetchTurno = async () => {
      try {
        const hoy = new Date().toISOString().split("T")[0];
        const res = await fetch(`${API_BASE}/turnos?fecha=${hoy}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        // listar devuelve array o { data: [] }
        const lista = Array.isArray(data) ? data : data.data || [];
        const turnoHoy = lista.find(t => t.estado !== "cancelado");
        setTurno(turnoHoy || null);
      } catch {
        setError("No se pudo cargar el turno de hoy");
      }
      setLoadingTurno(false);
    };
    fetchTurno();
  }, [token, user.id]);

  const marcarEntrada = async () => {
    setError("");
    setLoadingMarcaje(true);
    try {
      // 1. Capturar GPS
      const coords = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos.coords),
          err => reject(new Error("GPS no disponible: " + err.message)),
          { enableHighAccuracy: true, timeout: 10000 }
        )
      );

      // 2. POST entrada
      const res = await fetch(`${API_BASE}/asistencia/entrada`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          instalacion_id: turno.instalacion_id,
          metodo: "fallback_telefono",
          latitud: coords.latitude,
          longitud: coords.longitude,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar entrada");

      setResultado({
        hora: new Date(data.hora_entrada).toLocaleTimeString("es-CL"),
        estado: data.estado,
        minutos_retraso: data.minutos_retraso,
      });
    } catch (err) {
      setError(err.message);
    }
    setLoadingMarcaje(false);
  };

  return (
    <div>
      <SectionHeader title="Mi Turno Actual" sub="Información de tu turno en curso" />

      {/* Estado de carga del turno */}
      {loadingTurno && (
        <div style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 13 }}>
          ⏳ Cargando turno...
        </div>
      )}

      {/* Sin turno hoy */}
      {!loadingTurno && !turno && (
        <div style={{
          background: T.yellowGhost, border: `1px solid ${T.yellow}33`,
          borderRadius: 14, padding: 20, textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
          <div style={{ fontWeight: 700, color: T.yellow }}>Sin turno asignado hoy</div>
          <div style={{ fontSize: 12, color: T.textMut, marginTop: 4 }}>
            Contacta a tu supervisor si crees que es un error
          </div>
        </div>
      )}

      {/* Turno encontrado */}
      {turno && (
        <>
          <div style={{
            background: `linear-gradient(135deg, ${T.accentGhost}, transparent)`,
            border: `1px solid ${T.accent}33`, borderRadius: 16, padding: 20, marginBottom: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 11, color: T.accentDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2 }}>EN TURNO</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginTop: 4 }}>
                  {turno.instalacion?.nombre || "Instalación asignada"}
                </div>
                <div style={{ fontSize: 13, color: T.textSec, marginTop: 4 }}>
                  {turno.hora_inicio} — {turno.hora_fin} · Turno {turno.tipo_turno}
                </div>
              </div>
              <div style={{
                width: 10, height: 10, borderRadius: "50%", background: T.accent,
                boxShadow: `0 0 12px ${T.accent}`, marginTop: 4,
                animation: "pulse 2s infinite",
              }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Badge>{turno.estado}</Badge>
              <Badge color="accent">GPS Activo</Badge>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <KPI label="Entrada" value={resultado?.hora || "—"} sub={resultado ? "Registrada" : "Pendiente"} />
            <KPI
              label="Estado"
              value={resultado ? (resultado.estado === "tardio" ? "Tardío" : "Normal") : "—"}
              accent={resultado?.estado === "tardio" ? T.yellow : T.accent}
              sub={resultado?.minutos_retraso > 0 ? `${resultado.minutos_retraso} min retraso` : ""}
            />
          </div>

          {/* Resultado exitoso */}
          {resultado && (
            <div style={{
              background: T.accentGhost, border: `1px solid ${T.accent}33`,
              borderRadius: 12, padding: 14, marginBottom: 12,
              fontSize: 13, color: T.accent, fontWeight: 600,
            }}>
              ✅ Entrada registrada a las {resultado.hora}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: T.redGhost, border: `1px solid ${T.red}33`,
              borderRadius: 12, padding: 14, marginBottom: 12,
              fontSize: 12, color: T.red,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Botón marcaje */}
          <div style={{
            background: T.bgCard, border: `1px dashed ${T.border}`,
            borderRadius: 14, padding: 16, textAlign: "center",
          }}>
            <div style={{ fontSize: 12, color: T.textMut, marginBottom: 10 }}>
              {resultado ? "Marcaje completado para este turno" : "Captura tu GPS y registra la entrada"}
            </div>
            <Btn onClick={marcarEntrada} loading={loadingMarcaje} disabled={!!resultado} full>
              📍 {resultado ? "Entrada Registrada" : "Marcar Entrada"}
            </Btn>
          </div>
        </>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
