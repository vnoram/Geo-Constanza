import "../../components/ui/Grupo9Visual.css";
import { AnimatePresence } from "framer-motion";
import { Aparecer } from "../../components/ui/Aparecer";
import { Esqueleto } from "../../components/ui/Esqueleto";
import { Selector } from "../../components/ui/Selector";
import "./SupDashboard.css";
import "./SupPantallas.css";
import { Icon } from "../../components/ui/Icon";
import { useState, useEffect } from "react";
import { FONT, T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { Btn } from "../../components/ui/Btn";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";
import { ahoraChile, lunesDe, sumarDias } from "../../utils/fechaChile";
import { SemanaTurnos } from "./SemanaTurnos";
import { CalendarioRango } from "../../components/ui/CalendarioRango";
import { formatearRut } from "../../utils/rut";
import { Aviso } from "../../components/ui/Aviso";

const hoyLocal = () => ahoraChile().fecha;

// `fecha` llega como "2026-09-26T00:00:00.000Z": se usa la parte de fecha tal cual
const fechaDeTurno = (t) => String(t.fecha).slice(0, 10);

const formatearFecha = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
};

const esNocturno = (t) => t.hora_inicio && t.hora_fin && t.hora_fin < t.hora_inicio;

const diaSiguiente = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d + 1).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
};

// Aviso bajo las horas: deja claro que un turno nocturno termina al día siguiente
function AvisoNocturno({ form }) {
  if (!esNocturno(form) || !form.fecha) return null;
  return (
    <div style={{
      fontSize: 11, color: T.focusText, background: "rgba(179,155,224,0.08)",
      border: "1px solid rgba(179,155,224,0.3)", borderRadius: T.radius, padding: "8px 10px", marginBottom: 12,
    }}>
      <Icon name="moon" size={16} /> Turno nocturno: comienza el {formatearFecha(form.fecha)} a las {form.hora_inicio} y
      termina el {diaSiguiente(form.fecha)} a las {form.hora_fin}.
    </div>
  );
}

// Misma regla de solapamiento que usa el backend al crear/editar
const haySolape = (a, b) => a.hora_inicio <= b.hora_fin && a.hora_fin >= b.hora_inicio;

const ESTADO_COLOR = { programado: "accent", completado: "yellow", cancelado: "red" };

const etiquetaStyle = { fontSize: 11, color: T.textMut, marginBottom: 4, fontWeight: 600 };

