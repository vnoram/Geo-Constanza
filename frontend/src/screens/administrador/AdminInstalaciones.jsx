import { useState, useEffect, useRef } from "react";
import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { SubHeader } from "../../components/ui/SubHeader";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";
import { direccionDesdeCoordenadas } from "../../services/geocoding";
import { MapaUbicacion } from "../../components/maps/MapaUbicacion";
import { DireccionAutocomplete } from "../../components/maps/DireccionAutocomplete";

// ─── HELPERS ─────────────────────────────────────────────────────
const CRITICIDAD_COLOR = { Alta: "red", Media: "yellow", Baja: "accent" };

const TIPOS_RECINTO = [
  "Comercial",
  "Corporativo",
  "Residencial",
  "Industrial",
  "Educacional",
  "Salud",
  "Gubernamental",
  "Otro",
];
const NIVELES_CRITICIDAD = ["Alta", "Media", "Baja"];
const ESTADOS = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

const FORM_INICIAL = {
  nombre: "",
  direccion: "",
  comuna: "",
  latitud: "",
  longitud: "",
  radio_geofence_m: "100",
  tipo_recinto: "Corporativo",
  nivel_criticidad: "Media",
  estado: "activo",
  supervisorIds: [],
};

// Layout responsivo del modal: formulario | mapa (apilado en pantallas angostas)
const ESTILOS_MODAL = `
  .gc-inst-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 28px;
    align-items: start;
  }
  .gc-inst-mapa { position: sticky; top: 0; }
  @media (max-width: 900px) {
    .gc-inst-grid { grid-template-columns: minmax(0, 1fr); gap: 8px; }
    .gc-inst-mapa { position: static; }
    .gc-inst-mapa-box { height: 320px !important; }
    .gc-inst-modal { padding: 18px !important; }
  }
  @media (max-width: 520px) {
    .gc-inst-2col { grid-template-columns: minmax(0, 1fr) !important; gap: 0 !important; }
  }
`;

// ─── SELECTOR GENÉRICO ───────────────────────────────────────────
function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 700,
            color: T.textSec,
            marginBottom: 6,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          background: T.bgInput,
          border: `1.5px solid ${T.border}`,
          borderRadius: 12,
          padding: "12px 14px",
          color: value ? T.text : T.textMut,
          fontSize: 14,
          fontFamily: "'Outfit', sans-serif",
          outline: "none",
          cursor: "pointer",
        }}
      >
        <option value="">Seleccionar...</option>
        {options.map((o) => {
          const val = typeof o === "object" ? o.value : o;
          const lbl = typeof o === "object" ? o.label : o;
          return (
            <option key={val} value={val} style={{ background: T.bgCard }}>
              {lbl}
            </option>
          );
        })}
      </select>
    </div>
  );
}

