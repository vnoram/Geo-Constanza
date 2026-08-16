import { useState, useEffect } from "react";
import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { Btn } from "../../components/ui/Btn";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";

// ─── Constantes ───────────────────────────────────────────────────────────────
const ROLES     = ["pauta", "libre", "supervisor", "central", "admin"];
const ROL_LABEL = { pauta: "GGSS Pauta", libre: "GGSS Libre", supervisor: "Supervisor", central: "Central", admin: "Admin" };
const ROL_BADGE = { pauta: "accent", libre: "accent", supervisor: "yellow", central: "accent", admin: "red" };

const VACÍO = { rut: "", nombre: "", email: "", telefono: "", password: "", rol: "pauta", instalacionIds: [], instalacion_asignada_id: "" };

// ─── Helpers de UI ────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "10px 12px", boxSizing: "border-box",
  background: T.bgInput, border: `1px solid ${T.border}`,
  borderRadius: 8, color: T.text, fontSize: 14, outline: "none",
  fontFamily: "'Outfit', sans-serif",
};

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, color: T.textSec, marginBottom: 6 }}>
        {label}{required && " *"}
      </label>
      {children}
    </div>
  );
}

// ─── Modal Crear / Editar ─────────────────────────────────────────────────────
function UsuarioModal({ inicial, instalaciones, onClose, onSaved }) {
  const esEdicion    = !!inicial?.id;
  const [form, setForm]       = useState(inicial ?? VACÍO);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const toggleInstalacion = (id) =>
    setForm((f) => ({
      ...f,
      instalacionIds: f.instalacionIds.includes(id)
        ? f.instalacionIds.filter((x) => x !== id)
        : [...f.instalacionIds, id],
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.rut.trim() || !form.nombre.trim() || !form.email.trim()) {
      setError("RUT, nombre y email son obligatorios.");
      return;
    }
    if (!esEdicion && !form.password.trim()) {
      setError("La contraseña es obligatoria al crear un usuario.");
      return;
    }

    // Construir payload limpio
    const payload = { ...form };
    if (esEdicion && !payload.password) delete payload.password;
    if (payload.rol !== "supervisor")           delete payload.instalacionIds;
    if (!["pauta", "libre"].includes(payload.rol)) delete payload.instalacion_asignada_id;

    setLoading(true);
    try {
      if (esEdicion) {
        await api.put(`/usuarios/${inicial.id}`, payload);
      } else {
        await api.post("/usuarios", payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message || "Error al guardar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(6,13,24,0.88)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: 24, width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: T.text }}>
            {esEdicion ? "Editar Usuario" : "Crear Usuario"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.textMut, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Fila 1: RUT + Rol */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            <Field label="RUT" required>
              <input style={inputStyle} value={form.rut} onChange={(e) => set("rut", e.target.value)} placeholder="12345678-9" />
            </Field>
            <Field label="Rol" required>
              <select style={{ ...inputStyle, appearance: "none" }} value={form.rol} onChange={(e) => set("rol", e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r} value={r} style={{ background: T.bgCard }}>{ROL_LABEL[r]}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Nombre completo" required>
            <input style={inputStyle} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Andrés Martínez" />
          </Field>

          <Field label="Email" required>
            <input style={inputStyle} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="usuario@geoconstanza.cl" />
          </Field>

          {/* Fila 2: teléfono + contraseña */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            <Field label="Teléfono">
              <input style={inputStyle} value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="+56 9 1234 5678" />
            </Field>
            <Field label={esEdicion ? "Nueva contraseña" : "Contraseña"} required={!esEdicion}>
              <input style={inputStyle} type="password" value={form.password} onChange={(e) => set("password", e.target.value)}
                placeholder={esEdicion ? "Dejar vacío para no cambiar" : "••••••••"} />
            </Field>
          </div>

          {/* Instalación única — solo para GGSS */}
          {["pauta", "libre"].includes(form.rol) && (
            <Field label="Instalación asignada">
              <select
                style={{ ...inputStyle, appearance: "none", color: form.instalacion_asignada_id ? T.text : T.textMut }}
                value={form.instalacion_asignada_id}
                onChange={(e) => set("instalacion_asignada_id", e.target.value)}
              >
                <option value="">Sin asignar</option>
                {instalaciones.map((i) => (
                  <option key={i.id} value={i.id} style={{ background: T.bgCard }}>{i.nombre}</option>
                ))}
              </select>
            </Field>
          )}

          {/* Multi-check de instalaciones — solo para Supervisor */}
          {form.rol === "supervisor" && (
            <Field label="Área de cobertura (instalaciones asignadas)">
              {instalaciones.length === 0 ? (
                <div style={{ fontSize: 13, color: T.textMut }}>No hay instalaciones creadas aún.</div>
              ) : (
                <div style={{
                  border: `1px solid ${T.border}`, borderRadius: 8,
                  background: T.bgInput, maxHeight: 190, overflowY: "auto",
                }}>
                  {instalaciones.map((inst) => {
                    const sel = form.instalacionIds.includes(inst.id);
                    return (
                      <label key={inst.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 12px", cursor: "pointer",
                        background: sel ? T.accentGhost : "transparent",
                        borderBottom: `1px solid ${T.border}22`,
                        transition: "background 0.15s",
                      }}>
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => toggleInstalacion(inst.id)}
                          style={{ accentColor: T.accent, width: 15, height: 15, cursor: "pointer", flexShrink: 0 }}
                        />
                        <div>
                          <div style={{ fontSize: 13, color: T.text, fontWeight: sel ? 700 : 400 }}>
                            {inst.nombre}
                          </div>
                          <div style={{ fontSize: 10, color: T.textMut }}>
                            Criticidad: {inst.nivel_criticidad ?? "—"}
                            {inst.direccion && ` · ${inst.direccion}`}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              {form.instalacionIds.length > 0 && (
                <div style={{ fontSize: 11, color: T.accent, marginTop: 5 }}>
                  {form.instalacionIds.length} instalación(es) seleccionada(s)
                </div>
              )}
            </Field>
          )}

          {error && (
            <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: T.redGhost, color: T.red, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Btn>
            <Btn loading={loading}>{esEdicion ? "Guardar cambios" : "Crear usuario"}</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Pantalla principal ────────────────────────────────────────────────────────
export function AdminUsuarios() {
  const [usuarios, setUsuarios]           = useState([]);
  const [instalaciones, setInstalaciones] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [modal, setModal]                 = useState(null); // null | { data }
  const [desactivando, setDesactivando]   = useState(null);

  const cargar = async () => {
    try {
      const [usRes, instRes] = await Promise.all([
        api.get("/usuarios?limit=200"),
        api.get("/instalaciones"),
      ]);
      setUsuarios(usRes.data ?? []);
      setInstalaciones(Array.isArray(instRes) ? instRes : (instRes.data ?? []));
    } catch { /* mantener estado */ }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const abrirEditar = (u) => {
    const instalacionIds = (u.instalaciones_sup ?? [])
      .map((s) => s.instalacion_id ?? s.instalacion?.id)
      .filter(Boolean);
    setModal({
      id: u.id,
      rut: u.rut,
      nombre: u.nombre,
      email: u.email,
      telefono: u.telefono ?? "",
      password: "",
      rol: u.rol,
      instalacionIds,
      instalacion_asignada_id: u.instalacion_asignada_id ?? "",
    });
  };

  const handleDesactivar = async (id) => {
    if (!window.confirm("¿Desactivar este usuario?")) return;
    setDesactivando(id);
    try {
      await api.patch(`/usuarios/${id}/desactivar`);
      setUsuarios((prev) => prev.map((u) => u.id === id ? { ...u, estado: "inactivo" } : u));
    } catch (err) {
      alert(err.message || "Error al desactivar.");
    } finally {
      setDesactivando(null);
    }
  };

  return (
    <div>
      <SectionHeader
        title="Usuarios"
        sub="Gestión de personal del sistema"
        action={{ label: "+ Crear", onClick: () => setModal(VACÍO) }}
      />

      {loading && (
        <div style={{ textAlign: "center", color: T.textMut, padding: 32, fontSize: 14 }}>
          Cargando usuarios...
        </div>
      )}

      {!loading && usuarios.map((u) => {
        const instSup = u.instalaciones_sup ?? [];
        return (
          <div key={u.id} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
            padding: "12px 14px", marginBottom: 6,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{u.nombre}</span>
                  <Badge color={ROL_BADGE[u.rol] ?? "accent"}>{ROL_LABEL[u.rol] ?? u.rol}</Badge>
                  <Badge color={u.estado === "activo" ? "accent" : "red"}>{u.estado}</Badge>
                </div>
                <div style={{ fontSize: 11, color: T.textMut }}>{u.email} · {u.rut}</div>

                {/* Área del supervisor: chips de instalaciones */}
                {u.rol === "supervisor" && instSup.length > 0 && (
                  <div style={{ marginTop: 5, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {instSup.map((s) => {
                      const instId   = s.instalacion_id ?? s.instalacion?.id;
                      const instNombre = s.instalacion?.nombre ?? instId;
                      return (
                        <span key={instId} style={{
                          fontSize: 10, background: T.yellowGhost, color: T.yellow,
                          padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                          border: `1px solid ${T.yellow}33`,
                        }}>
                          {instNombre}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Instalación del guardia */}
                {["pauta", "libre"].includes(u.rol) && u.instalacion_asignada && (
                  <div style={{ fontSize: 10, color: T.textMut, marginTop: 3 }}>
                    📍 {u.instalacion_asignada.nombre}
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div style={{ display: "flex", gap: 6, marginLeft: 10, flexShrink: 0 }}>
                <button
                  onClick={() => abrirEditar(u)}
                  style={{
                    background: T.accentGhost, border: `1px solid ${T.accent}44`,
                    color: T.accent, fontSize: 11, fontWeight: 700, padding: "5px 10px",
                    borderRadius: 7, cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  Editar
                </button>
                {u.estado === "activo" && (
                  <button
                    onClick={() => handleDesactivar(u.id)}
                    disabled={desactivando === u.id}
                    style={{
                      background: T.redGhost, border: `1px solid ${T.red}44`,
                      color: T.red, fontSize: 11, fontWeight: 700, padding: "5px 10px",
                      borderRadius: 7, cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                      opacity: desactivando === u.id ? 0.5 : 1,
                    }}
                  >
                    Desactivar
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {modal && (
        <UsuarioModal
          inicial={modal}
          instalaciones={instalaciones}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar(); }}
        />
      )}
    </div>
  );
}
