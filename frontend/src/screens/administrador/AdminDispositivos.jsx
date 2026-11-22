import { Aparecer } from "../../components/ui/Aparecer";
import "./AdminVisual.css";
import { useEffect, useId, useState } from "react";
import { api } from "../../services/api";
import { FONT, T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Dialogo } from "../../components/ui/Dialogo";
import { Icon } from "../../components/ui/Icon";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Selector } from "../../components/ui/Selector";

export function AdminDispositivos() {
  const destinatarioId = useId();
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
  const [revocando, setRevocando] = useState(null);
  const [verRevocados, setVerRevocados] = useState(false);

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

  const revocar = async () => {
    const equipo = revocando;
    await api.patch(`/dispositivos/${equipo.id}/revocar`, {});
    if (invitacion?.id === equipo.id) setInvitacion(null);
    setCodigo("");
    setEquipos(await api.get("/dispositivos"));
    setRevocando(null);
  };

  const estadoDe = (equipo) => {
    const pendiente = equipo.estado === "activo" && !!(equipo.codigo_expira_en || equipo.invitacion_expira_en);
    const vencida = pendiente && new Date(equipo.invitacion_expira_en || equipo.codigo_expira_en) < new Date();
    if (equipo.estado === "revocado") return { texto: "Revocado", color: "red", pendiente };
    if (vencida) return { texto: "Invitación vencida", color: "yellow", pendiente };
    if (pendiente) return { texto: "Pendiente de enrolamiento", color: "yellow", pendiente };
    return { texto: "Enrolado", color: "accent", pendiente };
  };

  const card = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 16, marginBottom: 16 };
  const etiqueta = { display: "block", fontSize: 12, fontWeight: 500, color: T.textSec, marginBottom: 6 };
  const revocados = equipos.filter((e) => e.estado === "revocado");
  const pendientes = equipos.filter((e) => e.estado !== "revocado" && estadoDe(e).pendiente);
  const enrolados = equipos.filter((e) => e.estado !== "revocado" && !estadoDe(e).pendiente);

  const renderEquipo = (equipo) => {
    const { texto, color, pendiente } = estadoDe(equipo);
    const revocado = equipo.estado === "revocado";
    return (
      <Aparecer elemento="div" grupo="administrador/AdminDispositivos:4181" className="admin-visual__device" key={equipo.id} style={{
        ...card, borderLeft: `3px solid ${T[color]}`, marginBottom: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, opacity: revocado ? 0.65 : 1,
      }}>
        <Icon name="monitor" size={22} color={revocado ? T.textMut : T.focusText} />
        <div style={{ flex: 1, minWidth: "min(100%, 200px)", overflowWrap: "anywhere" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{equipo.nombre}</span>
            <Badge color={color}>{texto}</Badge>
            {equipo.instalacion && <span style={{ fontSize: 12, color: T.textSec }}>· {equipo.instalacion.nombre}</span>}
          </div>
          <div style={{ fontSize: 11, color: T.textMut, marginTop: 4 }}>
            {equipo.enrolador ? `Enroló: ${equipo.enrolador.nombre} · ` : ""}
            Último uso: {equipo.ultimo_uso ? new Date(equipo.ultimo_uso).toLocaleString("es-CL") : "Sin uso registrado"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {pendiente && equipo.invitado_usuario_id && <Btn variant="outline" disabled={ocupado} onClick={() => ejecutar(async () => {
            mostrarInvitacion(await api.post(`/dispositivos/${equipo.id}/invitaciones/reenviar`, {}));
          })}>Reenviar invitación</Btn>}
          {equipo.estado === "activo" && <Btn variant="outline" disabled={ocupado} onClick={() => setRevocando(equipo)}>{pendiente ? "Cancelar invitación" : "Revocar"}</Btn>}
        </div>
      </Aparecer>
    );
  };

  return (
    <Aparecer className="admin-screen gc-audited-screen admin-visual admindispositivos" style={{ maxWidth: 880 }}>
      <SectionHeader title="Dispositivos corporativos" sub="Equipos autorizados para marcar asistencia en las instalaciones" />

      <div className="admin-visual__invitation" style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
          <Icon name="monitor" size={18} color={T.focusText} /> Invitar un equipo
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14, alignItems: "end" }}>
          <Input label="Nombre del equipo" value={nombre} onChange={setNombre} maxLength={100} placeholder="Ej: PC Central" />
          <div style={{ marginBottom: 16 }}>
            <label htmlFor={destinatarioId} style={etiqueta}>Destinatario</label>
            <Selector id={destinatarioId} etiqueta="Destinatario" bloque value={usuario} onChange={setUsuario} placeholder="Selecciona un supervisor u operador central"
              opciones={destinatarios.map(persona => ({ valor: persona.id, etiqueta: `${persona.nombre} · ${persona.rol === "supervisor" ? "Supervisor" : "Operador central"}` }))} />
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Btn variant="morado" onClick={invitar} disabled={ocupado || !nombre.trim() || !usuario}>Invitar equipo</Btn>
          <Btn variant="outline" aria-expanded={manual} onClick={() => setManual(!manual)}>Opciones manuales</Btn>
        </div>

        {manual && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
            <Btn variant="outline" onClick={crearCodigo} disabled={ocupado || !nombre.trim()}>Generar código manual</Btn>
          </div>
        )}

        {invitacion && (
          <div style={{ marginTop: 14, padding: 12, background: T.accentGhost, border: `1px solid ${T.accent}`, borderRadius: T.radius }}>
            <p role="status" style={{ margin: "0 0 10px", fontSize: 12, color: T.accent, fontWeight: 600 }}>
              {invitacion.correoEnviado ? "Invitación enviada. El enlace vence en 15 minutos." : "No se pudo enviar el correo. Puedes copiar el enlace, válido por 15 minutos."}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <input className="touch-target" aria-label="Enlace de invitación" readOnly value={invitacion.enlace} onFocus={e => e.target.select()} style={{
                flex: 1, minWidth: "min(100%, 220px)", background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: T.radius,
                color: T.text, padding: "0 10px", minHeight: 38, fontFamily: FONT.mono, fontSize: 12,
              }} />
              <Btn variant="outline" onClick={copiar}>{copiado ? "Enlace copiado" : "Copiar enlace"}</Btn>
            </div>
          </div>
        )}

        {codigo && (
          <div style={{ marginTop: 14, padding: 12, background: T.accentGhost, border: `1px solid ${T.accent}`, borderRadius: T.radius }}>
            <p role="status" style={{ margin: "0 0 6px", fontSize: 12, color: T.accent, fontWeight: 600 }}>Código de un solo uso, válido por 15 minutos.</p>
            <code style={{ fontFamily: FONT.mono, fontSize: 18, letterSpacing: 2, color: T.text }}>{codigo}</code>
          </div>
        )}
        {error && <p role="alert" style={{ color: T.alert, fontSize: 12, margin: "12px 0 0" }}>{error}</p>}
      </div>

      {equipos.length === 0 && (
        <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 30 }}>Aún no hay equipos registrados.</div>
      )}
      {[
        { clave: "activos", titulo: "Equipos activos", lista: enrolados },
        { clave: "pendientes", titulo: "Invitaciones pendientes", lista: pendientes },
      ].map(({ clave, titulo, lista }) => lista.length > 0 && (
        <section key={clave} aria-label={titulo} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: T.focusMuted, margin: "4px 0 10px" }}>
            {titulo} <span style={{ fontWeight: 500, color: T.textMut }}>({lista.length})</span>
          </div>
          <div className="admin-visual__grid">{lista.map(renderEquipo)}</div>
        </section>
      ))}
      {revocados.length > 0 && (
        <section aria-label="Equipos revocados" style={{ marginBottom: 12 }}>
          <Btn variant="ghost" onClick={() => setVerRevocados((v) => !v)}>
            {verRevocados ? "Ocultar" : "Ver"} revocados ({revocados.length})
          </Btn>
          {verRevocados && <div className="admin-visual__grid" style={{ marginTop: 10 }}>{revocados.map(renderEquipo)}</div>}
        </section>
      )}

      {revocando && (
        <Dialogo
          titulo="Revocar equipo"
          mensaje={`«${revocando.nombre}» dejará de poder marcar asistencia y tendrá que enrolarse de nuevo. El historial se conserva.`}
          confirmarLabel="Revocar"
          variante="rechazar"
          onConfirmar={revocar}
          onCancelar={() => setRevocando(null)}
        />
      )}
    </Aparecer>
  );
}
