import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Badge } from "../../components/ui/Badge";
import { KPI } from "../../components/ui/KPI";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";
import { cacheRead, cacheWrite, CACHE_KEYS } from "../../utils/cache";

const API_BASE   = import.meta.env.VITE_API_URL || "http://localhost:3005/api/v1";
const TURNO_TTL  = 12 * 60 * 60 * 1000; // 12 h — cubre turno nocturno completo
const MARCAJE_TTL = 14 * 60 * 60 * 1000; // 14 h — persiste hasta el final del turno

// ─── HELPERS ─────────────────────────────────────────────────────

/** Lee el turno cacheado validando que sea de las últimas 24 h. */
function leerTurnoCacheado() {
  const t = cacheRead(CACHE_KEYS.pautaTurnoHoy, TURNO_TTL);
  if (!t) return null;
  if (Date.now() - new Date(t.fecha).getTime() > 24 * 60 * 60 * 1000) return null;
  return t;
}

/** Captura la posición GPS del dispositivo. */
function capturarGPS() {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(new Error("GPS no disponible: " + err.message)),
      { enableHighAccuracy: true, timeout: 10000 },
    ),
  );
}

/** Formatea un Date/string ISO a "HH:MM" en hora Chile. */
function horaChile(dt) {
  return new Date(dt).toLocaleTimeString("es-CL", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago",
  });
}

// ─── COMPONENTE ───────────────────────────────────────────────────