// ─── MODAL EDITAR TURNO ──────────────────────────────────────────
export function ModalEditarTurno({ turno, turnos, guardias, instalaciones, inputStyle, onClose, onGuardado }) {
  const [form, setForm] = useState({
    usuario_id: turno.usuario_id,
    instalacion_id: turno.instalacion_id,
    fecha: fechaDeTurno(turno),
    hora_inicio: turno.hora_inicio,
    hora_fin: turno.hora_fin,
  });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async () => {
    if (!form.usuario_id || !form.instalacion_id || !form.fecha || !form.hora_inicio || !form.hora_fin) {
      setError("Completa todos los campos.");
      return;
    }
    // Validación previa en el navegador (el backend también la hace)
    const choque = turnos.find(
      (t) =>
        t.id !== turno.id &&
        t.estado !== "cancelado" &&
        t.usuario_id === form.usuario_id &&
        fechaDeTurno(t) === form.fecha &&
        haySolape(t, form),
    );
    if (choque) {
      setError(
        `Conflicto de turno: el guardia ya tiene un turno de ${choque.hora_inicio} a ${choque.hora_fin} ese día` +
          (choque.instalacion?.nombre ? ` en ${choque.instalacion.nombre}` : ""),
      );
      return;
    }

    setGuardando(true);
    setError("");
    try {
      // Fecha en ISO completo: compatible con cualquier versión del backend
      const actualizado = await api.put(`/turnos/${turno.id}`, {
        ...form,
        fecha: `${form.fecha}T00:00:00.000Z`,
      });
      onGuardado(actualizado);
    } catch (e) {
      setError(e.message || "Error al guardar el turno");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Aparecer salida desplazar={false}
      className="responsive-modal-overlay"
      style={{
        position: "fixed", inset: 0, background: "rgba(14,23,20,0.88)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
      }}
    >
      <Aparecer salida
        className="responsive-modal"
        style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 22,
          width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
        }}
      >
        <div className="responsive-list-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="responsive-list-row__main">
            <div style={{ fontWeight: 800, fontSize: 16, color: T.text }}>Editar Turno</div>
            <div style={{ fontSize: 11, color: T.textMut, marginTop: 2 }}>
              {turno.usuario?.nombre} · {formatearFecha(fechaDeTurno(turno))}
            </div>
          </div>
          <button
            className="touch-target gc-accion-btn gc-accion-btn--morado"
            aria-label="Cerrar"
            onClick={onClose}
            style={{ background: "none", border: "none", color: T.textMut, fontSize: 18, cursor: "pointer" }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={etiquetaStyle}>GUARDIA *</div>
        <Selector bloque etiqueta="Guardia" value={form.usuario_id} onChange={(valor) => set("usuario_id")({ target: { value: valor } })} opciones={[...(!guardias.some((g) => g.id === turno.usuario_id) ? [{ valor: turno.usuario_id, etiqueta: turno.usuario?.nombre || "Guardia actual" }] : []), ...guardias.map((g) => ({ valor: g.id, etiqueta: g.nombre }))]} />

        <div style={etiquetaStyle}>INSTALACIÓN *</div>
        <Selector bloque etiqueta="Instalación" value={form.instalacion_id} onChange={(valor) => set("instalacion_id")({ target: { value: valor } })} opciones={[...(!instalaciones.some((i) => i.id === turno.instalacion_id) ? [{ valor: turno.instalacion_id, etiqueta: turno.instalacion?.nombre || "Instalación actual" }] : []), ...instalaciones.map((i) => ({ valor: i.id, etiqueta: <>{i.nombre} {i.comuna ? `(${i.comuna})` : ""}</> }))]} />

        <div style={etiquetaStyle}>FECHA DE INICIO *</div>
        <div style={{ marginBottom: 10 }}>
          <CalendarioRango marcados={form.fecha ? [form.fecha] : []} destacados={form.fecha ? [form.fecha] : []}
            onElegir={(iso) => setForm((f) => ({ ...f, fecha: iso }))} />
        </div>

        <div className="form-grid-2" style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={etiquetaStyle}>HORA INICIO</div>
            <input aria-label="Hora inicio" className="touch-target" type="time" style={inputStyle} value={form.hora_inicio} onChange={set("hora_inicio")} />
          </div>
          <div>
            <div style={etiquetaStyle}>HORA FIN</div>
            <input aria-label="Hora fin" className="touch-target" type="time" style={inputStyle} value={form.hora_fin} onChange={set("hora_fin")} />
          </div>
        </div>

        <AvisoNocturno form={form} />

        {error && (
          <div style={{
            fontSize: 12, padding: "8px 12px", borderRadius: T.radius, marginBottom: 12,
            background: "rgba(232,106,42,0.15)", color: T.red, border: `1px solid ${T.red}`,
          }}>
            {error}
          </div>
        )}

        <div className="action-wrap modal-actions" style={{ display: "flex", gap: 10 }}>
          <Btn variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Btn>
          <Btn full onClick={guardar} loading={guardando}>Guardar Cambios</Btn>
        </div>
      </Aparecer>
    </Aparecer>
  );
}

