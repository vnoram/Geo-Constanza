import { useState, useEffect, useCallback } from "react";
import { T, FONT } from "../../theme/theme";
import { Icon } from "../../components/ui/Icon";
import { Btn } from "../../components/ui/Btn";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";

const PLANES = [
  { value: "basico", label: "Básico" },
  { value: "estandar", label: "Estándar" },
  { value: "premium", label: "Premium" },
];
const etiquetaPlan = (plan) => PLANES.find((p) => p.value === plan)?.label ?? plan;
const fechaCorta = (iso) => (iso ? new Date(iso).toLocaleDateString("es-CL") : "—");

// ─── Cuadro de diálogo base ──────────────────────────────────────
function Dialogo({ titulo, subtitulo, onClose, children }) {
  return (
    <div
      className="admin-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      style={{
        position: "fixed", inset: 0, background: "rgba(14,23,20,0.88)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
      }}
    >
      <div className="admin-modal" style={{
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: 24,
        width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: T.text }}>{titulo}</div>
            {subtitulo && <div style={{ fontSize: 12, color: T.textMut, marginTop: 2 }}>{subtitulo}</div>}
          </div>
          <button className="touch-target" aria-label="Cerrar" onClick={onClose}
            style={{ background: "none", border: "none", color: T.textMut, cursor: "pointer", lineHeight: 1 }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MensajeError({ children }) {
  if (!children) return null;
  return (
    <div role="alert" style={{
      border: `1px solid ${T.alert}`, background: T.alertGhost, color: T.alert,
      borderRadius: T.radius, padding: "8px 12px", fontSize: 13, marginBottom: 14,
    }}>{children}</div>
  );
}

// ─── Crear / editar empresa ──────────────────────────────────────
function ModalEmpresa({ inicial, onClose, onGuardada }) {
  const esEdicion = !!inicial?.id;
  const [form, setForm] = useState({
    nombre: inicial?.nombre ?? "", rut: inicial?.rut ?? "", plan: inicial?.plan ?? "estandar",
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const set = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const guardar = async () => {
    setError("");
    if (form.nombre.trim().length < 3) return setError("El nombre debe tener al menos 3 caracteres.");
    if (!form.rut.trim()) return setError("Ingresa el RUT de la empresa.");
    setEnviando(true);
    try {
      const cuerpo = { nombre: form.nombre.trim(), rut: form.rut.trim(), plan: form.plan };
      const resultado = esEdicion
        ? await api.put(`/plataforma/empresas/${inicial.id}`, cuerpo)
        : await api.post("/plataforma/empresas", cuerpo);
      onGuardada(resultado, !esEdicion);
    } catch (e) {
      setError(e.message || "No se pudo guardar la empresa.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialogo titulo={esEdicion ? "Editar empresa" : "Nueva empresa"}
      subtitulo={esEdicion ? "Datos de la empresa cliente" : "Después podrás crear su administrador de gestión"} onClose={onClose}>
      <MensajeError>{error}</MensajeError>
      <Input label="Nombre" value={form.nombre} onChange={set("nombre")} placeholder="Seguridad Alfa Ltda." maxLength={120} />
      <Input label="RUT de la empresa" value={form.rut} onChange={set("rut")} placeholder="76.111.111-K" mono maxLength={14} />
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textSec, marginBottom: 6 }}>Plan</label>
        <select className="touch-target" value={form.plan} onChange={(e) => set("plan")(e.target.value)} style={{
          width: "100%", background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: T.radius,
          padding: "0 12px", minHeight: 42, color: T.text, fontSize: 14, fontFamily: FONT.ui,
        }}>
          {PLANES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={guardar} loading={enviando}>{esEdicion ? "Guardar cambios" : "Crear empresa"}</Btn>
      </div>
    </Dialogo>
  );
}

// ─── Crear el primer administrador de gestión ────────────────────
function ModalAdmin({ empresa, onClose, onCreado }) {
  const [form, setForm] = useState({ rut: "", nombre: "", email: "" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const set = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const crear = async () => {
    setError("");
    if (!form.rut.trim() || form.nombre.trim().length < 3 || !form.email.trim()) {
      return setError("Completa RUT, nombre y correo del administrador.");
    }
    setEnviando(true);
    try {
      await api.post(`/plataforma/empresas/${empresa.id}/admin`, {
        rut: form.rut.trim(), nombre: form.nombre.trim(), email: form.email.trim(),
      });
      onCreado();
    } catch (e) {
      setError(e.message || "No se pudo crear el administrador.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialogo titulo="Administrador de gestión" subtitulo={empresa.nombre} onClose={onClose}>
      <p style={{ fontSize: 13, color: T.textSec, margin: "0 0 14px" }}>
        Recibirá un correo para definir su contraseña. Desde ahí gestiona los usuarios, instalaciones y turnos de su empresa.
      </p>
      <MensajeError>{error}</MensajeError>
      <Input label="RUT" value={form.rut} onChange={set("rut")} placeholder="12.345.678-5" mono maxLength={14} />
      <Input label="Nombre completo" value={form.nombre} onChange={set("nombre")} maxLength={120} />
      <Input label="Correo" type="email" value={form.email} onChange={set("email")} placeholder="nombre@empresa.cl" maxLength={160} />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={crear} loading={enviando}>Crear administrador</Btn>
      </div>
    </Dialogo>
  );
}

// ─── Gestionar al administrador existente ────────────────────────
function ModalGestionAdmin({ empresa, admin, onClose, onTerminado }) {
  const [form, setForm] = useState({ nombre: admin.nombre ?? "", email: admin.email ?? "", telefono: admin.telefono ?? "" });
  const [enviando, setEnviando] = useState("");
  const [error, setError] = useState("");
  const set = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const base = `/plataforma/empresas/${empresa.id}/admin/${admin.id}`;

  const guardar = async () => {
    setError("");
    if (form.nombre.trim().length < 3 || !form.email.trim()) return setError("Completa nombre y correo.");
    setEnviando("guardar");
    try {
      await api.put(base, { nombre: form.nombre.trim(), email: form.email.trim(), telefono: form.telefono.trim() });
      onTerminado("Datos del administrador actualizados.");
    } catch (e) {
      setError(e.message || "No se pudo guardar.");
    } finally { setEnviando(""); }
  };

  const reenviar = async () => {
    setError("");
    setEnviando("reenviar");
    try {
      const r = await api.post(`${base}/invitacion`);
      onTerminado(r?.invitacion_enviada ? "Correo enviado: podrá elegir su contraseña." : "No se pudo enviar el correo. Revisa la configuración de correo.");
    } catch (e) {
      setError(e.message || "No se pudo reenviar el correo.");
    } finally { setEnviando(""); }
  };

  const desactivar = async () => {
    setError("");
    setEnviando("desactivar");
    try {
      await api.patch(`${base}/estado`, { estado: "inactivo" });
      onTerminado("Administrador desactivado. Ahora puedes crear uno nuevo.");
    } catch (e) {
      setError(e.message || "No se pudo desactivar.");
    } finally { setEnviando(""); }
  };

  return (
    <Dialogo titulo="Administrador de gestión" subtitulo={empresa.nombre} onClose={onClose}>
      <MensajeError>{error}</MensajeError>
      <div style={{ fontSize: 12, color: T.textMut, marginBottom: 12 }}>
        RUT: <span style={{ fontFamily: FONT.mono, color: T.textSec }}>{admin.rut}</span> · no se puede modificar, es su usuario de acceso.
      </div>
      <Input label="Nombre completo" value={form.nombre} onChange={set("nombre")} maxLength={120} />
      <Input label="Correo" type="email" value={form.email} onChange={set("email")} maxLength={160} />
      <Input label="Teléfono (opcional)" value={form.telefono} onChange={set("telefono")} maxLength={30} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Btn variant="secondary" onClick={reenviar} loading={enviando === "reenviar"}>Reenviar correo de contraseña</Btn>
        <Btn variant="secondary" onClick={desactivar} loading={enviando === "desactivar"}>Desactivar administrador</Btn>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={guardar} loading={enviando === "guardar"}>Guardar cambios</Btn>
      </div>
    </Dialogo>
  );
}

// ─── Confirmar suspensión / reactivación ─────────────────────────
function ModalEstado({ empresa, onClose, onCambiado }) {
  const suspender = empresa.estado === "activa";
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const confirmar = async () => {
    setError("");
    setEnviando(true);
    try {
      await api.patch(`/plataforma/empresas/${empresa.id}/estado`, { estado: suspender ? "suspendida" : "activa" });
      onCambiado();
    } catch (e) {
      setError(e.message || "No se pudo cambiar el estado.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialogo titulo={suspender ? "Suspender empresa" : "Reactivar empresa"} subtitulo={empresa.nombre} onClose={onClose}>
      <p style={{ fontSize: 13, color: T.textSec, margin: "0 0 14px" }}>
        {suspender
          ? "Nadie de esta empresa podrá iniciar sesión y las sesiones abiertas se cerrarán al instante. Sus datos se conservan."
          : "Los usuarios de esta empresa volverán a poder iniciar sesión."}
      </p>
      <MensajeError>{error}</MensajeError>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={confirmar} loading={enviando}>{suspender ? "Suspender" : "Reactivar"}</Btn>
      </div>
    </Dialogo>
  );
}

// ─── Pantalla ────────────────────────────────────────────────────
export function EmpresasPanel() {
  const [empresas, setEmpresas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [dialogo, setDialogo] = useState(null); // { tipo: 'empresa'|'admin'|'estado', empresa? }
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    setError("");
    try {
      const respuesta = await api.get("/plataforma/empresas");
      setEmpresas(Array.isArray(respuesta) ? respuesta : respuesta.data ?? []);
    } catch (e) {
      setError(e.message || "No se pudieron cargar las empresas.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cerrar = () => setDialogo(null);
  const terminar = async (mensaje) => {
    setDialogo(null);
    setAviso(mensaje);
    await cargar();
  };

  const celda = { padding: "10px 12px", fontSize: 13, color: T.text, borderBottom: `1px solid ${T.border}`, verticalAlign: "middle" };
  const cabecera = { ...celda, fontSize: 11, color: T.textMut, fontWeight: 500, textAlign: "left", whiteSpace: "nowrap" };
  const accion = (icono, etiqueta, onClick) => (
    <button className="touch-target" onClick={onClick} title={etiqueta} aria-label={etiqueta} style={{
      background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.radius, color: T.text,
      minHeight: 34, padding: "0 10px", cursor: "pointer", fontFamily: FONT.ui, fontSize: 12,
      display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
    }}><Icon name={icono} size={14} />{etiqueta}</button>
  );

  return (
    <div>
      <SectionHeader title="Empresas" sub="Clientes de la plataforma. Aquí no se ven guardias, turnos ni novedades."
        action={{ label: "Nueva empresa", onClick: () => setDialogo({ tipo: "empresa" }) }} />

      {aviso && (
        <div role="status" style={{
          border: `1px solid ${T.accent}`, background: T.accentGhost, color: T.accent,
          borderRadius: T.radius, padding: "8px 12px", fontSize: 13, marginBottom: 14,
        }}>{aviso}</div>
      )}
      <MensajeError>{error}</MensajeError>

      {cargando ? (
        <div style={{ color: T.textMut, fontSize: 13, padding: 24 }}>Cargando empresas…</div>
      ) : empresas.length === 0 && !error ? (
        <div style={{ color: T.textMut, fontSize: 13, padding: 24, textAlign: "center" }}>
          Aún no hay empresas. Crea la primera con “Nueva empresa”.
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: T.radius, background: T.bgCard }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>
                <th style={cabecera}>Empresa</th>
                <th style={cabecera}>RUT</th>
                <th style={cabecera}>Plan</th>
                <th style={cabecera}>Estado</th>
                <th style={cabecera}>Administrador</th>
                <th style={cabecera}>Usuarios</th>
                <th style={cabecera}>Creada</th>
                <th style={cabecera}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => {
                const admin = e.administradores?.find((a) => a.estado === "activo");
                return (
                  <tr key={e.id}>
                    <td style={{ ...celda, fontWeight: 600 }}>{e.nombre}</td>
                    <td style={{ ...celda, fontFamily: FONT.mono }}>{e.rut}</td>
                    <td style={celda}>{etiquetaPlan(e.plan)}</td>
                    <td style={celda}><Badge color={e.estado === "activa" ? "accent" : "yellow"}>{e.estado === "activa" ? "Activa" : "Suspendida"}</Badge></td>
                    <td style={celda}>
                      {admin ? <>{admin.nombre}<div style={{ fontSize: 11, color: T.textMut }}>{admin.email}</div></>
                        : <span style={{ color: T.textMut }}>Sin administrador activo</span>}
                    </td>
                    <td style={{ ...celda, fontFamily: FONT.mono }}>{e.total_usuarios}</td>
                    <td style={celda}>{fechaCorta(e.created_at)}</td>
                    <td style={celda}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {accion("pencil", "Editar", () => setDialogo({ tipo: "empresa", empresa: e }))}
                        {admin
                          ? accion("user-round", "Admin", () => setDialogo({ tipo: "gestionAdmin", empresa: e, admin }))
                          : accion("plus", "Crear admin", () => setDialogo({ tipo: "admin", empresa: e }))}
                        {accion(e.estado === "activa" ? "ban" : "check", e.estado === "activa" ? "Suspender" : "Reactivar", () => setDialogo({ tipo: "estado", empresa: e }))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialogo?.tipo === "empresa" && (
        <ModalEmpresa inicial={dialogo.empresa} onClose={cerrar}
          onGuardada={(resultado, nueva) => {
            if (!nueva) return terminar("Empresa actualizada.");
            // Empresa recién creada: se ofrece de inmediato crear su administrador.
            setAviso("Empresa creada.");
            setDialogo({ tipo: "admin", empresa: resultado });
            return cargar();
          }} />
      )}
      {dialogo?.tipo === "admin" && (
        <ModalAdmin empresa={dialogo.empresa} onClose={() => terminar("")} onCreado={() => terminar("Administrador creado. Recibirá un correo para definir su contraseña.")} />
      )}
      {dialogo?.tipo === "gestionAdmin" && (
        <ModalGestionAdmin empresa={dialogo.empresa} admin={dialogo.admin} onClose={cerrar} onTerminado={terminar} />
      )}
      {dialogo?.tipo === "estado" && (
        <ModalEstado empresa={dialogo.empresa} onClose={cerrar}
          onCambiado={() => terminar(dialogo.empresa.estado === "activa" ? "Empresa suspendida." : "Empresa reactivada.")} />
      )}
    </div>
  );
}
