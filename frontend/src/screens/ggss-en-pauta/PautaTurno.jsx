import { Icon } from "../../components/ui/Icon";
import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Badge } from "../../components/ui/Badge";
import { KPI } from "../../components/ui/KPI";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";
import { API_URL as API_BASE } from "../../config/api";
import { cacheRead, cacheWrite, CACHE_KEYS } from "../../utils/cache";

const TURNO_TTL  = 12 * 60 * 60 * 1000; // 12 h — cubre turno nocturno completo
const MARCAJE_TTL = 14 * 60 * 60 * 1000; // 14 h — persiste hasta el final del turno

// ─── HELPERS ─────────────────────────────────────────────────────

/** La vigencia la resuelve el servidor; el caché solo sirve como respaldo sin red. */
function leerTurnoCacheado() {
  const t = cacheRead(CACHE_KEYS.pautaTurnoHoy, TURNO_TTL);
  if (!t) return null;
  return t;
}

const GPS_ESPERA_MS = 12000;     // tiempo máximo para afinar la lectura
const GPS_PRECISION_OK_M = 25;   // con esta precisión se deja de esperar

/**
 * Sigue al GPS unos segundos y devuelve la lectura MÁS precisa (un PC o un celular
 * en interior suelen empezar con un error grande y mejorar). Devuelve null si el
 * equipo no entrega ubicación: el marcaje se registra igual, señalado como sin ubicación.
 * @param {(precisionM:number)=>void} [onLectura] se llama con cada lectura nueva
 */
function capturarGPS(onLectura) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    let mejor = null;
    let terminado = false;
    let watchId;
    let timer;
    const terminar = () => {
      if (terminado) return;
      terminado = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      resolve(mejor);
    };
    timer = setTimeout(terminar, GPS_ESPERA_MS);
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!mejor || pos.coords.accuracy < mejor.accuracy) mejor = pos.coords;
        onLectura?.(Math.round(pos.coords.accuracy));
        if (pos.coords.accuracy <= GPS_PRECISION_OK_M) terminar();
      },
      terminar,
      { enableHighAccuracy: true, timeout: GPS_ESPERA_MS, maximumAge: 0 },
    );
  });
}

