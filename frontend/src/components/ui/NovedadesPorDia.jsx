import { Fragment, useState } from "react";
import { T } from "../../theme/theme";
import { Icon } from "./Icon";
import { ahoraChile, sumarDias } from "../../utils/fechaChile";
import { franjaDe } from "../../utils/novedades";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const partes = (iso) => iso.split("-").map(Number);
const textoCorto = (iso) => { const [, m, d] = partes(iso); return `${d} ${MESES[m - 1]}`; };
const lunesDe = (iso) => {
  const [a, m, d] = partes(iso);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return sumarDias(iso, -((dow + 6) % 7));
};

function etiqueta(clave) {
  const hoy = ahoraChile().fecha;
  const rango = `${textoCorto(clave)} – ${textoCorto(sumarDias(clave, 6))}`;
  if (clave === lunesDe(hoy)) return { titulo: "Esta semana", sub: rango };
  if (clave === sumarDias(lunesDe(hoy), -7)) return { titulo: "Semana pasada", sub: rango };
  return { titulo: `Semana del ${textoCorto(clave)}`, sub: `al ${textoCorto(sumarDias(clave, 6))}` };
}

// Carrusel semanal: una semana (lun–dom) a la vez; se puede navegar libremente hacia atrás hasta la semana actual, haya o no registros.
// render(item, { compacta: true }) dibuja cada novedad dentro de la columna de su día.
export function NovedadesPorDia({ items, render, campoFecha = "created_at", semanal = true, vacio = "No hay novedades." }) {
  if (!semanal) return <ListaPlana items={items} render={render} campoFecha={campoFecha} vacio={vacio} />;
  return <CarruselSemanal items={items} render={render} campoFecha={campoFecha} />;
}

// Lista simple (sin calendario) para vistas de "recientes": de la más nueva a la más antigua, con separador Día/Noche.
function ListaPlana({ items, render, campoFecha, vacio }) {
  const lista = [...items].sort((a, b) => new Date(b[campoFecha]) - new Date(a[campoFecha]));
  if (lista.length === 0) {
    return <div style={{ textAlign: "center", color: T.textMut, fontSize: 13, padding: 28, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius }}>{vacio}</div>;
  }
  return (
    <div className="nov-list">
      {lista.map((item, i) => {
        const franja = franjaDe(item[campoFecha]);
        const inicioGrupo = i === 0 || franjaDe(lista[i - 1][campoFecha]) !== franja;
        const esDia = franja === "dia";
        return (
          <Fragment key={item.id ?? i}>
            {inicioGrupo && (
              <div
                role="separator" aria-label={esDia ? "Día" : "Noche"}
                style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: esDia ? T.yellow : T.focusMuted }}
              >
                <Icon name={esDia ? "sun" : "moon"} size={13} color={esDia ? T.yellow : T.focusMuted} />
                <span>{esDia ? "Día" : "Noche"}</span>
                <span aria-hidden="true" style={{ flex: 1, height: 1, background: T.border }} />
              </div>
            )}
            {render(item, { compacta: false })}
          </Fragment>
        );
      })}
    </div>
  );
}

function CarruselSemanal({ items, render, campoFecha }) {
  const semanaActual = lunesDe(ahoraChile().fecha);
  const [clave, setClave] = useState(semanaActual);

  const lista = items
    .filter((item) => lunesDe(ahoraChile(new Date(item[campoFecha])).fecha) === clave)
    .sort((a, b) => new Date(b[campoFecha]) - new Date(a[campoFecha]));
  const { titulo, sub } = etiqueta(clave);

  const flecha = (disabled, onClick, name, label) => (
    <button
      type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="touch-target gc-accion-btn gc-accion-btn--morado nov-semana__flecha"
      style={{
        width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: T.radius,
        background: "transparent", border: `1px solid ${T.border}`, color: T.text,
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1,
      }}
    >
      <Icon name="chevron-right" size={16} color={T.textSec} style={name === "izq" ? { transform: "rotate(180deg)" } : undefined} />
    </button>
  );

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12,
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "8px 10px",
      }}>
        {flecha(false, () => setClave(sumarDias(clave, -7)), "izq", "Semana anterior")}
        <div style={{ flex: 1, minWidth: 120, textAlign: "center" }} aria-live="polite">
          <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>{titulo}</div>
          <div style={{ fontSize: 11, color: T.textMut }}>
            {sub}{sub ? " · " : ""}{lista.length} {lista.length === 1 ? "novedad" : "novedades"}
          </div>
        </div>
        {flecha(clave >= semanaActual, () => setClave(sumarDias(clave, 7)), "der", "Semana siguiente")}
      </div>
        <div className="nov-semana">
            {Array.from({ length: 7 }, (_, i) => sumarDias(clave, i)).map((dia) => {
              const delDia = lista.filter((item) => ahoraChile(new Date(item[campoFecha])).fecha === dia);
              const esHoy = dia === ahoraChile().fecha;
              const [a, m, d] = partes(dia);
              return (
                <section
                  key={dia} aria-label={`${DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${d} ${MESES[m - 1]}`}
                  className={`nov-semana__dia${delDia.length ? "" : " nov-semana__dia--vacio"}`}
                  style={{
                    background: delDia.length ? "transparent" : T.bgCard,
                    border: `1px solid ${esHoy ? "rgba(159,131,214,0.75)" : T.border}`,
                  }}
                >
                  <div className="nov-semana__cab">
                    <span style={{ fontWeight: 800, fontSize: 13, color: esHoy ? T.focusStrong : T.text, textTransform: "capitalize" }}>
                      {DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} {d}
                    </span>
                    <span style={{ fontSize: 11, color: T.textMut }}>{MESES[m - 1]}{esHoy ? " · hoy" : ""}</span>
                    <span style={{ flex: 1 }} />
                    {delDia.length > 0 && <span style={{ fontSize: 11, color: T.textSec, fontWeight: 700 }}>{delDia.length}</span>}
                  </div>
                  {delDia.length === 0 ? (
                    <div className="nov-semana__vacio">Sin novedades</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {delDia.map((item, i) => {
                        const franja = franjaDe(item[campoFecha]);
                        const inicioGrupo = i === 0 || franjaDe(delDia[i - 1][campoFecha]) !== franja;
                        const esDia = franja === "dia";
                        return (
                          <Fragment key={item.id ?? i}>
                            {inicioGrupo && (
                              <div
                                role="separator" aria-label={esDia ? "Día" : "Noche"}
                                style={{ display: "flex", alignItems: "center", gap: 6, margin: i === 0 ? "0" : "6px 0 0", fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: esDia ? T.yellow : T.focusMuted }}
                              >
                                <Icon name={esDia ? "sun" : "moon"} size={12} color={esDia ? T.yellow : T.focusMuted} />
                                <span>{esDia ? "Día" : "Noche"}</span>
                                <span aria-hidden="true" style={{ flex: 1, height: 1, background: T.border }} />
                              </div>
                            )}
                            {render(item, { compacta: true })}
                          </Fragment>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
        </div>
    </div>
  );
}
