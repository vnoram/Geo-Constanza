import { useState, useEffect } from "react";
import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { Btn } from "../../components/ui/Btn";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";
import { ROLES } from "../../constants/roles";
import { ahoraChile, sumarDias } from "../../utils/fechaChile";

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
      fontSize: 11, color: "#c4a8ff", background: "rgba(196,168,255,0.08)",
      border: "1px solid rgba(196,168,255,0.3)", borderRadius: 8, padding: "8px 10px", marginBottom: 12,
    }}>
      🌙 Turno nocturno: comienza el {formatearFecha(form.fecha)} a las {form.hora_inicio} y
      termina el {diaSiguiente(form.fecha)} a las {form.hora_fin}.
    </div>
  );
}

// Misma regla de solapamiento que usa el backend al crear/editar
const haySolape = (a, b) => a.hora_inicio <= b.hora_fin && a.hora_fin >= b.hora_inicio;

const ESTADO_COLOR = { programado: "accent", completado: "yellow", cancelado: "red" };

const etiquetaStyle = { fontSize: 11, color: T.textMut, marginBottom: 4, fontWeight: 600 };

// ─── MODAL EDITAR TURNO ──────────────────────────────────────────
function ModalEditarTurno({ turno, turnos, guardias, instalaciones, inputStyle, onClose, onGuardado }) {
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
    <div
      className="responsive-modal-overlay"
      style={{
        position: "fixed", inset: 0, background: "rgba(6,13,24,0.88)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
      }}
    >
      <div
        className="responsive-modal"
        style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22,
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
            className="touch-target"
            aria-label="Cerrar"
            onClick={onClose}
            style={{ background: "none", border: "none", color: T.textMut, fontSize: 18, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <div style={etiquetaStyle}>GUARDIA *</div>
        <select className="touch-target" style={inputStyle} value={form.usuario_id} onChange={set("usuario_id")}>
          {!guardias.some((g) => g.id === turno.usuario_id) && (
            <option value={turno.usuario_id}>{turno.usuario?.nombre || "Guardia actual"}</option>
          )}
          {guardias.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre} ({g.rol === ROLES.GGSS_EN_PAUTA ? "Pauta" : "Libre"})
            </option>
          ))}
        </select>

        <div style={etiquetaStyle}>INSTALACIÓN *</div>
        <select className="touch-target" style={inputStyle} value={form.instalacion_id} onChange={set("instalacion_id")}>
          {!instalaciones.some((i) => i.id === turno.instalacion_id) && (
            <option value={turno.instalacion_id}>{turno.instalacion?.nombre || "Instalación actual"}</option>
          )}
          {instalaciones.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre} {i.comuna ? `(${i.comuna})` : ""}
            </option>
          ))}
        </select>

        <div style={etiquetaStyle}>FECHA DE INICIO *</div>
        <input className="touch-target" type="date" style={inputStyle} value={form.fecha} onChange={set("fecha")} />

        <div className="form-grid-2" style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={etiquetaStyle}>HORA INICIO</div>
            <input className="touch-target" type="time" style={inputStyle} value={form.hora_inicio} onChange={set("hora_inicio")} />
          </div>
          <div>
            <div style={etiquetaStyle}>HORA FIN</div>
            <input className="touch-target" type="time" style={inputStyle} value={form.hora_fin} onChange={set("hora_fin")} />
          </div>
        </div>

        <AvisoNocturno form={form} />

        {error && (
          <div style={{
            fontSize: 12, padding: "8px 12px", borderRadius: 8, marginBottom: 12,
            background: "rgba(239, 68, 68, 0.15)", color: T.red, border: `1px solid ${T.red}`,
          }}>
            {error}
          </div>
        )}

        <div className="action-wrap modal-actions" style={{ display: "flex", gap: 10 }}>
          <Btn variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Btn>
          <Btn full onClick={guardar} loading={guardando}>Guardar Cambios</Btn>
        </div>
      </div>
    </div>
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
    fecha: hoyLocal(),
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

  const cargarTurnos = async () => {
    setCargandoTurnos(true);
    try {
      const data = await api.get(`/turnos?desde=${hoyLocal()}`);
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
      const [resPauta, resLibre, resInstalaciones] = await Promise.all([
        api.get("/usuarios?rol=pauta&limit=100"),
        api.get("/usuarios?rol=libre&limit=100"),
        api.get("/instalaciones"),
      ]);

      const listaPauta = Array.isArray(resPauta) ? resPauta : (resPauta.data || []);
      const listaLibre = Array.isArray(resLibre) ? resLibre : (resLibre.data || []);
      const listaInst  = Array.isArray(resInstalaciones) ? resInstalaciones : (resInstalaciones.data || []);

      setGuardias([...listaPauta, ...listaLibre]);
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
    cargarTurnos();
  }, []);

  const onTurnoGuardado = () => {
    setTurnoEditando(null);
    setAviso("✅ Turno actualizado correctamente");
    setTimeout(() => setAviso(""), 4000);
    cargarTurnos();
  };

  const { fecha: hoy, hora: horaActual } = ahoraChile();
  const ayer = sumarDias(hoy, -1);
  const idsInstalaciones = new Set(instalaciones.map((i) => i.id));
  const turnosVisibles = turnos
    .filter((t) => t.estado !== "cancelado")
    // Desde hoy, más el turno nocturno de ayer si todavía no termina
    .filter((t) => fechaDeTurno(t) >= hoy || (fechaDeTurno(t) === ayer && esNocturno(t) && horaActual < t.hora_fin))
    // Solo turnos de las instalaciones del supervisor (/instalaciones ya viene filtrado)
    .filter((t) => idsInstalaciones.has(t.instalacion_id))
    .filter((t) => !filtroGuardia || t.usuario_id === filtroGuardia);

  // Agrupar por fecha manteniendo el orden (el backend ya ordena por fecha)
  const turnosPorFecha = turnosVisibles.reduce((acc, t) => {
    const f = fechaDeTurno(t);
    (acc[f] ||= []).push(t);
    return acc;
  }, {});

  const crearTurno = async () => {
    if (!form.usuario_id || !form.instalacion_id || !form.fecha) {
      setMsg("Completa todos los campos obligatorios.");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      await api.post("/turnos", form);
      setMsg("Turno creado exitosamente");
      setMostrarForm(false);
      cargarTurnos();
      setForm({
        usuario_id: "",
        instalacion_id: instalaciones.length === 1 ? instalaciones[0].id : "",
        fecha: hoyLocal(),
        hora_inicio: "06:00",
        hora_fin: "14:00",
      });
    } catch (e) {
      setMsg(e.message || "Error al crear turno");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.bgCard, color: T.text, fontSize: 13, marginBottom: 10, boxSizing: "border-box",
    outline: "none", fontFamily: "'Outfit', sans-serif",
  };

  return (
    <div className="operations-screen">
      <SectionHeader
        title="Guardias"
        sub="Personal asignado a tus instalaciones"
        action={{
          label: mostrarForm ? "Cerrar Formulario" : "+ Crear Turno",
          onClick: () => {
            setMostrarForm((v) => !v);
            setMsg("");
          },
        }}
      />

      {mostrarForm && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: T.text }}>
            Nuevo Turno
          </div>

          <div style={etiquetaStyle}>GUARDIA *</div>
          <select
            className="touch-target"
            style={inputStyle}
            value={form.usuario_id}
            onChange={(e) => setForm((f) => ({ ...f, usuario_id: e.target.value }))}
          >
            <option value="">Seleccionar guardia...</option>
            {guardias.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre} ({g.rol === ROLES.GGSS_EN_PAUTA ? "Pauta" : "Libre"})
              </option>
            ))}
          </select>

          <div style={etiquetaStyle}>INSTALACIÓN *</div>
          <select
            className="touch-target"
            style={inputStyle}
            value={form.instalacion_id}
            onChange={(e) => setForm((f) => ({ ...f, instalacion_id: e.target.value }))}
          >
            <option value="">Seleccionar instalación...</option>
            {instalaciones.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} {i.comuna ? `(${i.comuna})` : ""}
              </option>
            ))}
          </select>

          <div style={etiquetaStyle}>FECHA DE INICIO *</div>
          <input
            className="touch-target"
            type="date"
            style={inputStyle}
            value={form.fecha}
            onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
          />

          <div className="form-grid-2" style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={etiquetaStyle}>HORA INICIO</div>
              <input
                className="touch-target"
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
                type="time"
                style={inputStyle}
                value={form.hora_fin}
                onChange={(e) => setForm((f) => ({ ...f, hora_fin: e.target.value }))}
              />
            </div>
          </div>

          <AvisoNocturno form={form} />

          {msg && (
            <div style={{
              fontSize: 12,
              padding: "8px 12px",
              borderRadius: 8,
              background: msg.includes("exitosamente") ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: msg.includes("exitosamente") ? T.accent : T.red,
              border: `1px solid ${msg.includes("exitosamente") ? T.accent : T.red}`,
              marginBottom: 12,
            }}>
              {msg}
            </div>
          )}

          <Btn onClick={crearTurno} disabled={loading} full>
            {loading ? "Creando..." : "Confirmar Turno"}
          </Btn>
        </div>
      )}

      {/* ── Próximos turnos ── */}
      <div className="filter-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, margin: "4px 0 10px" }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>Próximos turnos</div>
        <select
          className="touch-target filter-control"
          value={filtroGuardia}
          onChange={(e) => setFiltroGuardia(e.target.value)}
          style={{ ...inputStyle, width: "auto", maxWidth: 220, marginBottom: 0, padding: "6px 10px", fontSize: 12 }}
        >
          <option value="">Todos los guardias</option>
          {guardias.map((g) => (
            <option key={g.id} value={g.id}>{g.nombre}</option>
          ))}
        </select>
      </div>

      {aviso && (
        <div style={{
          fontSize: 12, padding: "8px 12px", borderRadius: 8, marginBottom: 10,
          background: T.accentGhost, color: T.accent, border: `1px solid ${T.accent}`, fontWeight: 600,
        }}>
          {aviso}
        </div>
      )}

      {cargandoTurnos ? (
        <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 16 }}>Cargando turnos...</div>
      ) : turnosVisibles.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 16 }}>
          No hay turnos programados desde hoy.
        </div>
      ) : (
        Object.entries(turnosPorFecha).map(([fecha, lista]) => (
          <div key={fecha} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              {formatearFecha(fecha)}
            </div>
            {lista.map((t) => (
              <div
                className="responsive-list-row"
                key={t.id}
                style={{
                  background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
                  padding: 12, marginBottom: 6, display: "flex", alignItems: "center", gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>
                    {t.hora_inicio} – {t.hora_fin}
                    {esNocturno(t) && <span style={{ color: "#c4a8ff", fontSize: 11 }}> (+1) 🌙</span>}
                    {" · "}{t.usuario?.nombre || "Sin guardia"}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMut, marginTop: 2 }}>
                    🏢 {t.instalacion?.nombre || "—"}
                  </div>
                </div>
                <Badge color={ESTADO_COLOR[t.estado] || "accent"}>{t.estado}</Badge>
                {t.estado === "programado" && (
                  <button
                    className="touch-target"
                    onClick={() => setTurnoEditando(t)}
                    style={{
                      background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)",
                      color: "#38BDF8", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700,
                      fontFamily: "'Outfit', sans-serif", cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    ✏️ Editar
                  </button>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      <div style={{ fontWeight: 800, fontSize: 14, color: T.text, margin: "18px 0 10px" }}>Personal</div>

      {cargandoDatos ? (
        <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 20 }}>
          Cargando personal e instalaciones...
        </div>
      ) : guardias.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 20 }}>
          No hay guardias registrados.
        </div>
      ) : (
        guardias.map((g, i) => (
          <div
            className="responsive-list-row"
            key={g.id || i}
            style={{
              background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
              padding: 12, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
          >
            <div className="responsive-list-row__main">
              <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{g.nombre}</div>
              <div style={{ fontSize: 11, color: T.textMut }}>
                GGSS {g.rol === ROLES.GGSS_EN_PAUTA ? "Pauta" : "Libre"} {g.rut ? `· ${g.rut}` : ""}
              </div>
            </div>
            <Badge color={g.estado === "activo" ? "accent" : "red"}>{g.estado}</Badge>
          </div>
        ))
      )}

      {turnoEditando && (
        <ModalEditarTurno
          turno={turnoEditando}
          turnos={turnos}
          guardias={guardias}
          instalaciones={instalaciones}
          inputStyle={inputStyle}
          onClose={() => setTurnoEditando(null)}
          onGuardado={onTurnoGuardado}
        />
      )}
    </div>
  );
}