/** Cómo se muestra al guardia el resultado de la verificación del GPS. */
const VERIFICACION_GPS = {
  verificado:    { texto: "Ubicación verificada", color: "accent" },
  tablet:        { texto: "Marcaje desde la tablet", color: "accent" },
  por_revisar:   { texto: "Ubicación imprecisa: un supervisor revisará tu marcaje", color: "yellow" },
  sin_ubicacion: { texto: "Sin ubicación: un supervisor revisará tu marcaje", color: "yellow" },
};

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
  const [cierresAuto,    setCierresAuto]    = useState([]); // entradas olvidadas cerradas por el sistema
  const [precisionGps,   setPrecisionGps]   = useState(null);
  const [lecturaVivo,    setLecturaVivo]    = useState(null); // precisión de la lectura mientras se marca

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
        if (!resEstado.ok) throw new Error(estado.error || "No se pudo consultar el turno");
        setCierresAuto(estado.cerradas_automaticamente ?? []);

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
            const turnoDesdeServidor = estado.turno;
            setTurno(turnoDesdeServidor);
            cacheWrite(CACHE_KEYS.pautaTurnoHoy, turnoDesdeServidor);
          }

          // Con estado activo no necesitamos más consultas
          return;
        }

        // El backend aplica intervalos chilenos y tolerancia; también devuelve
        // el próximo turno de hoy cuando aún no hay uno vigente.
        const turnoActivo = estado.turno ?? null;
        setTurno(turnoActivo);
        cacheWrite(CACHE_KEYS.pautaTurnoHoy, turnoActivo);
        // Conservar un marcaje cerrado solo si corresponde al turno mostrado.
        setMarcaje((anterior) => {
          const vigente = anterior?.turno_id === turnoActivo?.id && anterior?.hora_salida
            ? anterior : null;
          cacheWrite(CACHE_KEYS.pautaMarcajeHoy, vigente);
          return vigente;
        });

      } catch (e) {
        // Red no disponible — los datos cacheados ya fueron cargados en useState
        console.warn("[PautaTurno] Hidratación parcial (sin red):", e.message);
      } finally {
        setCargando(false);
      }
    };

    hidratar();
  }, [token, user.id]);

  // Adelanta una lectura para que el guardia vea su precisión antes de marcar.
  useEffect(() => {
    if (!turno || marcaje?.hora_salida || !navigator.geolocation) return;
    let activo = true;
    capturarGPS((p) => activo && setPrecisionGps(p));
    return () => { activo = false; };
  }, [turno, marcaje?.hora_salida]);

  // ── Marcar Entrada ─────────────────────────────────────────────
  const marcarEntrada = useCallback(async () => {
    setError("");
    setLoadingMarcaje(true);
    setLecturaVivo(null);
    try {
      const coords = await capturarGPS(setLecturaVivo);
      if (coords) setPrecisionGps(Math.round(coords.accuracy));
      const res = await fetch(`${API_BASE}/asistencia/entrada`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          instalacion_id: turno.instalacion_id,
          metodo:   "fallback_telefono",
          latitud:  coords?.latitude ?? null,
          longitud: coords?.longitude ?? null,
          precision_m: coords?.accuracy ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar entrada");

      const m = {
        asistencia_id:   data.id,
        turno_id:        data.turno_id,
        hora_entrada:    horaChile(data.hora_entrada),
        hora_salida:     null,
        estado:          data.estado,
        minutos_retraso: data.minutos_retraso ?? 0,
        verificacion:    data.verificacion_gps ?? null,
        mensaje_gps:     data.mensaje_gps ?? null,
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
      setLecturaVivo(null);
      const coords = await capturarGPS(setLecturaVivo);
      if (coords) setPrecisionGps(Math.round(coords.accuracy));
      const res = await fetch(`${API_BASE}/asistencia/salida`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          asistencia_id: marcaje.asistencia_id,
          metodo:   "fallback_telefono",
          latitud:  coords?.latitude ?? null,
          longitud: coords?.longitude ?? null,
          precision_m: coords?.accuracy ?? null,
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
  const radioInstalacion = Number(turno?.instalacion?.radio_geofence_m);
  const umbralPrecision = Number.isFinite(radioInstalacion) && radioInstalacion > 0
    ? radioInstalacion
    : 100;

  return (
    <div className="guard-screen">
      <SectionHeader title="Mi Turno Actual" sub="Información de tu turno en curso" />

      {cierresAuto.length > 0 && (
        <div style={{
          background: T.yellowGhost, border: `1px solid ${T.yellow}`, borderRadius: 8,
          padding: "10px 14px", marginBottom: 12, fontSize: 12, color: T.yellow,
        }}>
          {cierresAuto.map((c) => (
            <div key={c.asistencia_id}>
              <Icon name="triangle-alert" size={16} /> No marcaste salida del turno del {c.fecha.split("-").reverse().join("/")} ({c.hora_inicio}–{c.hora_fin}
              {c.instalacion ? ` en ${c.instalacion}` : ""}). Se cerró automáticamente a las {c.hora_fin} y
              quedó marcado para revisión de tu supervisor.
            </div>
          ))}
        </div>
      )}

      {/* Spinner solo en primera carga sin caché */}
      {cargando && (
        <div style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 13 }}>
          <Icon name="hourglass" size={16} /> Cargando turno...
        </div>
      )}

      {/* Sin turno asignado */}
      {!cargando && !turno && (
        <div style={{
          background: T.yellowGhost, border: `1px solid ${T.yellow}33`,
          borderRadius: 8, padding: 20, textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}><Icon name="calendar-days" size={32} /></div>
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
            border: `1px solid ${T.accent}33`, borderRadius: 8, padding: 20, marginBottom: 16,
          }}>
            <div className="guard-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: T.accentDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2 }}>
                  EN TURNO
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginTop: 4 }}>
                  {turno.instalacion?.nombre || "Instalación asignada"}
                </div>
                <div style={{ fontSize: 13, color: T.textSec, marginTop: 4 }}>
                  {turno.hora_inicio} — {turno.hora_fin}
                  {turno.hora_fin < turno.hora_inicio && (
                    <span style={{ color: T.focusText, fontSize: 11, marginLeft: 6 }}><Icon name="moon" size={16} /> nocturno</span>
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
          <div className="guard-kpi-grid" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
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
              background: "#0E1714", border: `1px solid ${T.yellow}44`,
              borderRadius: 8, padding: 14, marginBottom: 12,
              fontSize: 13, color: T.yellow, fontWeight: 600,
            }}>
              <Badge color="yellow"><span aria-hidden="true" style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: T.yellow, verticalAlign: "middle" }} /></Badge> Entrada registrada a las {marcaje.hora_entrada} — recuerda marcar la salida al terminar
            </div>
          )}
          {yaEntro && VERIFICACION_GPS[marcaje.verificacion] && (
            <div style={{
              background: VERIFICACION_GPS[marcaje.verificacion].color === "accent" ? T.accentGhost : T.yellowGhost,
              border: `1px solid ${VERIFICACION_GPS[marcaje.verificacion].color === "accent" ? T.accent : T.yellow}44`,
              borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12,
              color: VERIFICACION_GPS[marcaje.verificacion].color === "accent" ? T.accent : T.yellow,
            }}>
              <strong>{VERIFICACION_GPS[marcaje.verificacion].texto}.</strong>
              {marcaje.mensaje_gps ? ` ${marcaje.mensaje_gps}` : ""}
            </div>
          )}
          {yaSalio && (
            <div style={{
              background: T.accentGhost, border: `1px solid ${T.accent}33`,
              borderRadius: 8, padding: 14, marginBottom: 12,
              fontSize: 13, color: T.accent, fontWeight: 600,
            }}>
              <Icon name="circle-check" size={16} /> Turno completado · Entrada {marcaje.hora_entrada} → Salida {marcaje.hora_salida}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: T.redGhost, border: `1px solid ${T.red}33`,
              borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 12, color: T.red,
            }}>
              <Icon name="triangle-alert" size={16} /> {error}
            </div>
          )}

          {/* Zona de acción */}
          {!yaSalio && (
            <div style={{
              background: T.bgCard, border: `1px dashed ${T.border}`,
              borderRadius: 8, padding: 16, textAlign: "center",
            }}>
              <div style={{ fontSize: 12, color: T.textMut, marginBottom: 10 }}>
                {!yaEntro
                  ? "Captura tu GPS y registra la entrada"
                  : "Turno en curso — registra tu salida al finalizar"}
              </div>

              {precisionGps !== null && (
                <div style={{ fontSize: 12, color: T.textSec, marginBottom: 10 }}>
                  Precisión de tu ubicación: ±{precisionGps} m
                </div>
              )}
              {precisionGps > umbralPrecision && (
                <div style={{
                  background: T.yellowGhost, border: `1px solid ${T.yellow}44`,
                  borderRadius: 8, padding: 10, marginBottom: 10,
                  fontSize: 12, color: T.yellow,
                }}>
                  <Icon name="triangle-alert" size={16} /> Tu ubicación en este equipo es imprecisa (un computador no tiene GPS).
                  Puedes marcar igual, pero un supervisor revisará tu marcaje. Para que quede
                  verificado, márcalo desde un celular en la instalación.
                </div>
              )}
              {loadingMarcaje && (
                <div style={{ fontSize: 12, color: T.textSec, marginBottom: 10 }}>
                  {lecturaVivo === null
                    ? "Obteniendo tu ubicación…"
                    : `Afinando ubicación… ±${lecturaVivo} m`}
                </div>
              )}

              {!yaEntro ? (
                <Btn onClick={marcarEntrada} loading={loadingMarcaje} full icon="map-pin">
                   Marcar Entrada
                </Btn>
              ) : (
                /* Botón naranja para salida — usa button nativo porque Btn no admite color custom */
                <button
                  className="touch-target"
                  onClick={marcarSalida}
                  disabled={loadingMarcaje}
                  style={{
                    width: "100%", padding: "14px 32px",
                    background: loadingMarcaje ? T.textMut : "#E86A2A",
                    color: T.white, border: "none", borderRadius: 8,
                    fontSize: 14, fontWeight: 700, cursor: loadingMarcaje ? "not-allowed" : "pointer",
                    fontFamily: "var(--font-ui)", letterSpacing: 0.5, transition: "all 0.2s",
                    opacity: loadingMarcaje ? 0.7 : 1,
                    boxShadow: loadingMarcaje ? "none" : "0 4px 20px #E05A0044",
                  }}
                >
                  {loadingMarcaje ? <><Icon name="hourglass" size={16} />{" Procesando..."}</> : <><Icon name="map-pin" size={16} />{" Marcar Salida"}</>}
                </button>
              )}
            </div>
          )}

          {/* Turno finalizado */}
          {yaSalio && (
            <div style={{
              background: T.bgCard, border: `1px solid ${T.accent}22`,
              borderRadius: 8, padding: 16, textAlign: "center",
            }}>
              <div style={{ fontSize: 13, color: T.textMut }}>Turno finalizado — ¡Buen trabajo!</div>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
