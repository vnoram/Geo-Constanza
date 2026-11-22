import { Aparecer } from "../../components/ui/Aparecer";
import { Icon } from "../../components/ui/Icon";
import { FONT, T } from "../../theme/theme";
import { lunesDe, sumarDias } from "../../utils/fechaChile";

const VERDE_NEON = "#39FF88";
const NARANJA = "#E8893A";
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const COLUMNAS = "150px repeat(7, minmax(84px, 1fr))";

const fechaDeTurno = (t) => String(t.fecha).slice(0, 10);
const esNocturno = (t) => t.hora_inicio && t.hora_fin && t.hora_fin < t.hora_inicio;
const corto = (h) => h.slice(0, 5);

const etiquetaFecha = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
};

const flecha = {
  background: "transparent", border: `1px solid ${T.border}`, color: T.text, borderRadius: T.radius,
  width: 34, height: 30, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
};

// Cuadrícula semanal (lunes a domingo): una sección por instalación, una fila por guardia.
export function SemanaTurnos({ lunes, hoy, turnos, onCambiarSemana, onEditar }) {
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const instalaciones = new Map();
  for (const t of turnos) {
    const idInst = t.instalacion_id;
    if (!instalaciones.has(idInst)) instalaciones.set(idInst, { nombre: t.instalacion?.nombre || "Sin instalación", guardias: new Map() });
    const inst = instalaciones.get(idInst);
    if (!inst.guardias.has(t.usuario_id)) inst.guardias.set(t.usuario_id, { nombre: t.usuario?.nombre || "Sin guardia", porDia: {} });
    (inst.guardias.get(t.usuario_id).porDia[fechaDeTurno(t)] ||= []).push(t);
  }
  const secciones = [...instalaciones.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const totalTurnos = turnos.length;

  return (
    <Aparecer>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className="gc-accion-btn gc-accion-btn--morado" aria-label="Semana anterior" onClick={() => onCambiarSemana(sumarDias(lunes, -7))} style={flecha}><Icon name="arrow-left" size={16} /></button>
          <button type="button" className="gc-accion-btn gc-accion-btn--morado" aria-label="Semana siguiente" onClick={() => onCambiarSemana(sumarDias(lunes, 7))} style={{ ...flecha, transform: "scaleX(-1)" }}><Icon name="arrow-left" size={16} /></button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>{etiquetaFecha(dias[0])} – {etiquetaFecha(dias[6])}</div>
            <div style={{ fontSize: 11, color: T.textMut }}>{totalTurnos} {totalTurnos === 1 ? "turno" : "turnos"} esta semana</div>
          </div>
        </div>
        {lunes !== lunesDe(hoy) && (
          <button type="button" className="gc-accion-btn gc-accion-btn--morado" onClick={() => onCambiarSemana(lunesDe(hoy))} style={{ ...flecha, width: "auto", padding: "0 12px", fontSize: 12, fontWeight: 700, fontFamily: FONT.ui }}>Esta semana</button>
        )}
      </div>

      {secciones.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 24, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius }}>
          No hay turnos programados esta semana.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 740 }}>
            <div style={{ display: "grid", gridTemplateColumns: COLUMNAS, gap: 4, marginBottom: 4 }}>
              <div />
              {dias.map((iso, i) => (
                <div key={iso} style={{
                  textAlign: "center", fontSize: 11, fontWeight: 700, padding: "5px 0", borderRadius: 6,
                  color: iso === hoy ? NARANJA : T.textMut,
                  background: iso === hoy ? "rgba(232,137,58,0.12)" : "transparent",
                }}>
                  {DIAS[i]} <span style={{ fontSize: 13 }}>{Number(iso.slice(8))}</span>
                </div>
              ))}
            </div>

            {secciones.map((inst) => (
              <div key={inst.nombre} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="building-2" size={14} /> {inst.nombre}
                </div>
                {[...inst.guardias.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((g) => (
                  <div key={g.nombre} style={{ display: "grid", gridTemplateColumns: COLUMNAS, gap: 4, marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 700, color: T.text, padding: "0 6px", minWidth: 0 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.nombre}</span>
                    </div>
                    {dias.map((iso) => {
                      const lista = g.porDia[iso] || [];
                      return (
                        <div key={iso} style={{
                          minHeight: 44, borderRadius: 6, padding: 3, display: "flex", flexDirection: "column", gap: 3, justifyContent: "center",
                          background: T.bgCard, border: `1px solid ${iso === hoy ? NARANJA : T.border}`,
                        }}>
                          {lista.map((t) => {
                            const editable = t.estado === "programado";
                            return (
                              <button
                                key={t.id} type="button" className={editable ? "gc-accion-btn gc-accion-btn--morado" : undefined} disabled={!editable} onClick={() => onEditar(t)}
                                title={`${corto(t.hora_inicio)} – ${corto(t.hora_fin)}${esNocturno(t) ? " (+1)" : ""} · ${t.estado}`}
                                style={{
                                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "4px 2px",
                                  borderRadius: 5, border: "1px solid rgba(122,78,191,.5)", background: "rgba(122,78,191,.22)",
                                  color: T.text, fontSize: 11, fontWeight: 700, fontFamily: FONT.ui,
                                  cursor: editable ? "pointer" : "default", opacity: t.estado === "completado" ? 0.6 : 1,
                                }}
                              >
                                <Icon name={esNocturno(t) ? "moon" : "sun"} size={13} color={VERDE_NEON} />
                                {corto(t.hora_inicio)}–{corto(t.hora_fin)}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 14, fontSize: 11, color: T.textMut, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="sun" size={14} color={VERDE_NEON} />Diurno</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="moon" size={14} color={VERDE_NEON} />Nocturno (termina al día siguiente)</span>
        <span>Toca un turno programado para editarlo</span>
      </div>
    </Aparecer>
  );
}
