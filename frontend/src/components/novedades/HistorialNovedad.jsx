import { useState } from "react";
import { api } from "../../services/api";
import { T } from "../../theme/theme";

export function HistorialNovedad({ id }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState("");
  const cargar = async (e) => {
    if (!e.currentTarget.open) return;
    setError("");
    try { setFilas(await api.get(`/novedades/${id}/historial`)); }
    catch (e) { setError(e.message); }
  };
  return <details onToggle={cargar} style={{ color: T.textSec, fontSize: 12, marginTop: 8 }}>
    <summary style={{ cursor: "pointer", padding: "8px 0" }}>Historial de la novedad</summary>
    {error && <p role="alert" style={{ color: T.red }}>{error}</p>}
    {!filas && !error && <p>Cargando historial...</p>}
    <ol style={{ paddingLeft: 20 }}>
      {filas?.map(f => <li key={f.id} style={{ padding: "6px 0" }}>
        <time>{new Date(f.created_at).toLocaleString("es-CL", { timeZone: "America/Santiago" })}</time>
        {" · "}{f.usuario?.nombre}{" · "}{f.accion}{" · "}{f.estado_anterior ? `${f.estado_anterior} → ` : ""}{f.estado_nuevo}
        {f.comentario && <p style={{ margin: "4px 0" }}>{f.comentario}</p>}
      </li>)}
    </ol>
  </details>;
}
