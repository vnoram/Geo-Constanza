import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Input } from "../../components/ui/Input";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function AdminDispositivos() {
  const [equipos, setEquipos] = useState([]);
  const [destinatarios, setDestinatarios] = useState([]);
  const [usuario, setUsuario] = useState("");
  const [nombre, setNombre] = useState("");
  const [manual, setManual] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [invitacion, setInvitacion] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let activo = true;
    Promise.all([api.get("/dispositivos"), api.get("/dispositivos/destinatarios")])
      .then(([lista, usuarios]) => {
        if (activo) {
          setEquipos(lista);
          setDestinatarios(usuarios);
        }
      }).catch(err => { if (activo) setError(err.message); });
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

  const mostrarInvitacion = (datos) => {
    setInvitacion(datos);
    setCopiado(false);
    setCodigo("");
  };

  const invitar = () => ejecutar(async () => {
    mostrarInvitacion(await api.post("/dispositivos/invitaciones", { nombre: nombre.trim(), usuario_id: usuario }));
    setNombre("");
  });

  const crearCodigo = () => ejecutar(async () => {
    const respuesta = await api.post("/dispositivos", { nombre: nombre.trim() });
    setInvitacion(null);
    setCodigo(respuesta.codigo);
    setNombre("");
  });

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(invitacion.enlace);
      setCopiado(true);
    } catch {
      setError("Selecciona y copia el enlace manualmente.");
    }
  };

  return (
    <div>
      <SectionHeader title="Dispositivos corporativos" />
      <Input label="Nombre del equipo" value={nombre} onChange={setNombre} maxLength={100} />
      <label>Destinatario{" "}
        <select value={usuario} onChange={evento => setUsuario(evento.target.value)}>
          <option value="">Selecciona un supervisor u operador central</option>
          {destinatarios.map(persona => <option key={persona.id} value={persona.id}>
            {persona.nombre} · {persona.rol === "supervisor" ? "Supervisor" : "Operador central"}
          </option>)}
        </select>
      </label>
      <div style={{ marginTop: 12 }}>
        <Btn onClick={invitar} disabled={ocupado || !nombre.trim() || !usuario}>Invitar equipo</Btn>
      </div>
      {invitacion && <div style={{ marginTop: 12 }}>
        <p role="status">{invitacion.correoEnviado ? "Invitación enviada. El enlace vence en 15 minutos." : "No se pudo enviar el correo. Puedes copiar el enlace, válido por 15 minutos."}</p>
        <input aria-label="Enlace de invitación" readOnly value={invitacion.enlace} style={{ maxWidth: "100%", width: 420 }} />
        <Btn variant="outline" onClick={copiar}>{copiado ? "Enlace copiado" : "Copiar enlace"}</Btn>
      </div>}
      <div style={{ marginTop: 12 }}>
        <Btn variant="outline" aria-expanded={manual} onClick={() => setManual(!manual)}>Opciones manuales</Btn>
        {manual && <Btn variant="outline" onClick={crearCodigo} disabled={ocupado || !nombre.trim()}>Generar código manual</Btn>}
      </div>
      {codigo && <p role="status">Código de un solo uso, válido por 15 minutos. <code>{codigo}</code></p>}
      {error && <p role="alert" style={{ color: T.alert }}>{error}</p>}
      {equipos.map(equipo => {
        const pendiente = equipo.estado === "activo" && !!(equipo.codigo_expira_en || equipo.invitacion_expira_en);
        const vencida = pendiente && new Date(equipo.invitacion_expira_en || equipo.codigo_expira_en) < new Date();
        const estado = equipo.estado === "revocado" ? "Revocado" : vencida ? "Vencida" : pendiente ? "Pendiente de enrolamiento" : "Enrolado";
        return (
          <div key={equipo.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 12 }}>
            <span>{equipo.nombre} · {estado}{equipo.instalacion ? ` · ${equipo.instalacion.nombre}` : ""}</span>
            {equipo.enrolador && <span>Enroló: {equipo.enrolador.nombre}</span>}
            <span>Último uso: {equipo.ultimo_uso ? new Date(equipo.ultimo_uso).toLocaleString("es-CL") : "Sin uso registrado"}</span>
            {pendiente && equipo.invitado_usuario_id && <Btn variant="outline" disabled={ocupado} onClick={() => ejecutar(async () => {
              mostrarInvitacion(await api.post(`/dispositivos/${equipo.id}/invitaciones/reenviar`, {}));
            })}>Reenviar invitación</Btn>}
            {equipo.estado === "activo" && <Btn variant="outline" disabled={ocupado} onClick={() => ejecutar(async () => {
              await api.patch(`/dispositivos/${equipo.id}/revocar`, {});
              if (invitacion?.id === equipo.id) setInvitacion(null);
              setCodigo("");
            })}>Revocar</Btn>}
          </div>
        );
      })}
    </div>
  );
}