export function SupGuardias() {
  const [guardias, setGuardias] = useState([]);
  const [instalaciones, setInstalaciones] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [form, setForm] = useState({
    usuario_id: "",
    instalacion_id: "",
    fechas: [],
    hora_inicio: "06:00",
    hora_fin: "14:00",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnos, setTurnos] = useState([]);
  const [cargandoTurnos, setCargandoTurnos] = useState(true);
  const [filtroGuardia, setFiltroGuardia] = useState("");
  const [turnoEditando, setTurnoEditando] = useState(null);
  const [aviso, setAviso] = useState("");
  const [diasEnPauta, setDiasEnPauta] = useState([]);
  const [lunes, setLunes] = useState(() => lunesDe(hoyLocal()));

  const cargarTurnos = async () => {
    setCargandoTurnos(true);
    try {
      const data = await api.get(`/turnos?desde=${lunes}&hasta=${sumarDias(lunes, 6)}`);
      setTurnos(Array.isArray(data) ? data : (data.data || []));
    } catch (err) {
      console.error("Error al cargar turnos:", err);
    } finally {
      setCargandoTurnos(false);
    }
  };

  const cargarRecursos = async () => {
    setCargandoDatos(true);
    try {
      const [resGuardias, resInstalaciones] = await Promise.all([
        api.get("/usuarios?rol=ggss&limit=200"),
        api.get("/instalaciones"),
      ]);

      const listaGuardias = Array.isArray(resGuardias) ? resGuardias : (resGuardias.data || []);
      const listaInst  = Array.isArray(resInstalaciones) ? resInstalaciones : (resInstalaciones.data || []);

      setGuardias(listaGuardias);
      setInstalaciones(listaInst);

      // Si solo hay una instalación disponible, preseleccionarla automáticamente
      if (listaInst.length === 1) {
        setForm((prev) => ({ ...prev, instalacion_id: listaInst[0].id }));
      }
    } catch (err) {
      console.error("Error al cargar recursos de guardias/instalaciones:", err);
      setMsg("Error al cargar instalaciones o guardias desde el servidor.");
    } finally {
      setCargandoDatos(false);
    }
  };

  useEffect(() => {
    cargarRecursos();
  }, []);

  useEffect(() => {
    cargarTurnos();
  }, [lunes]);

  // Días en que el guardia elegido ya tiene turno programado (se pintan en verde en el calendario)
  useEffect(() => {
    if (!form.usuario_id) { setDiasEnPauta([]); return; }
    let vigente = true;
    api.get(`/turnos?usuario_id=${form.usuario_id}&desde=${hoyLocal()}`)
      .then((data) => {
        const lista = Array.isArray(data) ? data : (data.data || []);
        if (!vigente) return;
        const ocupados = [...new Set(lista.filter((t) => t.estado !== "cancelado").map(fechaDeTurno))];
        setDiasEnPauta(ocupados);
        // Si ya había días marcados que resultan estar en pauta para este guardia, se sacan
        setForm((f) => (f.fechas.some((x) => ocupados.includes(x)) ? { ...f, fechas: f.fechas.filter((x) => !ocupados.includes(x)) } : f));
      })
      .catch(() => { if (vigente) setDiasEnPauta([]); });
    return () => { vigente = false; };
  }, [form.usuario_id, turnos]);

  const onTurnoGuardado = () => {
    setTurnoEditando(null);
    setAviso(<><Icon name="circle-check" size={16} />{" Turno actualizado correctamente"}</>);
    setTimeout(() => setAviso(""), 4000);
    cargarTurnos();
  };

  const { fecha: hoy } = ahoraChile();
  const idsInstalaciones = new Set(instalaciones.map((i) => i.id));
  const turnosVisibles = turnos
    .filter((t) => t.estado !== "cancelado")
    // Solo turnos de las instalaciones del supervisor (/instalaciones ya viene filtrado)
    .filter((t) => idsInstalaciones.has(t.instalacion_id))
    .filter((t) => !filtroGuardia || t.usuario_id === filtroGuardia);

  // Los turnos extra se marcan día a día: tocar de nuevo un día lo quita.
  const alternarFecha = (iso) => diasEnPauta.includes(iso) || setForm((f) => ({
    ...f,
    fechas: f.fechas.includes(iso) ? f.fechas.filter((x) => x !== iso) : [...f.fechas, iso].sort(),
  }));

  const crearTurno = async () => {
    if (!form.usuario_id || !form.instalacion_id || !form.fechas.length) {
      setMsg("Elige guardia, instalación y al menos un día en el calendario.");
      return;
    }
    setLoading(true);
    setMsg("");
    const fallidas = [];
    let creados = 0;
    for (const fecha of form.fechas) {
      try {
        await api.post("/turnos", { usuario_id: form.usuario_id, instalacion_id: form.instalacion_id, hora_inicio: form.hora_inicio, hora_fin: form.hora_fin, fecha });
        creados += 1;
      } catch (e) {
        fallidas.push(`${fecha.slice(8)}/${fecha.slice(5, 7)}: ${e.message || "error"}`);
      }
    }
    if (creados) cargarTurnos();
    if (fallidas.length) {
      // Los días que sí se crearon salen del calendario; quedan marcados solo los que fallaron.
      setForm((f) => ({ ...f, fechas: f.fechas.filter((x) => fallidas.some((m) => m.startsWith(`${x.slice(8)}/${x.slice(5, 7)}:`))) }));
      setMsg(`${creados ? `${creados} turno(s) creado(s). ` : ""}No se pudo crear: ${fallidas.join(" · ")}`);
    } else {
      setMsg("");
      setAviso(<><Icon name="circle-check" size={16} />{creados === 1 ? " Turno extra creado correctamente" : ` ${creados} turnos extra creados correctamente`}</>);
      setTimeout(() => setAviso(""), 4000);
      setMostrarForm(false);
      setForm({
        usuario_id: "",
        instalacion_id: instalaciones.length === 1 ? instalaciones[0].id : "",
        fechas: [],
        hora_inicio: "06:00",
        hora_fin: "14:00",
      });
    }
    setLoading(false);
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: T.radius, border: `1px solid ${T.border}`,
    background: T.bgCard, color: T.text, fontSize: 13, marginBottom: 10, boxSizing: "border-box",
    fontFamily: FONT.ui,
  };

  return (
    <Aparecer className="operations-screen sup-dashboard sup-supervision sup-guardias g9-visual">
      <SectionHeader
        title="Guardias"
        sub="Personal asignado a tus instalaciones"
        action={{
          label: mostrarForm ? "Cerrar Formulario" : "+ Turno extra",
          onClick: () => {
            setMostrarForm((v) => !v);
            setMsg("");
          },
        }}
      />

      {mostrarForm && (
        <Aparecer grupo="SupGuardias.jsx:secciones" className="sup-supervision__panel" style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 18, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: T.text }}>
            Nuevo turno extra
          </div>

          <div style={etiquetaStyle}>GUARDIA *</div>
          <Selector bloque etiqueta="Guardia" value={form.usuario_id || "__todos__"} onChange={(valor) => { const v = valor === "__todos__" ? "" : valor; setForm((f) => ({ ...f, usuario_id: v })); }} opciones={[{ valor: "__todos__", etiqueta: "Seleccionar guardia..." }, ...guardias.map((g) => ({ valor: g.id, etiqueta: g.nombre }))]} />

          <div style={etiquetaStyle}>INSTALACIÓN *</div>
          <Selector bloque etiqueta="Instalación" value={form.instalacion_id || "__todos__"} onChange={(valor) => { const v = valor === "__todos__" ? "" : valor; setForm((f) => ({ ...f, instalacion_id: v })); }} opciones={[{ valor: "__todos__", etiqueta: "Seleccionar instalación..." }, ...instalaciones.map((i) => ({ valor: i.id, etiqueta: <>{i.nombre} {i.comuna ? `(${i.comuna})` : ""}</> }))]} />

          <div style={etiquetaStyle}>DÍAS DEL TURNO EXTRA *</div>
          <div style={{ fontSize: 11, color: T.textMut, marginBottom: 8 }}>
            Marca cada día en que el guardia hará turno extra; vuelve a tocar para quitarlo.
          </div>
          <CalendarioRango marcados={form.fechas} destacados={form.fechas} enPauta={diasEnPauta} onElegir={alternarFecha} />
          {form.usuario_id && (
            <div style={{ fontSize: 11, color: T.textMut, marginTop: 6 }}>
              <span style={{ color: "#39FF88", fontWeight: 700 }}>Verde</span>: días en que este guardia ya está en pauta (no se pueden elegir).
            </div>
          )}
          <div style={{ fontSize: 12, color: form.fechas.length ? T.focusText : T.textMut, margin: "12px 0 16px" }}>
            {form.fechas.length
              ? `${form.fechas.length} ${form.fechas.length === 1 ? "día" : "días"}: ${form.fechas.map((f) => `${f.slice(8)}/${f.slice(5, 7)}`).join(", ")}`
              : "Aún no has elegido días."}
          </div>

          <div className="form-grid-2" style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={etiquetaStyle}>HORA INICIO</div>
              <input
                className="touch-target"
                aria-label="Hora de inicio"
                type="time"
                style={inputStyle}
                value={form.hora_inicio}
                onChange={(e) => setForm((f) => ({ ...f, hora_inicio: e.target.value }))}
              />
            </div>
            <div>
              <div style={etiquetaStyle}>HORA FIN</div>
              <input
                className="touch-target"
                aria-label="Hora de fin"
                type="time"
                style={inputStyle}
                value={form.hora_fin}
                onChange={(e) => setForm((f) => ({ ...f, hora_fin: e.target.value }))}
              />
            </div>
          </div>

          <AvisoNocturno form={{ ...form, fecha: form.fechas[0] }} />

          {msg && (
            <div style={{
              fontSize: 12,
              padding: "8px 12px",
              borderRadius: T.radius,
              background: msg.includes("exitosamente") ? "rgba(62,154,114,0.15)" : "rgba(232,106,42,0.15)",
              color: msg.includes("exitosamente") ? T.accent : T.red,
              border: `1px solid ${msg.includes("exitosamente") ? T.accent : T.red}`,
              marginBottom: 12,
            }}>
              {msg}
            </div>
          )}

          <Btn onClick={crearTurno} disabled={loading} full>
            {loading ? "Creando..." : form.fechas.length > 1 ? `Confirmar ${form.fechas.length} turnos` : "Confirmar turno"}
          </Btn>
        </Aparecer>
      )}

      {/* ── Próximos turnos ── */}
      <div className="filter-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, margin: "4px 0 10px" }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#9F8FC4" }}>Turnos de la semana</div>
        <Selector etiqueta="Todos los guardias" value={filtroGuardia || "__todos__"} onChange={(valor) => { const v = valor === "__todos__" ? "" : valor; setFiltroGuardia(v); }} opciones={[{ valor: "__todos__", etiqueta: "Todos los guardias" }, ...guardias.map((g) => ({ valor: g.id, etiqueta: g.nombre }))]} />
      </div>

      <Aviso mensaje={aviso} />

      {cargandoTurnos ? (
        <Esqueleto filas={3} alto={64} />
      ) : (
        <SemanaTurnos lunes={lunes} hoy={hoy} turnos={turnosVisibles} onCambiarSemana={setLunes} onEditar={setTurnoEditando} />
      )}

      <div style={{ fontWeight: 800, fontSize: 14, color: "#9F8FC4", margin: "18px 0 10px" }}>Personal</div>

      {cargandoDatos ? (
        <Esqueleto filas={3} alto={64} />
      ) : guardias.length === 0 ? (
        <div className="g9-vacio" style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 20 }}>
          No hay guardias registrados.
        </div>
      ) : (
        <div className="sup-supervision__grid">{guardias.map((g, i) => (
          <Aparecer grupo="SupGuardias.jsx:19538"
            className="responsive-list-row sup-supervision__person"
            key={g.id || i}
            style={{
              background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius,
              padding: 12, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center",
              borderLeft: `3px solid ${g.estado === "activo" ? T.accent : T.red}`,
            }}
          >
            <div className="responsive-list-row__main">
              <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{g.nombre}</div>
              <div className="g9-dato-personal" style={{ fontSize: 11, color: T.textMut }}>
                GGSS {g.rut ? `· ${formatearRut(g.rut)}` : ""}
              </div>
            </div>
            <Badge color={g.estado === "activo" ? "accent" : "red"}>{g.estado}</Badge>
          </Aparecer>
        ))}</div>
      )}

      <AnimatePresence>{turnoEditando && (
        <ModalEditarTurno
          turno={turnoEditando}
          turnos={turnos}
          guardias={guardias}
          instalaciones={instalaciones}
          inputStyle={inputStyle}
          onClose={() => setTurnoEditando(null)}
          onGuardado={onTurnoGuardado}
        />
      )}</AnimatePresence>
    </Aparecer>
  );
}