// ─── MODAL CREAR / EDITAR INSTALACIÓN ────────────────────────────
function ModalInstalacion({ inicial, onClose, onGuardada }) {
  const esEdicion = !!inicial?.id;

  const [form, setForm] = useState(() => {
    if (inicial) {
      // Extraer IDs de supervisores asignados
      let supIds = [];
      if (Array.isArray(inicial.supervisores)) {
        supIds = inicial.supervisores.map((s) => s.supervisor_id || s.id);
      } else if (Array.isArray(inicial.supervisorIds)) {
        supIds = inicial.supervisorIds;
      }

      return {
        nombre: inicial.nombre || "",
        direccion: inicial.direccion || "",
        comuna: inicial.comuna || "",
        latitud: inicial.latitud !== undefined && inicial.latitud !== null ? String(inicial.latitud) : "",
        longitud: inicial.longitud !== undefined && inicial.longitud !== null ? String(inicial.longitud) : "",
        radio_geofence_m: inicial.radio_geofence_m !== undefined && inicial.radio_geofence_m !== null ? String(inicial.radio_geofence_m) : "100",
        tipo_recinto: inicial.tipo_recinto || "Corporativo",
        nivel_criticidad: inicial.nivel_criticidad || "Media",
        estado: inicial.estado || "activo",
        supervisorIds: supIds,
      };
    }
    return FORM_INICIAL;
  });

  const [loading, setLoading] = useState(false);
  const [errores, setErrores] = useState({});
  const [supervisores, setSupervisores] = useState([]);
  const [cargandoSup, setCargandoSup] = useState(true);

  const set = (campo) => (val) => setForm((f) => ({ ...f, [campo]: val }));

  // ── Sincronización dirección ⇄ mapa ──
  const [sugerenciaPin, setSugerenciaPin] = useState(null); // dirección detectada al mover el pin
  const direccionRef = useRef(form.direccion);
  const reverseCtrlRef = useRef(null);

  useEffect(() => {
    direccionRef.current = form.direccion;
  }, [form.direccion]);

  useEffect(() => () => reverseCtrlRef.current?.abort(), []);

  const limpiarErroresCoords = () =>
    setErrores((e) => ({ ...e, latitud: undefined, longitud: undefined }));

  // Autocompletado → mueve el pin a la dirección elegida
  const seleccionarDireccion = (s) => {
    reverseCtrlRef.current?.abort();
    setSugerenciaPin(null);
    limpiarErroresCoords();
    setForm((f) => ({
      ...f,
      direccion: s.direccion || f.direccion,
      comuna: s.comuna || f.comuna,
      latitud: String(+s.latitud.toFixed(6)),
      longitud: String(+s.longitud.toFixed(6)),
    }));
  };

  // Pin arrastrado / click en el mapa → actualiza lat/lng y busca la dirección del punto
  const moverPin = async (lat, lng) => {
    limpiarErroresCoords();
    setForm((f) => ({ ...f, latitud: String(lat), longitud: String(lng) }));

    reverseCtrlRef.current?.abort();
    const ctrl = new AbortController();
    reverseCtrlRef.current = ctrl;
    try {
      const r = await direccionDesdeCoordenadas(lat, lng, { signal: ctrl.signal });
      if (!r || !r.direccion || ctrl.signal.aborted) return;
      if (!direccionRef.current.trim()) {
        // Sin dirección escrita todavía: completarla automáticamente
        setForm((f) => ({ ...f, direccion: r.direccion, comuna: f.comuna || r.comuna }));
        setSugerenciaPin(null);
      } else {
        // Ya hay una dirección: ofrecerla sin sobrescribir lo que escribió el usuario
        setSugerenciaPin(r);
      }
    } catch {
      /* geocoding inverso es opcional */
    }
  };

  const usarSugerenciaPin = () => {
    setForm((f) => ({
      ...f,
      direccion: sugerenciaPin.direccion,
      comuna: sugerenciaPin.comuna || f.comuna,
    }));
    setSugerenciaPin(null);
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get("/usuarios?rol=supervisor&limit=200");
        setSupervisores(Array.isArray(data) ? data : (data.data ?? []));
      } catch {
        /* no bloquea la creación/edición */
      } finally {
        setCargandoSup(false);
      }
    })();
  }, []);

  const toggleSupervisor = (id) => {
    setForm((f) => {
      const ya = f.supervisorIds.includes(id);
      return {
        ...f,
        supervisorIds: ya ? f.supervisorIds.filter((s) => s !== id) : [...f.supervisorIds, id],
      };
    });
  };

  // Validación local estricta
  const validar = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio";
    
    // Coordenadas
    if (!form.latitud || form.latitud.trim() === "") {
      e.latitud = "Busca la dirección o marca el punto en el mapa";
    } else if (isNaN(parseFloat(form.latitud))) {
      e.latitud = "Debe ser un número válido";
    } else {
      const lat = parseFloat(form.latitud);
      if (lat < -90 || lat > 90) e.latitud = "Rango válido: -90 a 90";
    }

    if (!form.longitud || form.longitud.trim() === "") {
      e.longitud = "Busca la dirección o marca el punto en el mapa";
    } else if (isNaN(parseFloat(form.longitud))) {
      e.longitud = "Debe ser un número válido";
    } else {
      const lon = parseFloat(form.longitud);
      if (lon < -180 || lon > 180) e.longitud = "Rango válido: -180 a 180";
    }

    const radio = parseInt(form.radio_geofence_m, 10);
    if (isNaN(radio) || radio < 10) e.radio_geofence_m = "Mínimo 10 metros";

    return e;
  };

  const handleSubmit = async () => {
    const e = validar();
    if (Object.keys(e).length > 0) {
      setErrores(e);
      return;
    }
    setErrores({});
    setLoading(true);

    const payload = {
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim() || undefined,
      comuna: form.comuna.trim() || undefined,
      latitud: parseFloat(form.latitud),
      longitud: parseFloat(form.longitud),
      radio_geofence_m: parseInt(form.radio_geofence_m, 10),
      tipo_recinto: form.tipo_recinto || undefined,
      nivel_criticidad: form.nivel_criticidad || "Media",
      estado: form.estado || "activo",
      supervisorIds: form.supervisorIds,
    };

    try {
      let resultado;
      if (esEdicion) {
        resultado = await api.put(`/instalaciones/${inicial.id}`, payload);
      } else {
        resultado = await api.post("/instalaciones", payload);
      }
      onGuardada(resultado, esEdicion);
    } catch (err) {
      setErrores({ _global: err.message || "Error al guardar instalación" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(6,13,24,0.88)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <style>{ESTILOS_MODAL}</style>
      <div
        className="gc-inst-modal"
        style={{
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 18,
          padding: 28,
          width: "100%",
          maxWidth: 1180,
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: T.text }}>
              {esEdicion ? "Editar Instalación" : "Nueva Instalación"}
            </div>
            <div style={{ fontSize: 12, color: T.textMut, marginTop: 2 }}>
              {esEdicion ? "Modificar parámetros y geocerca del punto de seguridad" : "Registrar nuevo punto de seguridad"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: T.textMut,
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Error global */}
        {errores._global && (
          <div
            style={{
              background: T.redGhost,
              border: `1px solid ${T.red}`,
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 13,
              color: T.red,
            }}
          >
            {errores._global}
          </div>
        )}

        <div className="gc-inst-grid">
          {/* ── Columna izquierda: formulario ── */}
          <div>
            <Input
              label="Nombre de la Instalación *"
              value={form.nombre}
              onChange={set("nombre")}
              placeholder="Ej: Centro Comercial Arauco"
              error={errores.nombre}
              icon="🏢"
            />

            <div className="gc-inst-2col" style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: 12 }}>
              <DireccionAutocomplete
                label="Dirección"
                value={form.direccion}
                onChange={set("direccion")}
                comuna={form.comuna}
                onSeleccion={seleccionarDireccion}
                placeholder="Escribe calle y número…"
              />
              <Input
                label="Comuna"
                value={form.comuna}
                onChange={set("comuna")}
                placeholder="Ej: Santiago"
                icon="🗺️"
              />
            </div>

            <div className="gc-inst-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input
                label="Latitud *"
                type="number"
                value={form.latitud}
                onChange={set("latitud")}
                placeholder="Se completa desde el mapa"
                error={errores.latitud}
              />
              <Input
                label="Longitud *"
                type="number"
                value={form.longitud}
                onChange={set("longitud")}
                placeholder="Se completa desde el mapa"
                error={errores.longitud}
              />
            </div>

            <div className="gc-inst-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input
                label="Radio Geocerca (m) *"
                type="number"
                value={form.radio_geofence_m}
                onChange={set("radio_geofence_m")}
                placeholder="100"
                error={errores.radio_geofence_m}
                icon="📡"
              />
              <Select
                label="Estado"
                value={form.estado}
                onChange={set("estado")}
                options={ESTADOS}
              />
            </div>

            <div className="gc-inst-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select
                label="Tipo de Recinto"
                value={form.tipo_recinto}
                onChange={set("tipo_recinto")}
                options={TIPOS_RECINTO}
              />
              <Select
                label="Nivel de Criticidad"
                value={form.nivel_criticidad}
                onChange={set("nivel_criticidad")}
                options={NIVELES_CRITICIDAD}
              />
            </div>

            {/* Selector de supervisores asignados */}
            <div style={{ marginBottom: 22 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.textSec,
                  marginBottom: 6,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                Supervisores con acceso
              </label>
              <div style={{ fontSize: 11, color: T.textMut, marginBottom: 8 }}>
                Los supervisores marcados verán esta instalación en sus dashboards y turnos.
              </div>
              {cargandoSup ? (
                <div style={{ fontSize: 12, color: T.textMut }}>Cargando supervisores...</div>
              ) : supervisores.length === 0 ? (
                <div style={{ fontSize: 12, color: T.textMut }}>No hay supervisores registrados todavía.</div>
              ) : (
                <div
                  style={{
                    border: `1.5px solid ${T.border}`,
                    borderRadius: 12,
                    padding: "8px 12px",
                    maxHeight: 140,
                    overflowY: "auto",
                    background: T.bgInput,
                  }}
                >
                  {supervisores.map((s) => (
                    <label
                      key={s.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 0",
                        fontSize: 13,
                        color: T.text,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.supervisorIds.includes(s.id)}
                        onChange={() => toggleSupervisor(s.id)}
                        style={{ accentColor: T.accent, cursor: "pointer" }}
                      />
                      {s.nombre} {s.email ? `(${s.email})` : ""}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Columna derecha: mapa ── */}
          <div className="gc-inst-mapa">
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: T.textSec,
                marginBottom: 6,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              Ubicación en el mapa
            </label>
            <MapaUbicacion
              className="gc-inst-mapa-box"
              latitud={form.latitud}
              longitud={form.longitud}
              radio={form.radio_geofence_m}
              onCambio={moverPin}
              alto={460}
            />

            {/* Dirección detectada al mover el pin */}
            {sugerenciaPin && (
              <div
                style={{
                  marginTop: 10,
                  background: T.bgInput,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 12,
                  color: T.textSec,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  Dirección en este punto:{" "}
                  <b style={{ color: T.text }}>
                    {sugerenciaPin.direccion}
                    {sugerenciaPin.comuna ? `, ${sugerenciaPin.comuna}` : ""}
                  </b>
                </span>
                <button
                  type="button"
                  onClick={usarSugerenciaPin}
                  style={{
                    background: T.accentGhost,
                    border: `1px solid ${T.accent}`,
                    color: T.accent,
                    borderRadius: 8,
                    padding: "5px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "'Outfit', sans-serif",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Usar
                </button>
                <button
                  type="button"
                  onClick={() => setSugerenciaPin(null)}
                  style={{ background: "none", border: "none", color: T.textMut, cursor: "pointer", fontSize: 14 }}
                >
                  ✕
                </button>
              </div>
            )}

            <div style={{ height: 12 }} />

            {/* Info visual geocerca */}
            <div
              style={{
                background: T.bgInput,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: `2px dashed ${T.accent}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                📡
              </div>
              <div style={{ fontSize: 11, color: T.textMut }}>
                Geocerca de <span style={{ color: T.accent, fontWeight: 700 }}>{form.radio_geofence_m || 100}m</span> de tolerancia para marcajes de asistencia y reporte de novedades.
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Btn>
          <Btn full onClick={handleSubmit} loading={loading}>
            {esEdicion ? "Guardar Cambios" : "Crear Instalación"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── CARD DE INSTALACIÓN ─────────────────────────────────────────
function InstCard({ inst, onEditar }) {
  const color = CRITICIDAD_COLOR[inst.nivel_criticidad] || "accent";
  const esActivo = inst.estado === "activa" || inst.estado === "activo";

  return (
    <div
      style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: "16px 18px",
        marginBottom: 10,
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        transition: "border-color 0.2s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
        <div style={{ flex: 1, marginRight: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: T.text }}>{inst.nombre}</span>
            <Badge color={color}>{inst.nivel_criticidad || "Media"}</Badge>
          </div>
          {inst.direccion && (
            <div style={{ fontSize: 12, color: T.textMut, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <span>📍 {inst.direccion}</span>
              {inst.comuna && <span style={{ color: T.textSec }}>({inst.comuna})</span>}
            </div>
          )}
        </div>

        {/* Botón Editar */}
        <button
          onClick={() => onEditar(inst)}
          style={{
            background: "rgba(56, 189, 248, 0.1)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            color: "#38BDF8",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "'Outfit', sans-serif",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(56, 189, 248, 0.2)";
            e.currentTarget.style.borderColor = "#38BDF8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(56, 189, 248, 0.1)";
            e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.3)";
          }}
        >
          <span>✏️</span> Editar
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, fontSize: 11, color: T.textSec }}>
        {inst.tipo_recinto && (
          <span style={{ background: T.bgInput, borderRadius: 6, padding: "3px 8px" }}>
            🏢 {inst.tipo_recinto}
          </span>
        )}
        <span style={{ background: T.bgInput, borderRadius: 6, padding: "3px 8px" }}>
          📡 Geocerca: {inst.radio_geofence_m ?? 100}m
        </span>
        {inst.latitud !== undefined && inst.longitud !== undefined && (
          <span style={{ background: T.bgInput, borderRadius: 6, padding: "3px 8px", fontFamily: "monospace", fontSize: 10 }}>
            🌐 {parseFloat(inst.latitud).toFixed(4)}, {parseFloat(inst.longitud).toFixed(4)}
          </span>
        )}
        <span
          style={{
            background: esActivo ? T.accentGhost : T.redGhost,
            color: esActivo ? T.accent : T.red,
            borderRadius: 6,
            padding: "3px 8px",
            fontWeight: 700,
          }}
        >
          {esActivo ? "● Activo" : "○ Inactivo"}
        </span>
      </div>
    </div>
  );
}

// ─── PANTALLA PRINCIPAL ──────────────────────────────────────────
export function AdminInstalaciones() {
  const [instalaciones, setInstalaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalData, setModalData] = useState(null); // null | { inicial: null | objeto }
  const [confirmacion, setConfirmacion] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await api.get("/instalaciones");
      setInstalaciones(Array.isArray(data) ? data : (data.data ?? []));
    } catch (err) {
      console.error("Error al cargar instalaciones:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const handleGuardada = (instalacionGuardada, esEdicion) => {
    setModalData(null);
    if (esEdicion) {
      setInstalaciones((prev) =>
        prev.map((i) => (i.id === instalacionGuardada.id ? { ...i, ...instalacionGuardada } : i))
      );
      setConfirmacion(`✅ Instalación "${instalacionGuardada.nombre}" actualizada correctamente`);
    } else {
      setInstalaciones((prev) => [instalacionGuardada, ...prev]);
      setConfirmacion(`✅ Instalación "${instalacionGuardada.nombre}" creada correctamente`);
    }
    setTimeout(() => setConfirmacion(""), 4000);
  };

  const listaFiltrada = instalaciones.filter(
    (i) =>
      i.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      i.direccion?.toLowerCase().includes(busqueda.toLowerCase()) ||
      i.comuna?.toLowerCase().includes(busqueda.toLowerCase()) ||
      i.tipo_recinto?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <SectionHeader
        title="Instalaciones"
        sub={`${instalaciones.length} recinto${instalaciones.length !== 1 ? "s" : ""} registrado${instalaciones.length !== 1 ? "s" : ""}`}
        action={{
          label: "+ Nueva Instalación",
          onClick: () => setModalData({ inicial: null }),
        }}
      />

      {/* Confirmación */}
      {confirmacion && (
        <div
          style={{
            background: T.accentGhost,
            border: `1px solid ${T.accent}`,
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 14,
            fontSize: 13,
            color: T.accent,
            fontWeight: 600,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          {confirmacion}
        </div>
      )}

      {/* Buscador */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, dirección, comuna o tipo..."
          style={{
            width: "100%",
            background: T.bgInput,
            border: `1.5px solid ${T.border}`,
            borderRadius: 12,
            padding: "11px 14px",
            color: T.text,
            fontSize: 13,
            fontFamily: "'Outfit', sans-serif",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Lista */}
      {cargando ? (
        <div style={{ textAlign: "center", padding: 40, fontSize: 13, color: T.textMut }}>
          Cargando instalaciones...
        </div>
      ) : listaFiltrada.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏢</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>
            {busqueda ? "Sin resultados" : "Sin instalaciones registradas"}
          </div>
          <div style={{ fontSize: 12, color: T.textMut, marginBottom: 18 }}>
            {busqueda ? "Intenta con otro término de búsqueda" : "Crea la primera instalación del sistema"}
          </div>
          {!busqueda && (
            <Btn onClick={() => setModalData({ inicial: null })}>+ Nueva Instalación</Btn>
          )}
        </div>
      ) : (
        <>
          <SubHeader title={`Mostrando ${listaFiltrada.length} de ${instalaciones.length}`} />
          {listaFiltrada.map((inst) => (
            <InstCard
              key={inst.id}
              inst={inst}
              onEditar={(instalacionSeleccionada) => setModalData({ inicial: instalacionSeleccionada })}
            />
          ))}
        </>
      )}

      {/* Modal Crear / Editar */}
      {modalData && (
        <ModalInstalacion
          inicial={modalData.inicial}
          onClose={() => setModalData(null)}
          onGuardada={handleGuardada}
        />
      )}
    </div>
  );
}
