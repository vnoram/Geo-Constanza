import { Icon } from "../../components/ui/Icon";
import { leerSesion } from "../../services/almacenSesion";
import { Badge } from "../../components/ui/Badge";
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { leerDeviceToken } from "../../services/dispositivos";
import { FONT, T } from "../../theme/theme";
import "./SupDashboard.css";
import { KPI } from "../../components/ui/KPI";
import { Dialogo } from "../../components/ui/Dialogo";
import { Btn } from "../../components/ui/Btn";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";
import { API_URL as API_BASE, SOCKET_URL } from "../../config/api";
import { TurnosPorReasignar } from "./TurnosPorReasignar";
import { IndicadoresCompactos } from "./IndicadoresCompactos";
import { cacheRead, cacheWrite, CACHE_KEYS } from "../../utils/cache";


const ESTADO_COLOR    = { presente: T.accent, tardio: T.yellow, faltante: T.red, por_iniciar: T.textMut, ausencia: T.focusText };
const ESTADO_LABEL    = { presente: "Presente", tardio: "Tardío", faltante: "Faltante", por_iniciar: "Por iniciar", ausencia: "Ausencia" };
const CRITICIDAD_COLOR = { Alta: T.red, Media: T.yellow, Baja: T.accent };

export function SupDashboard() {
  const { token } = useAuth();

  const [data,    setData]    = useState(() => cacheRead(CACHE_KEYS.supDashboard));
  const [loading, setLoading] = useState(() => cacheRead(CACHE_KEYS.supDashboard) === null);
  const socketRef = useRef(null);

  const fetchData = async () => {
    try {
      const res  = await fetch(`${API_BASE}/dashboard/hoy`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok) { setData(json); cacheWrite(CACHE_KEYS.supDashboard, json); }
    } catch { /* silencioso — mantiene datos cacheados */ }
    finally   { setLoading(false); }
  };

  const [instSel, setInstSel] = useState(null); // instalación abierta en la ventana de guardias
  const [revisando, setRevisando] = useState(null);
  const [rechazando, setRechazando] = useState(null); // guardia cuyo marcaje se está rechazando
  const [errorRevision, setErrorRevision] = useState("");
  // Lanza un Error con el mensaje del servidor para que el diálogo lo muestre
  const enviarRevision = async (g, decision, comentario) => {
    const res = await fetch(`${API_BASE}/asistencia/${g.asistencia_id}/revisar`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Device-Token": leerDeviceToken() || "" },
      body: JSON.stringify({ decision, comentario }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "No se pudo registrar la revisión.");
  };
  const revisar = async (g, decision) => {
    if (decision === "rechazar") { setRechazando(g); return; }
    setRevisando(g.asistencia_id);
    try { await enviarRevision(g, decision); }
    catch (err) { setErrorRevision(err.message); }
    finally { setRevisando(null); fetchData(); }
  };
  const rechazarConMotivo = async (motivo) => {
    await enviarRevision(rechazando, "rechazar", motivo);
    setRechazando(null);
    fetchData();
  };

  useEffect(() => {
    if (instSel === null || rechazando || errorRevision) return;
    const cerrar = (e) => { if (e.key === "Escape") setInstSel(null); };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [instSel, rechazando, errorRevision]);

  useEffect(() => {
    fetchData();
    try {
      const socket = io(SOCKET_URL, { auth: (cb) => cb({ deviceToken: leerDeviceToken(), token: leerSesion("gc_token") || token }), transports: ["websocket"] });
      socketRef.current = socket;
      socket.on("guardia:entrada",  fetchData);
      socket.on("guardia:atraso",   fetchData);
      socket.on("guardia:marcaje_por_revisar", fetchData);
      socket.on("novedad:nueva",    fetchData);
      socket.on("novedad:escalada", fetchData);
      return () => socket.disconnect();
    } catch { /* Socket.IO no disponible */ }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unirse a las salas de todas las instalaciones asignadas al cargar los datos
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !data?.kpis?.instalacionesAsignadas) return;
    data.kpis.instalacionesAsignadas.forEach(({ id }) => {
      socket.emit("join:instalacion", id);
    });
  }, [data?.kpis?.instalacionesAsignadas]);

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: T.textMut }}>Cargando...</div>;
  if (!data)   return <div style={{ textAlign: "center", padding: 40, color: T.red }}>Error al cargar datos</div>;

  const instAsignadas = data.kpis?.instalacionesAsignadas ?? [];

  // Instalaciones del supervisor + las que aparezcan en la pauta de hoy (por si faltara alguna)
  const instalaciones = [...instAsignadas];
  data.lista.forEach((g) => {
    if (!instalaciones.some((x) => x.id === g.instalacion_id)) instalaciones.push({ id: g.instalacion_id, nombre: g.instalacion });
  });
  const guardiasDe = (id) => data.lista.filter((g) => g.instalacion_id === id);
  const instAbierta = instalaciones.find((x) => x.id === instSel) ?? null;
  const porRevisar = (g) => g.asistencia_id && !g.revision_estado && (g.verificacion_gps === "por_revisar" || g.verificacion_gps === "sin_ubicacion");

  const tarjetaGuardia = (g) => (
          <div className="responsive-list-row sup-dashboard__guard" key={g.asistencia_id ?? `${g.guardia}-${g.hora_inicio}`} style={{
            background: T.bgCard, border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${ESTADO_COLOR[g.estado]}`,
            borderRadius: T.radius, padding: 12, marginBottom: 6,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div className="responsive-list-row__main">
              <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{g.guardia}</div>
              <div style={{ fontSize: 12, color: T.textSec, fontFamily: FONT.mono, background: T.bgInput, padding: "8px 10px", borderRadius: T.radius, marginTop: 8 }}>
                {g.hora_inicio}–{g.hora_fin}
              </div>
              {g.solicitud_pendiente && (
                <div style={{ fontSize: 11, color: T.yellow, marginTop: 6, fontWeight: 600 }}>
                  Solicitud pendiente: {g.solicitud_pendiente.etiqueta.toLowerCase()}
                </div>
              )}
              {g.hora_entrada && (
                <div style={{ fontSize: 10, color: T.textMut, marginTop: 2 }}>
                  Entrada: {new Date(g.hora_entrada).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" })}
                  {g.es_fallback && <>{" · "}<Icon name="smartphone" size={16} />{" fallback móvil"}</>}
                </div>
              )}
              {(g.verificacion_gps === "por_revisar" || g.verificacion_gps === "sin_ubicacion") && (
                <div style={{ fontSize: 11, color: T.yellow, marginTop: 4, fontWeight: 600 }}>
                  <Icon name="triangle-alert" size={16} /> {g.verificacion_gps === "sin_ubicacion"
                    ? "Marcaje sin ubicación"
                    : "Ubicación imprecisa"}
                  {g.distancia_entrada_m != null && ` · a ${g.distancia_entrada_m} m`}
                  {g.precision_entrada_m != null && ` · ±${g.precision_entrada_m} m`}
                  {g.revision_estado ? ` · ${g.revision_estado}` : " · por revisar"}
                </div>
              )}
              {g.asistencia_id && !g.revision_estado && (g.verificacion_gps === "por_revisar" || g.verificacion_gps === "sin_ubicacion") && (
                <div className="sup-dashboard__actions" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  <Btn variant="aprobar" onClick={() => revisar(g, "aprobar")} loading={revisando === g.asistencia_id} style={{ minHeight: 44, padding: "0 16px", fontSize: 13 }}>Aprobar</Btn>
                  <Btn variant="rechazar" onClick={() => revisar(g, "rechazar")} disabled={revisando === g.asistencia_id} style={{ minHeight: 44, padding: "0 16px", fontSize: 13 }}>Rechazar</Btn>
                </div>
              )}
              {g.comentario_guardia && !g.revision_estado && (
                <div style={{ fontSize: 11, color: T.text, marginTop: 4 }}>
                  <strong>Reenviado por el guardia:</strong> {g.comentario_guardia}
                </div>
              )}
              {g.revision_estado === "rechazado" && g.comentario_revision && (
                <div style={{ fontSize: 10, color: T.textMut, marginTop: 2 }}>Motivo: {g.comentario_revision}</div>
              )}
              {g.dispositivo?.nombre && (
                <div style={{ fontSize: 10, color: T.textMut, marginTop: 2 }}>Equipo: {g.dispositivo.nombre}</div>
              )}
              {g.verificacion_gps === "verificado" && (
                <div style={{ fontSize: 10, color: T.accent, marginTop: 2 }}>
                  Ubicación verificada{g.distancia_entrada_m != null && ` · a ${g.distancia_entrada_m} m`}
                </div>
              )}
            </div>
            <span style={{
              background: `${ESTADO_COLOR[g.estado]}18`, color: ESTADO_COLOR[g.estado],
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
              textTransform: "uppercase", letterSpacing: 0.8,
            }}>
              {g.ausencia?.etiqueta ?? ESTADO_LABEL[g.estado]}
            </span>
          </div>
  );

  return (
    <div className="operations-screen sup-dashboard">
      {rechazando && (
        <Dialogo titulo="Rechazar marcaje" mensaje={`Marcaje de ${rechazando.guardia}. El motivo queda registrado y se le notifica al guardia.`} pedirMotivo variante="rechazar" confirmarLabel="Rechazar marcaje"
          onConfirmar={rechazarConMotivo} onCancelar={() => setRechazando(null)} />
      )}
      {errorRevision && <Dialogo titulo="No se pudo registrar la revisión" mensaje={errorRevision} soloMensaje onCancelar={() => setErrorRevision("")} />}
      <SectionHeader title="Dashboard en Vivo" />
      <TurnosPorReasignar />

      {/* ── KPIs de asistencia ───────────────────────────────────── */}
      <div className="metrics-grid sup-dashboard__kpis" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <KPI label="Total Turnos" value={data.total}     sub="hoy"         accent={T.textSec} />
        <KPI label="Presentes"    value={data.presentes} sub="en turno"    accent={T.accent}  />
        <KPI label="Tardíos"      value={data.tardios}   sub="con retraso" accent={T.yellow}  />
        <KPI label="Faltantes"    value={data.faltantes} sub="sin marcar"  accent={T.red}     />
        <KPI label="Por iniciar"  value={data.porIniciar ?? 0} sub="aún no empieza" accent={T.textSec} />
        <KPI label="Sin cobertura" value={data.sinCobertura ?? 0} sub="tolerancia vencida" accent={T.red} />
      </div>

      {/* ── KPIs de novedades del área ────────────────────────────── */}
      {data.kpis && (
        <div className="metrics-grid sup-dashboard__novedades" style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          <KPI label="Nov. Pendientes" value={data.kpis.novedadesPendientes ?? data.kpis.novedadesAbiertas} sub="sin resolver" accent={T.yellow} />
          <KPI label="Nov. Recientes"  value={data.kpis.novedadesRecientes ?? 0} sub="últimas 12 h" accent={T.accent} />
        </div>
      )}

      <IndicadoresCompactos />

      {/* ── Instalaciones: al abrir una se ven sus guardias de hoy ── */}
      <h3 className="sup-dashboard__section-title">Mis Instalaciones ({instalaciones.length})</h3>
      {instalaciones.length === 0 ? (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20, textAlign: "center", fontSize: 13, color: T.textMut }}>
          No tienes instalaciones asignadas
        </div>
      ) : (
        <div className="sup-dashboard__installations" style={{ marginBottom: 20 }}>
          {instalaciones.map((inst) => {
            const gs = guardiasDe(inst.id);
            const color = CRITICIDAD_COLOR[inst.criticidad] ?? T.accent;
            const faltan = gs.filter((g) => g.estado === "faltante").length;
            const tardan = gs.filter((g) => g.estado === "tardio").length;
            const revisar = gs.filter(porRevisar).length;
            return (
              <div className="responsive-list-row sup-dashboard__installation" key={inst.id} role="button" tabIndex={0}
                onClick={() => setInstSel(inst.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setInstSel(inst.id); } }}
                style={{
                  background: T.bgCard, border: `1px solid ${T.border}`, borderLeft: `3px solid ${color}`,
                  borderRadius: T.radius, padding: "10px 14px", marginBottom: 6, cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                <div className="responsive-list-row__main">
                  <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{inst.nombre}</div>
                  {inst.direccion && <div style={{ fontSize: 10, color: T.textMut, marginTop: 2 }}>{inst.direccion}</div>}
                  <div style={{ fontSize: 12, color: T.textSec, marginTop: 8 }}>
                    {gs.length === 0 ? "Sin turnos hoy" : `${gs.length} guardia${gs.length !== 1 ? "s" : ""} hoy`}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {inst.criticidad && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: `${color}18`, color }}>{inst.criticidad}</span>
                  )}
                  {faltan > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: `${T.red}18`, color: T.red }}>{faltan} faltante{faltan !== 1 ? "s" : ""}</span>}
                  {tardan > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: T.yellowGhost, color: T.yellow }}>{tardan} tardío{tardan !== 1 ? "s" : ""}</span>}
                  {revisar > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: T.yellowGhost, color: T.yellow }}>{revisar} por revisar</span>}
                  {inst.novedadesActivas > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: T.yellowGhost, color: T.yellow }}>
                      {inst.novedadesActivas} novedad{inst.novedadesActivas !== 1 ? "es" : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {instAbierta && (
        <div role="dialog" aria-modal="true" aria-label={`Guardias de ${instAbierta.nombre}`} onClick={() => setInstSel(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(14,23,20,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, width: "100%", maxWidth: 760, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 16px 40px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: T.focusText }}>{instAbierta.nombre}</div>
                <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>Guardias en pauta hoy ({guardiasDe(instAbierta.id).length})</div>
              </div>
              <Btn variant="outline" onClick={() => setInstSel(null)} style={{ minHeight: 36, padding: "0 14px", fontSize: 13 }}>Cerrar</Btn>
            </div>
            <div style={{ overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 18 }}>
              {guardiasDe(instAbierta.id).length === 0 && (
                <div style={{ textAlign: "center", fontSize: 13, color: T.textMut, padding: 16 }}>No hay turnos asignados para hoy en esta instalación</div>
              )}
              {[
                { clave: "dia", titulo: "Turno de día", lista: guardiasDe(instAbierta.id).filter((g) => g.hora_fin > g.hora_inicio) },
                { clave: "noche", titulo: "Turno de noche", lista: guardiasDe(instAbierta.id).filter((g) => g.hora_fin <= g.hora_inicio) },
              ].filter((grupo) => grupo.lista.length > 0).map((grupo) => (
                <section key={grupo.clave}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textSec, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    {grupo.titulo} · {grupo.lista.length}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))", gap: 10 }}>
                    {grupo.lista.map(tarjetaGuardia)}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: T.textMut, textAlign: "center", marginTop: 12 }}>
        <Badge color="red"><span aria-hidden="true" style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: T.red, verticalAlign: "middle" }} /></Badge> En vivo · Se actualiza automáticamente
      </div>
    </div>
  );
}
