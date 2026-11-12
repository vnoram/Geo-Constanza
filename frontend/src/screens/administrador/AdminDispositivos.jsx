import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Input } from "../../components/ui/Input";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function AdminDispositivos() {
  const [equipos, setEquipos] = useState([]);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let activo = true;
    api.get("/dispositivos").then(datos => { if (activo) setEquipos(datos); })
      .catch(err => { if (activo) setError(err.message); });
    return () => { activo = false; };
  }, []);

  const ejecutar = async (operacion) => {
    setError("");
    setOcupado(true);
    try {
      await operacion();
      setEquipos(await api.get("/dispositivos"));
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const crear = () => ejecutar(async () => {
    setCodigo("");
    const respuesta = await api.post("/dispositivos", { nombre: nombre.trim() });
    setCodigo(respuesta.codigo);
    setNombre("");
  });

  return (
    <div>
      <SectionHeader title="Dispositivos corporativos" />
      <Input label="Nombre del equipo" value={nombre} onChange={setNombre} maxLength={100} />
      <Btn onClick={crear} disabled={ocupado || !nombre.trim()}>Generar código</Btn>
      {codigo && <p role="status">Código de un solo uso, válido por 15 minutos. <code>{codigo}</code></p>}
      {error && <p role="alert" style={{ color: T.alert }}>{error}</p>}
      {equipos.map(equipo => (
        <div key={equipo.id} style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          <span>{equipo.nombre} · {equipo.estado === "revocado" ? "Revocado" : equipo.codigo_expira_en ? "Pendiente de enrolamiento" : "Enrolado"}</span>
          {equipo.estado === "activo" && <Btn variant="outline" disabled={ocupado} onClick={() => ejecutar(
            () => api.patch(`/dispositivos/${equipo.id}/revocar`, {}),
          )}>Revocar</Btn>}
        </div>
      ))}
    </div>
  );
}
