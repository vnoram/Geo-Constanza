import { Icon } from "../../components/ui/Icon";
import { useEffect, useState } from "react";
import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Input } from "../../components/ui/Input";
import { CalendarioRango, sumarDias } from "../../components/ui/CalendarioRango";
import { SubHeader } from "../../components/ui/SubHeader";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";
import { ROLES } from "../../constants/roles";
import { ahoraChile, sumarDias as sumarDiasChile } from "../../utils/fechaChile";
import { SemanaTurnos, lunesDe } from "../supervisor/SemanaTurnos";
import { ModalEditarTurno } from "../supervisor/SupGuardias";

// ─── SELECTOR GENÉRICO ───────────────────────────────────────────
function Select({ label, value, onChange, options, placeholder }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && (
        <label style={{
          display: "block", fontSize: 11, fontWeight: 700, color: T.textSec,
          marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase",
        }}>
          {label}
        </label>
      )}
      <select
        className="touch-target"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", background: T.bgInput, border: `1.5px solid ${T.border}`,
          borderRadius: 8, padding: "12px 14px", color: value ? T.text : T.textMut,
          fontSize: 14, fontFamily: "var(--font-ui)", outline: "none",
          cursor: "pointer",
        }}
      >
        <option value="" disabled>{placeholder || "Seleccionar..."}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: T.bgCard }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── MODAL PAUTA 4x4 ─────────────────────────────────────────────
