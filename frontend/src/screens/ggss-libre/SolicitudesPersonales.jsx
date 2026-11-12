import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { Btn } from "../../components/ui/Btn";
import { Input } from "../../components/ui/Input";
import { SectionHeader } from "../../components/ui/SectionHeader";

const TIPOS = {
  vacaciones: "Vacaciones", dias_libres: "Días libres", turno_extra: "Turno extra",
  traslado: "Traslado", turno: "Turno",
};

export function SolicitudesPersonales() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [tipo, setTipo] = useState("vacaciones");
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let activo = true;
    api.get("/solicitudes").then(({ data }) => { if (activo) setSolicitudes(data); })
      .catch(err => { if (activo) setError(err.message); });
    return () => { activo = false; };
  }, []);

  const crear = async (evento) => {
    evento.preventDefault();
    setError("");
    setOcupado(true);
    try {
      const nueva = await api.post("/solicitudes", { tipo, fecha_desde: fecha, motivo });
      setSolicitudes(prev => [nueva, ...prev.filter(s => s.id !== nueva.id)]);
      setFecha("");
      setMotivo("");
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="guard-screen">
      <SectionHeader title="Mis solicitudes" />
      <form onSubmit={crear}>
        <label>Tipo de solicitud <select value={tipo} onChange={e => setTipo(e.target.value)}>
          {Object.entries(TIPOS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <Input label="Fecha solicitada" type="date" value={fecha} onChange={setFecha} />
        <Input label="Motivo" value={motivo} onChange={setMotivo} maxLength={500} />
        <Btn type="submit" loading={ocupado} disabled={!fecha}>Enviar solicitud</Btn>
      </form>
      {error && <p role="alert">{error}</p>}
      {solicitudes.length ? <ul>{solicitudes.map(s => <li key={s.id}>
        {TIPOS[s.tipo] ?? s.tipo} · {s.fecha_desde?.slice(0, 10)} · {s.estado}
      </li>)}</ul> : <p>Sin solicitudes registradas.</p>}
    </div>
  );
}
