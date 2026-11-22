import { Aparecer } from "../../components/ui/Aparecer";
import { Esqueleto } from "../../components/ui/Esqueleto";
import "./AdminVisual.css";
import { KPI } from "../../components/ui/KPI";
import { useEffect, useState } from "react";
import { FONT, T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Btn } from "../../components/ui/Btn";
import { api } from "../../services/api";
import { API_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

// Etiquetas legibles de cada acción registrada y su categoría. Lo no listado se muestra con el nombre
// de la acción en palabras ("subir_documento" → "Subir documento") dentro de Gestión.
const ACCIONES = {
  login: ["Inicio de sesión", "acceso"], login_2fa: ["Verificación en dos pasos", "acceso"], enviar_2fa_email: ["Código enviado por correo", "acceso"],
  activar_2fa: ["2FA activado", "seguridad"], reiniciar_2fa: ["2FA reiniciado", "seguridad"], cambio_password: ["Cambio de contraseña", "seguridad"],
  reset_password: ["Contraseña restablecida", "seguridad"], solicitar_reset_password: ["Restablecimiento solicitado", "seguridad"],
  canjear_codigo_dispositivo: ["Código de equipo canjeado", "equipos"], confirmar_invitacion_dispositivo: ["Invitación de equipo abierta", "equipos"],
  crear_codigo_dispositivo: ["Código de equipo creado", "equipos"], enrolar_dispositivo: ["Equipo enrolado", "equipos"],
  invitar_dispositivo: ["Equipo invitado", "equipos"], reenviar_invitacion_dispositivo: ["Invitación reenviada", "equipos"],
  revocar_dispositivo: ["Equipo revocado", "equipos"], invitar_dispositivo_plataforma: ["Equipo principal invitado", "equipos"],
  revocar_dispositivo_plataforma: ["Equipo revocado por plataforma", "equipos"],
  crear_empresa: ["Empresa creada", "gestion"], activar_empresa: ["Empresa reactivada", "gestion"], suspender_empresa: ["Empresa suspendida", "gestion"],
  crear: ["Registro creado", "gestion"], editar: ["Registro editado", "gestion"], desactivar: ["Registro desactivado", "gestion"],
  escalar: ["Novedad escalada", "gestion"], resolver: ["Novedad resuelta", "gestion"], revisar_marcaje: ["Marcaje revisado", "gestion"], reenviar_marcaje: ["Marcaje reenviado a revisión", "gestion"],
  crear_pauta_4x4: ["Pauta 4x4 creada", "gestion"], subir_documento: ["Documento subido", "gestion"],
};
const CATEGORIAS = {
  gestion: { texto: "Gestión", color: "accent" },
  equipos: { texto: "Equipos", color: "focus" },
  seguridad: { texto: "Seguridad", color: "yellow" },
  acceso: { texto: "Acceso", color: null },
};
const TABLAS = {
  usuarios: "Usuario", dispositivos: "Equipo", novedades: "Novedad", turnos: "Turno", instalaciones: "Instalación",
  empresas: "Empresa", documentos: "Documento", asistencias: "Marcaje",
};
// Filtro por tipo (en vez de uno por cada acción): "relevantes" excluye los accesos, que son ruido.
const TIPOS = [
  ["relevantes", "Relevantes (sin accesos)"], ["gestion", "Gestión"], ["equipos", "Equipos"],
  ["seguridad", "Seguridad"], ["acceso", "Accesos"], ["todo", "Todo"],
];
const accionesDe = (tipo) => {
  if (tipo === "todo") return "";
  const categorias = tipo === "relevantes" ? ["gestion", "equipos", "seguridad"] : [tipo];
  return Object.entries(ACCIONES).filter(([, [, c]]) => categorias.includes(c)).map(([k]) => k).join(",");
};
const clave = (a) => String(a ?? "").toLowerCase();
const describir = (a) => {
  const k = clave(a);
  if (ACCIONES[k]) return { texto: ACCIONES[k][0], categoria: ACCIONES[k][1] };
  const palabras = k.replace(/_/g, " ").trim();
  return { texto: palabras ? palabras[0].toUpperCase() + palabras.slice(1) : "—", categoria: "gestion" };
};

export function AdminAuditoria() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ usuario_id: "", accion: "relevantes", fecha_inicio: "", fecha_fin: "" });
  const [filtros, setFiltros] = useState(form);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");
  const query = new URLSearchParams(Object.entries({ ...filtros, accion: accionesDe(filtros.accion) }).filter(([, valor]) => valor)).toString();
  useEffect(() => {
    api.get("/usuarios?limit=200").then(res => setUsuarios(res.data ?? [])).catch(() => {});
  }, []);
  useEffect(() => {
    let vigente = true;
    const cargar = async () => {
      setLoading(true); setError("");
      try {
        const res = await api.get(`/auditoria?${query}&page=${page}`);
        if (vigente) { setLogs(res.data ?? []); setTotalPages(res.totalPages ?? 0); }
      } catch (e) { if (vigente) setError(e.message); }
      finally { if (vigente) setLoading(false); }
    };
    cargar(); return () => { vigente = false; };
  }, [query, page]);
  const exportar = async () => {
    setExportando(true); setError("");
    try {
      const res = await fetch(`${API_URL}/auditoria/pdf?${query}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const fallo = await res.json().catch(() => ({}));
        throw new Error(fallo.error || "No se pudo exportar la bitácora.");
      }
      const url = URL.createObjectURL(await res.blob());
      const enlace = document.createElement("a");
      enlace.href = url; enlace.download = "bitacora-auditoria.pdf"; document.body.appendChild(enlace); enlace.click(); enlace.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
    finally { setExportando(false); }
  };
  const campo = { width: "100%", minWidth: 0, boxSizing: "border-box", padding: 10, background: T.bgInput, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.radius };
  const actualizar = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  return (
    <Aparecer className="admin-screen admin-visual adminauditoria">
      <SectionHeader title="Auditoría" sub="Log de cambios del sistema" />
      {!loading && !error && (
        <Aparecer grupo="AdminAuditoria.jsx:secciones" className="gc-dashboard-kpis">
          {Object.entries(CATEGORIAS).filter(([id]) => id !== "acceso").map(([id, c]) => (
            <KPI key={id} label={c.texto} value={logs.filter(l => describir(l.accion).categoria === id).length} sub="en esta página"
              accent={id === "seguridad" ? T.yellow : id === "gestion" ? T.accent : undefined} />
          ))}
        </Aparecer>
      )}
      <form className="admin-visual__filters" onSubmit={e => { e.preventDefault(); setPage(1); setFiltros({ ...form }); }} style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 12, marginBottom: 12 }}>
          <label>Usuario<select name="usuario_id" value={form.usuario_id} onChange={actualizar} style={campo}>
            <option value="">Todos</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select></label>
          <label>Tipo<select name="accion" value={form.accion} onChange={actualizar} style={campo}>
            {TIPOS.map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}
          </select></label>
          <label>Desde<input type="date" name="fecha_inicio" value={form.fecha_inicio} onChange={actualizar} style={campo} /></label>
          <label>Hasta<input type="date" name="fecha_fin" value={form.fecha_fin} onChange={actualizar} style={campo} /></label>
        </div>
        <div className="action-wrap" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn type="submit" variant="outline">Aplicar filtros</Btn>
          <Btn type="button" icon="file-text" onClick={exportar} loading={exportando} disabled={loading}>Exportar PDF</Btn>
        </div>
      </form>
      {error && <p role="alert" style={{ color: T.red }}>{error}</p>}
      {loading && <Esqueleto filas={3} alto={64} />}
      {!loading && !logs.length && !error && <p style={{ color: T.textMut }}>Sin registros para estos filtros.</p>}
      <Aparecer grupo="AdminAuditoria.jsx:secciones" className="gc-dashboard-grid">
        {logs.map(l => {
          const { texto, categoria } = describir(l.accion);
          const cat = CATEGORIAS[categoria];
          const sujeto = TABLAS[l.tabla_afectada] ?? l.tabla_afectada;
          return (
            <Aparecer grupo="AdminAuditoria.jsx:8196" className="gc-dashboard-card" key={l.id} style={{
              background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius,
              padding: 12, borderLeft: `3px solid ${cat.color === "yellow" ? T.yellow : cat.color === "focus" ? T.focusText : cat.color ? T.accent : T.border}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                {cat.color ? <Badge color={cat.color}>{cat.texto}</Badge> : <span style={{ fontSize: 11, color: T.textMut }}>{cat.texto}</span>}
                <time dateTime={l.created_at} style={{ fontSize: 11, color: T.textMut, fontFamily: FONT.mono }}>
                  {new Date(l.created_at).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" })}
                </time>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{texto}</div>
              <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>
                {l.usuario?.nombre ?? "Sistema"}{sujeto ? ` · ${sujeto}` : ""}
              </div>
              <div title={`ID ${l.registro_id ?? "—"}`} style={{ fontSize: 10, color: T.textMut, fontFamily: FONT.mono, marginTop: 6 }}>
                {l.registro_id ? `#${String(l.registro_id).slice(-6)}` : ""}{l.ip_address ? ` · IP ${l.ip_address}` : ""}
              </div>
            </Aparecer>
          );
        })}
      </Aparecer>
      {totalPages > 1 && <div className="action-wrap" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <Btn variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Anterior</Btn>
        <span>{page} / {totalPages}</span>
        <Btn variant="ghost" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Siguiente</Btn>
      </div>}
    </Aparecer>
  );
}