export function PautaTurno({ user }) {
  const { token } = useAuth();

  // Estado del turno asignado
  const [turno,          setTurno]          = useState(leerTurnoCacheado);
  // Estado del marcaje { asistencia_id, turno_id, hora_entrada, hora_salida, estado, minutos_retraso }
  const [marcaje,        setMarcaje]        = useState(() => cacheRead(CACHE_KEYS.pautaMarcajeHoy, MARCAJE_TTL));
  // Spinner solo en primera carga sin caché
  const [cargando,       setCargando]       = useState(() => leerTurnoCacheado() === null);
  const [loadingMarcaje, setLoadingMarcaje] = useState(false);
  const [error,          setError]          = useState("");

  // ── Hidratación — servidor es la fuente de verdad ─────────────
  useEffect(() => {
    const hidratar = async () => {
      try {
        // ── PASO 1: consultar estado activo en el servidor ──────
        // Este endpoint es la fuente de verdad: devuelve si existe una
        // asistencia abierta, independientemente del caché local.
        const resEstado = await fetch(`${API_BASE}/asistencia/estado-actual`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const estado = await resEstado.json();

        if (estado.activo) {
          // El guardia YA marcó entrada — reconstruir estado desde servidor
          const m = {
            asistencia_id:   estado.asistencia_id,
            turno_id:        estado.turno_id,
            hora_entrada:    horaChile(estado.hora_entrada),
            hora_salida:     null,          // activo → sin salida
            estado:          estado.estado,
            minutos_retraso: estado.minutos_retraso ?? 0,
          };
          setMarcaje(m);
          cacheWrite(CACHE_KEYS.pautaMarcajeHoy, m);

          // El turno viene embebido en la respuesta del servidor
          if (estado.turno) {
            const turnoDesdeServidor = {
              id:             estado.turno.id,
              hora_inicio:    estado.turno.hora_inicio,
              hora_fin:       estado.turno.hora_fin,
              tipo_turno:     estado.turno.tipo_turno,
              fecha:          estado.turno.fecha,
              instalacion_id: estado.turno.instalacion_id,
              instalacion:    estado.instalacion ?? null,
            };
            setTurno(turnoDesdeServidor);
            cacheWrite(CACHE_KEYS.pautaTurnoHoy, turnoDesdeServidor);
          }

          // Con estado activo no necesitamos más consultas
          return;
        }

        // Si había una asistencia vencida, el servidor ya la cerró.
        // Limpiar el caché local de marcaje para no mostrar datos obsoletos.
        if (estado.vencido) {
          setMarcaje(null);
          cacheWrite(CACHE_KEYS.pautaMarcajeHoy, null);
        }

        // ── PASO 2: sin entrada activa → buscar turno del día ───
        // (para mostrar el botón "Marcar Entrada")
        const resTurnos = await fetch(`${API_BASE}/turnos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dataTurnos = await resTurnos.json();
        const lista = Array.isArray(dataTurnos) ? dataTurnos : (dataTurnos.data ?? []);
        const ahora = Date.now();
        const turnoActivo = lista
          .filter((t) => t.estado !== "cancelado" && ahora - new Date(t.fecha).getTime() <= 24 * 60 * 60 * 1000)
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] ?? null;

        setTurno(turnoActivo);
        if (turnoActivo) cacheWrite(CACHE_KEYS.pautaTurnoHoy, turnoActivo);
        else setMarcaje(null); // sin turno → limpiar marcaje cacheado obsoleto

      } catch (e) {
        // Red no disponible — los datos cacheados ya fueron cargados en useState
        console.warn("[PautaTurno] Hidratación parcial (sin red):", e.message);
      } finally {
        setCargando(false);
      }
    };

    hidratar();
  }, [token, user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Marcar Entrada ─────────────────────────────────────────────
  const marcarEntrada = useCallback(async () => {
    setError("");
    setLoadingMarcaje(true);
    try {
      const coords = await capturarGPS();
      const res = await fetch(`${API_BASE}/asistencia/entrada`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          instalacion_id: turno.instalacion_id,
          metodo:   "fallback_telefono",
          latitud:  coords.latitude,
          longitud: coords.longitude,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar entrada");

      const m = {
        asistencia_id:   data.id,
        turno_id:        turno.id,
        hora_entrada:    horaChile(data.hora_entrada),
        hora_salida:     null,
        estado:          data.estado,
        minutos_retraso: data.minutos_retraso ?? 0,
      };
      setMarcaje(m);
      cacheWrite(CACHE_KEYS.pautaMarcajeHoy, m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMarcaje(false);
    }
  }, [token, turno]);

  // ── Marcar Salida ──────────────────────────────────────────────
  const marcarSalida = useCallback(async () => {
    setError("");
    setLoadingMarcaje(true);
    try {
      const coords = await capturarGPS();
      const res = await fetch(`${API_BASE}/asistencia/salida`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          asistencia_id: marcaje.asistencia_id,
          metodo:   "fallback_telefono",
          latitud:  coords.latitude,
          longitud: coords.longitude,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar salida");

      const m = { ...marcaje, hora_salida: horaChile(data.hora_salida) };
      setMarcaje(m);
      cacheWrite(CACHE_KEYS.pautaMarcajeHoy, m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMarcaje(false);
    }
  }, [token, marcaje]);

  // ── Derivados de estado ────────────────────────────────────────
  const yaEntro = !!marcaje?.hora_entrada;
  const yaSalio = !!marcaje?.hora_salida;
  const pulseColor = yaSalio ? T.accent : yaEntro ? T.yellow : T.accent;

  return (
    <div>
      <SectionHeader title="Mi Turno Actual" sub="Información de tu turno en curso" />

      {/* Spinner solo en primera carga sin caché */}
      {cargando && (
        <div style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 13 }}>
          ⏳ Cargando turno...
        </div>
      )}

      {/* Sin turno asignado */}
      {!cargando && !turno && (
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
          {/* Card de turno */}
          <div style={{
            background: `linear-gradient(135deg, ${T.accentGhost}, transparent)`,
            border: `1px solid ${T.accent}33`, borderRadius: 16, padding: 20, marginBottom: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 11, color: T.accentDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2 }}>
                  EN TURNO
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginTop: 4 }}>
                  {turno.instalacion?.nombre || "Instalación asignada"}
                </div>
                <div style={{ fontSize: 13, color: T.textSec, marginTop: 4 }}>
                  {turno.hora_inicio} — {turno.hora_fin}
                  {turno.hora_fin < turno.hora_inicio && (
                    <span style={{ color: "#c4a8ff", fontSize: 11, marginLeft: 6 }}>🌙 nocturno</span>
                  )}
                </div>
              </div>
              {/* Indicador de estado pulsante */}
              {!yaSalio && (
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: pulseColor, boxShadow: `0 0 12px ${pulseColor}`,
                  marginTop: 4, animation: "pulse 2s infinite",
                }} />
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <Badge>{turno.estado}</Badge>
              {!yaEntro && <Badge color="accent">GPS Listo</Badge>}
              {yaEntro && !yaSalio && <Badge color="yellow">En Turno</Badge>}
              {yaSalio && <Badge color="accent">Turno Completado</Badge>}
            </div>
          </div>

          {/* KPIs entrada / salida */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <KPI
              label="Entrada"
              value={marcaje?.hora_entrada || "—"}
              sub={yaEntro ? "Registrada" : "Pendiente"}
            />
            <KPI
              label={yaSalio ? "Salida" : "Estado"}
              value={
                yaSalio
                  ? marcaje.hora_salida
                  : yaEntro
                    ? (marcaje.estado === "tardio" ? "Tardío" : "Normal")
                    : "—"
              }
              accent={
                yaSalio ? T.accent : marcaje?.estado === "tardio" ? T.yellow : T.accent
              }
              sub={
                yaSalio
                  ? "Registrada"
                  : (marcaje?.minutos_retraso > 0 ? `${marcaje.minutos_retraso} min retraso` : "")
              }
            />
          </div>

          {/* Banners de estado */}
          {yaEntro && !yaSalio && (
            <div style={{
              background: "#1a1200", border: `1px solid ${T.yellow}44`,
              borderRadius: 12, padding: 14, marginBottom: 12,
              fontSize: 13, color: T.yellow, fontWeight: 600,
            }}>
              🟡 Entrada registrada a las {marcaje.hora_entrada} — recuerda marcar la salida al terminar
            </div>
          )}
          {yaSalio && (
            <div style={{
              background: T.accentGhost, border: `1px solid ${T.accent}33`,
              borderRadius: 12, padding: 14, marginBottom: 12,
              fontSize: 13, color: T.accent, fontWeight: 600,
            }}>
              ✅ Turno completado · Entrada {marcaje.hora_entrada} → Salida {marcaje.hora_salida}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: T.redGhost, border: `1px solid ${T.red}33`,
              borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 12, color: T.red,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Zona de acción */}
          {!yaSalio && (
            <div style={{
              background: T.bgCard, border: `1px dashed ${T.border}`,
              borderRadius: 14, padding: 16, textAlign: "center",
            }}>
              <div style={{ fontSize: 12, color: T.textMut, marginBottom: 10 }}>
                {!yaEntro
                  ? "Captura tu GPS y registra la entrada"
                  : "Turno en curso — registra tu salida al finalizar"}
              </div>

              {!yaEntro ? (
                <Btn onClick={marcarEntrada} loading={loadingMarcaje} full>
                  📍 Marcar Entrada
                </Btn>
              ) : (
                /* Botón naranja para salida — usa button nativo porque Btn no admite color custom */
                <button
                  onClick={marcarSalida}
                  disabled={loadingMarcaje}
                  style={{
                    width: "100%", padding: "14px 32px",
                    background: loadingMarcaje ? T.textMut : "#E05A00",
                    color: "#fff", border: "none", borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: loadingMarcaje ? "not-allowed" : "pointer",
                    fontFamily: "'Outfit', sans-serif", letterSpacing: 0.5, transition: "all 0.2s",
                    opacity: loadingMarcaje ? 0.7 : 1,
                    boxShadow: loadingMarcaje ? "none" : "0 4px 20px #E05A0044",
                  }}
                >
                  {loadingMarcaje ? "⏳ Procesando..." : "📍 Marcar Salida"}
                </button>
              )}
            </div>
          )}

          {/* Turno finalizado */}
          {yaSalio && (
            <div style={{
              background: T.bgCard, border: `1px solid ${T.accent}22`,
              borderRadius: 14, padding: 16, textAlign: "center",
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>👋</div>
              <div style={{ fontSize: 13, color: T.textMut }}>Turno finalizado — ¡Buen trabajo!</div>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
