import { useEffect, useState } from "react";
import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Btn } from "../../components/ui/Btn";
import { api } from "../../services/api";
import { API_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

export function AdminAuditoria() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ usuario_id: "", accion: "", fecha_inicio: "", fecha_fin: "" });
  const [filtros, setFiltros] = useState(form);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");
  const query = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor)).toString();
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
  const campo = { width: "100%", minWidth: 0, boxSizing: "border-box", padding: 10, background: T.bgInput, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8 };
  const actualizar = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  return (
    <div className="admin-screen">
      <SectionHeader title="Auditoría" sub="Log de cambios del sistema" />
      <form onSubmit={e => { e.preventDefault(); setPage(1); setFiltros({ ...form }); }} style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 12 }}>
          <label>Usuario<select name="usuario_id" value={form.usuario_id} onChange={actualizar} style={campo}>
            <option value="">Todos</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select></label>
          <label>Acción<input name="accion" value={form.accion} onChange={actualizar} placeholder="Todas" style={campo} /></label>
          <label>Desde<input type="date" name="fecha_inicio" value={form.fecha_inicio} onChange={actualizar} style={campo} /></label>
          <label>Hasta<input type="date" name="fecha_fin" value={form.fecha_fin} onChange={actualizar} style={campo} /></label>
        </div>
        <div className="action-wrap" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn type="submit" variant="secondary">Aplicar filtros</Btn>
          <Btn type="button" icon="file-text" onClick={exportar} loading={exportando} disabled={loading}>Exportar PDF</Btn>
        </div>
      </form>
      {error && <p role="alert" style={{ color: T.red }}>{error}</p>}
      {loading && <p style={{ color: T.textMut }}>Cargando auditoría...</p>}
      {!loading && !logs.length && !error && <p style={{ color: T.textMut }}>Sin registros para estos filtros.</p>}
      {logs.map(l => (
        <div className="admin-card" key={l.id} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
          padding: 12, marginBottom: 5,
        }}>
          <div className="admin-list-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Badge color="accent">{l.accion}</Badge>
            <span style={{ fontSize: 10, color: T.textMut, fontFamily: "var(--font-mono)" }}>{new Date(l.created_at).toLocaleString("es-CL", { timeZone: "America/Santiago" })}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{l.usuario?.nombre ?? "—"}</div>
          <div style={{ fontSize: 11, color: T.textMut }}>{l.tabla_afectada} · {l.registro_id} · IP: {l.ip_address ?? "—"}</div>
        </div>
      ))}
      {totalPages > 1 && <div className="action-wrap" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <Btn variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Anterior</Btn>
        <span>{page} / {totalPages}</span>
        <Btn variant="ghost" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Siguiente</Btn>
      </div>}
    </div>
  );
}