function ModalPauta4x4({ onClose, onSuccess, guardias, instalaciones }) {
  const [form, setForm] = useState({
    usuario_id: "",
    instalacion_id: "",
    fecha_inicio: "",
    hora_inicio: "19:00",
    hora_fin: "07:00",
    reemplazar: false,
  });
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const setCheck = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));

  // Detectar turno nocturno para mostrar aviso informativo
  const esNocturno = form.hora_fin < form.hora_inicio;

  const validar = () => {
    if (!form.usuario_id) return "Selecciona un guardia.";
    if (!form.instalacion_id) return "Selecciona una instalación.";
    if (!form.fecha_inicio) return "Indica la fecha de inicio.";
    if (!form.hora_inicio || !form.hora_fin) return "Completa los horarios.";
    if (form.hora_inicio === form.hora_fin) return "Hora de entrada y salida no pueden ser iguales.";
    return null;
  };

  const handleConfirmar = async () => {
    const err = validar();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/turnos/pauta-4x4", {
        usuario_id:    form.usuario_id,
        instalacion_id: form.instalacion_id,
        fecha_inicio:  form.fecha_inicio,
        hora_inicio:   form.hora_inicio,
        hora_fin:      form.hora_fin,
        reemplazar:    form.reemplazar,
      });
      setResultado(res);
      onSuccess();
    } catch (e) {
      setError(e.message || "Error al generar la pauta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-modal-overlay" style={{
      position: "fixed", inset: 0, background: "rgba(14,23,20,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}>
      <div className="admin-modal" style={{
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div className="admin-list-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div className="admin-list-row__main">
            <div style={{ fontWeight: 800, fontSize: 17, color: T.text }}>Generar Pauta 4×4</div>
            <div style={{ fontSize: 12, color: T.textMut, marginTop: 2 }}>
              32 días · 4 trabajo / 4 descanso
            </div>
          </div>
          <button className="touch-target" aria-label="Cerrar" onClick={onClose} style={{
            background: "none", border: "none", color: T.textMut, fontSize: 20,
            cursor: "pointer", lineHeight: 1,
          }}><Icon name="x" size={16} /></button>
        </div>

        {/* Resultado de éxito */}
        {resultado ? (
          <div>
            <div style={{
              background: resultado.creados > 0 ? T.accentGhost : T.redGhost,
              border: `1px solid ${resultado.creados > 0 ? T.accent : T.red}`,
              borderRadius: 8, padding: 16, marginBottom: 20,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: resultado.creados > 0 ? T.accent : T.red, marginBottom: 8 }}>
                {resultado.creados > 0 ? <><Icon name="check" size={16} />{" Pauta generada correctamente"}</> : <><Icon name="triangle-alert" size={16} />{" Sin turnos creados"}</>}
                {resultado.esNocturno && <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}><Icon name="moon" size={16} /> nocturno</span>}
              </div>
              <div style={{ fontSize: 13, color: T.text }}>
                <span style={{ fontWeight: 700 }}>{resultado.creados}</span> turnos creados
                {resultado.omitidos > 0 && (
                  <span style={{ color: T.yellow }}> · {resultado.omitidos} omitidos por conflicto</span>
                )}
              </div>
              {resultado.advertencia && (
                <div style={{ fontSize: 12, color: T.yellow, marginTop: 8 }}>{resultado.advertencia}</div>
              )}
            </div>

            {resultado.detalles_omitidos?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <SubHeader title="Días omitidos" />
                {resultado.detalles_omitidos.map((d, i) => (
                  <div key={i} style={{
                    background: T.bgInput, borderRadius: 8, padding: "8px 12px",
                    marginBottom: 6, fontSize: 12, color: T.textSec,
                    display: "flex", justifyContent: "space-between",
                  }}>
                    <span>{d.fecha}</span>
                    <span style={{ color: T.yellow }}>{d.motivo}</span>
                  </div>
                ))}
              </div>
            )}

            <Btn full onClick={onClose}>Cerrar</Btn>
          </div>
        ) : (
          <>
            <Select
              label="Guardia (GGSS)"
              value={form.usuario_id}
              onChange={set("usuario_id")}
              placeholder="Seleccionar guardia..."
              options={guardias.map((g) => ({
                value: g.id,
                label: `${g.nombre} · ${g.rut}`,
              }))}
            />

            <Select
              label="Instalación"
              value={form.instalacion_id}
              onChange={set("instalacion_id")}
              placeholder="Seleccionar instalación..."
              options={instalaciones.map((i) => ({
                value: i.id,
                label: i.nombre,
              }))}
            />

            <div style={{ fontSize: 12, fontWeight: 500, color: T.textSec, marginBottom: 6 }}>Primer día de la pauta</div>
            <div style={{ fontSize: 11, color: T.textMut, marginBottom: 8 }}>
              Elige el primer día: se marcan solos los 16 turnos del ciclo (4 días de trabajo, 4 de descanso).
            </div>
            <div style={{ marginBottom: 14 }}>
              <CalendarioRango
                marcados={form.fecha_inicio ? Array.from({ length: 32 }, (_, i) => i % 8 < 4 ? sumarDias(form.fecha_inicio, i) : null).filter(Boolean) : []}
                destacados={form.fecha_inicio ? [form.fecha_inicio] : []}
                onElegir={(iso) => set("fecha_inicio")(iso)}
              />
            </div>

            <div className="admin-form-grid" style={{ display: "grid", gap: 12 }}>
              <Input
                label="Hora Entrada"
                type="time"
                value={form.hora_inicio}
                onChange={set("hora_inicio")}
              />
              <Input
                label="Hora Salida"
                type="time"
                value={form.hora_fin}
                onChange={set("hora_fin")}
              />
            </div>

            {/* Aviso turno nocturno */}
            {esNocturno && (
              <div style={{
                background: T.bgCard, border: "1px solid #7A4EBF",
                borderRadius: 8, padding: "8px 12px", marginBottom: 14,
                fontSize: 12, color: T.focusText, display: "flex", gap: 8, alignItems: "center",
              }}>
                <span><Icon name="moon" size={16} /></span>
                <span>Turno nocturno detectado — la salida ({form.hora_fin}) ocurre al día siguiente.</span>
              </div>
            )}

            {/* Checkbox reemplazar */}
            <label style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 18,
              cursor: "pointer", userSelect: "none",
            }}>
              <input
                type="checkbox"
                checked={form.reemplazar}
                onChange={setCheck("reemplazar")}
                style={{ width: 16, height: 16, accentColor: T.accent, cursor: "pointer" }}
              />
              <div>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>
                  Reemplazar pautas existentes en este rango
                </div>
                <div style={{ fontSize: 11, color: T.textMut }}>
                  Elimina los turnos previos del guardia en los 32 días antes de crear los nuevos.
                </div>
              </div>
            </label>

            {error && (
              <div style={{
                background: T.redGhost, border: `1px solid ${T.red}`,
                borderRadius: 8, padding: "10px 14px", marginBottom: 14,
                fontSize: 13, color: T.red,
              }}>
                {error}
              </div>
            )}

            <div className="admin-actions" style={{ display: "flex", gap: 10 }}>
              <Btn variant="outline" onClick={onClose} disabled={loading}>Cancelar</Btn>
              <Btn full onClick={handleConfirmar} loading={loading}>Confirmar Pauta</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AdminTurnos() {
  const [turnos, setTurnos] = useState([]);
  const [guardias, setGuardias] = useState([]);
  const [instalaciones, setInstalaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [lunes, setLunes] = useState(() => lunesDe(ahoraChile().fecha));
  const [filtroInstalacion, setFiltroInstalacion] = useState("");
  const [filtroGuardia, setFiltroGuardia] = useState("");
  const [turnoEditando, setTurnoEditando] = useState(null);
  const [aviso, setAviso] = useState("");

  const cargarTurnos = async () => {
    setCargando(true);
    try {
      const data = await api.get(`/turnos?desde=${lunes}&hasta=${sumarDiasChile(lunes, 6)}`);
      setTurnos(Array.isArray(data) ? data : (data.data ?? []));
    } catch (e) {
      console.error("Error cargando turnos:", e);
    } finally {
      setCargando(false);
    }
  };

  const cargarRecursos = async () => {
    try {
      const [listaUsuarios, listaInstalaciones] = await Promise.all([
        api.get("/usuarios?limit=200"),
        api.get("/instalaciones"),
      ]);
      const usuarios = Array.isArray(listaUsuarios) ? listaUsuarios : (listaUsuarios.data ?? []);
      setGuardias(usuarios.filter((u) => [ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE].includes(u.rol)));
      setInstalaciones(Array.isArray(listaInstalaciones) ? listaInstalaciones : (listaInstalaciones.data ?? []));
    } catch (e) {
      console.error("Error cargando recursos:", e);
    }
  };

  useEffect(() => { cargarRecursos(); }, []);
  useEffect(() => { cargarTurnos(); }, [lunes]);

  const onTurnoGuardado = () => {
    setTurnoEditando(null);
    setAviso("Turno actualizado correctamente");
    setTimeout(() => setAviso(""), 4000);
    cargarTurnos();
  };

  const { fecha: hoy } = ahoraChile();
  const visibles = turnos
    .filter((t) => t.estado !== "cancelado")
    .filter((t) => !filtroInstalacion || t.instalacion_id === filtroInstalacion)
    .filter((t) => !filtroGuardia || t.usuario_id === filtroGuardia);

  const selStyle = {
    background: T.bgCard, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8,
    padding: "8px 10px", fontSize: 12, fontFamily: "var(--font-ui)", minWidth: 160, maxWidth: 240,
  };
  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.bgCard, color: T.text, fontSize: 13, marginBottom: 10, boxSizing: "border-box",
    outline: "none", fontFamily: "var(--font-ui)",
  };

  return (
    <div className="admin-screen">
      <SectionHeader
        title="Turnos"
        sub="Programación semanal de todas las instalaciones"
        action={{ label: <><Icon name="zap" size={16} />{" Generar Pauta 4×4"}</>, onClick: () => setModalAbierto(true) }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "4px 0 12px" }}>
        <select value={filtroInstalacion} onChange={(e) => setFiltroInstalacion(e.target.value)} style={selStyle}>
          <option value="">Todas las instalaciones</option>
          {instalaciones.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
        <select value={filtroGuardia} onChange={(e) => setFiltroGuardia(e.target.value)} style={selStyle}>
          <option value="">Todos los guardias</option>
          {guardias.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
        </select>
        <div style={{ fontSize: 12, color: T.textMut, marginLeft: "auto" }}>
          {visibles.length} turno{visibles.length === 1 ? "" : "s"} esta semana
        </div>
      </div>

      {aviso && (
        <div style={{ background: T.bgCard, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
          <Icon name="circle-check" size={16} />{" "}{aviso}
        </div>
      )}

      {cargando && turnos.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 30 }}>Cargando turnos...</div>
      ) : (
        <SemanaTurnos
          lunes={lunes}
          hoy={hoy}
          turnos={visibles}
          onCambiarSemana={setLunes}
          onEditar={setTurnoEditando}
        />
      )}

      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: "12px 16px", marginTop: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <Icon name="download" size={22} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Importar turnos</div>
          <div style={{ fontSize: 11, color: T.textMut }}>CSV o Excel con los turnos programados (próximamente)</div>
        </div>
        <Btn variant="outline" disabled>Seleccionar archivo</Btn>
      </div>

      {modalAbierto && (
        <ModalPauta4x4
          onClose={() => setModalAbierto(false)}
          onSuccess={cargarTurnos}
          guardias={guardias}
          instalaciones={instalaciones}
        />
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
