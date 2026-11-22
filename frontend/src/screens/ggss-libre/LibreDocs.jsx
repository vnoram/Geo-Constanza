import { Aparecer } from "../../components/ui/Aparecer";
import { Esqueleto } from "../../components/ui/Esqueleto";
import "./LibreVisual.css";
import { useCallback, useEffect, useState } from "react";
import { leerSesion } from "../../services/almacenSesion";
import { Icon } from "../../components/ui/Icon";
import { T } from "../../theme/theme";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";
import { API_URL as API_BASE } from "../../config/api";
import { Aviso } from "../../components/ui/Aviso";

const ICONOS = { contrato: "file-text", liquidacion: "banknote", os10: "graduation-cap", anexo: "paperclip", otro: "file-text" };
const tarjeta = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 };
const fecha = (iso) => new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });

export function LibreDocs() {
  const [docs, setDocs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try { setDocs(await api.get("/documentos")); }
    catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const subir = async (archivo) => {
    if (!archivo) return;
    setError(""); setAviso("");
    if (archivo.size > 5 * 1024 * 1024) { setError("El archivo supera los 5 MB."); return; }
    setOcupado(true);
    try {
      const form = new FormData();
      form.append("nombre", "Certificado OS-10");
      form.append("archivo", archivo);
      const res = await fetch(`${API_BASE}/documentos`, {
        method: "POST", headers: { Authorization: `Bearer ${leerSesion("gc_token")}` }, body: form,
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error || `Error ${res.status}`);
      setAviso("Certificado OS-10 subido correctamente.");
      await cargar();
    } catch (err) { setError(err.message); }
    finally { setOcupado(false); }
  };

  const BASE = [["contrato", "Contrato"], ["liquidacion", "Liquidación"], ["os10", "Certificado OS-10"], ["anexo", "Anexo de contrato"]];
  const filas = [
    ...BASE.flatMap(([tipo, titulo]) => {
      const propios = docs.filter(d => d.tipo === tipo);
      return propios.length ? propios.map(d => ({ tipo, titulo: d.nombre, doc: d })) : [{ tipo, titulo }];
    }),
    ...docs.filter(d => !BASE.some(([t]) => t === d.tipo)).map(d => ({ tipo: d.tipo, titulo: d.nombre, doc: d })),
  ];

  return (
    <Aparecer className="guard-screen libre-visual libre-libredocs">
      <SectionHeader title="Documentos" sub="Tu documentación personal" />
      {cargando ? (
        <Esqueleto filas={3} alto={64} />
      ) : filas.map((f, i) => (
        <Aparecer grupo="LibreDocs.jsx:2870" className="guard-list-row libre-documento" key={f.doc?.id ?? `${f.tipo}-${i}`} style={{ ...tarjeta, borderLeft: `3px solid ${f.doc ? T.accent : T.yellow}`, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div className="guard-list-row__main" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name={ICONOS[f.tipo] ?? "file-text"} size={18} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{f.titulo}</div>
              <div style={{ fontSize: 13, color: f.doc ? T.accent : T.textSec }}>
                {f.doc ? `Disponible · ${fecha(f.doc.created_at)}` : "Pendiente"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {f.doc?.url_firmada && <a className="gc-accion-btn gc-accion-btn--verde libre-documento__accion" href={f.doc.url_firmada} target="_blank" rel="noreferrer" style={{ color: T.accent, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>Descargar →</a>}
            {f.tipo === "os10" && (
              <label className="gc-accion-btn gc-accion-btn--verde libre-documento__accion" style={{ color: T.accent, fontSize: 11, fontWeight: 600, cursor: ocupado ? "default" : "pointer", opacity: ocupado ? 0.5 : 1 }}>
                {ocupado ? "Subiendo..." : f.doc ? "Reemplazar" : "Subir →"}
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={ocupado} style={{ display: "none" }}
                  onChange={e => { subir(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </Aparecer>
      ))}
      <Aviso mensaje={aviso} />
      {error && <div role="alert" style={{ fontSize: 12, color: T.alert, marginTop: 10 }}>{error}</div>}
    </Aparecer>
  );
}
