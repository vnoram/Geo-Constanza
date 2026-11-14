import { useCallback, useEffect, useState } from "react";
import { T, FONT } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Badge } from "../../components/ui/Badge";
import { Dialogo } from "../../components/ui/Dialogo";
import { Icon } from "../../components/ui/Icon";
import { KPI } from "../../components/ui/KPI";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";

const ESTADOS = {
  enrolado: { texto: "Enrolado", color: "accent" },
  pendiente: { texto: "Invitación enviada", color: "yellow" },
  vencido: { texto: "Invitación vencida", color: "yellow" },
  revocado: { texto: "Revocado", color: "red" },
};
const fecha = (iso) => (iso ? new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "—");

// Equipo principal de cada empresa: la plataforma invita por correo al administrador de gestión,
// que lo enrola y luego invita los demás equipos desde su propio panel.
export function PlataformaDispositivos() {
  const [empresas, setEmpresas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState("");
  const [enlace, setEnlace] = useState(null); // { empresa, enlace } cuando el correo no salió
  const [revocando, setRevocando] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setEmpresas((await api.get("/plataforma/dispositivos")) ?? []);
      setError("");
    } catch (e) {
      setError(e.message || "No se pudo cargar la lista.");
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const invitar = async (empresa) => {
    setError(""); setAviso(""); setEnlace(null);
    setEnviando(empresa.id);
    try {
      const r = await api.post(`/plataforma/empresas/${empresa.id}/dispositivos/invitacion`, { nombre: "Equipo principal" });
      if (r.correoEnviado) setAviso(`Invitación enviada a ${r.administrador.email}. Vence en 15 minutos.`);
      else setEnlace({ empresa: empresa.nombre, enlace: r.enlace });
      await cargar();
    } catch (e) {
      setError(e.message || "No se pudo enviar la invitación.");
    } finally {
      setEnviando("");
    }
  };

  const revocar = async () => {
    const { empresa, equipo, deshabilitar } = revocando;
    await api.patch(`/plataforma/empresas/${empresa.id}/dispositivos/${equipo.id}/revocar`, {});
    setRevocando(null);
    setAviso(revocando.secundario ? "Equipo revocado." : deshabilitar ? "Equipo principal deshabilitado. Ya puedes invitar otro." : "Invitación cancelada.");
    await cargar();
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(enlace.enlace); setAviso("Enlace copiado."); }
    catch { setError("Selecciona y copia el enlace manualmente."); }
  };

  const vivos = empresas.flatMap((e) => e.equipos);
  const enrolados = vivos.filter((q) => q.estado === "enrolado").length;
  const pendientes = vivos.filter((q) => q.estado === "pendiente").length;
  const conPrincipal = empresas.filter((e) => e.equipos.some((q) => q.principal && q.estado === "enrolado")).length;
  const card = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 16, marginBottom: 10 };

  return (
    <div className="gc-audited-screen">
      <SectionHeader title="Dispositivos" sub="Equipo principal de cada empresa. El administrador de gestión enrola los demás desde su panel." />
      {aviso && <div role="status" style={{ border: `1px solid ${T.accent}`, background: T.accentGhost, color: T.accent, borderRadius: T.radius, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{aviso}</div>}
      {error && <div role="alert" style={{ border: `1px solid ${T.alert}`, background: T.alertGhost, color: T.text, borderRadius: T.radius, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {enlace && (
        <div style={{ ...card, borderColor: T.accent }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>No se pudo enviar el correo a {enlace.empresa}. Entrega este enlace al administrador (vence en 15 minutos):</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 12, wordBreak: "break-all", marginBottom: 10 }}>{enlace.enlace}</div>
          <Btn variant="outline" onClick={copiar}>Copiar enlace</Btn>
        </div>
      )}
      {!cargando && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <KPI label="Con equipo principal" value={`${conPrincipal}/${empresas.length}`} sub="empresas" accent={T.accent} />
          <KPI label="Equipos enrolados" value={enrolados} sub="en toda la plataforma" />
          <KPI label="Invitaciones pendientes" value={pendientes} sub="esperando al administrador" accent={pendientes ? T.yellow : undefined} />
        </div>
      )}
      {cargando ? <div style={{ color: T.textMut, fontSize: 13, padding: 24 }}>Cargando…</div> : empresas.map((empresa) => {
        const activa = empresa.estado === "activa";
        const visibles = empresa.equipos.filter((q) => q.estado !== "revocado" && q.estado !== "vencido");
        const principal = visibles.find((q) => q.principal && q.estado === "enrolado");
        const pendiente = visibles.find((q) => q.principal && q.estado === "pendiente");
        const motivo = !activa ? "Empresa suspendida" : !empresa.administrador ? "Sin administrador activo" : "";
        return (
          <section key={empresa.id} aria-label={empresa.nombre} style={{ ...card, padding: 0, marginBottom: 18, overflow: "hidden" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: 16, borderBottom: `1px solid ${T.border}` }}>
              <Icon name="building-2" size={22} color={T.focusText} />
              <div style={{ flex: 1, minWidth: "min(100%, 220px)", overflowWrap: "anywhere" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{empresa.nombre}</span>
                  {!activa && <Badge color="red">Suspendida</Badge>}
                  {!principal && activa && <Badge color="yellow">Sin equipo principal</Badge>}
                </div>
                <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>
                  {empresa.administrador ? `${empresa.administrador.nombre} · ${empresa.administrador.email}` : "Sin administrador activo"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {motivo ? <span style={{ fontSize: 12, color: T.textMut }}>{motivo}</span> : !principal && (
                  <Btn variant="morado" loading={enviando === empresa.id} onClick={() => invitar(empresa)}>
                    {pendiente ? "Reenviar correo" : "Enviar invitación"}
                  </Btn>
                )}
                {principal && <Btn variant="rechazar" onClick={() => setRevocando({ empresa, equipo: principal, deshabilitar: true })}>Deshabilitar principal</Btn>}
                {pendiente && <Btn variant="rechazar" onClick={() => setRevocando({ empresa, equipo: pendiente })}>Cancelar invitación</Btn>}
              </div>
            </div>
            {visibles.length === 0 ? (
              <div style={{ padding: "12px 16px", fontSize: 12, color: T.textMut }}>Sin equipos registrados.</div>
            ) : visibles.map((q) => (
              <div key={q.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: `1px solid ${T.border}` }}>
                <Icon name="monitor" size={16} color={q.estado === "enrolado" ? T.focusText : T.textMut} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{q.nombre}</span>
                <Badge color={ESTADOS[q.estado].color}>{ESTADOS[q.estado].texto}</Badge>
                {q.principal && <Badge color="focus">Principal</Badge>}
                <span style={{ fontSize: 12, color: T.textSec }}>
                  {[q.destinatario?.nombre, q.instalacion, q.estado === "enrolado" ? `último uso ${fecha(q.ultimo_uso)}` : null].filter(Boolean).join(" · ")}
                </span>
                {!q.principal && (
                  <Btn variant="rechazar" style={{ marginLeft: "auto", minHeight: 30, fontSize: 12 }}
                    onClick={() => setRevocando({ empresa, equipo: q, secundario: true })}>Revocar</Btn>
                )}
              </div>
            ))}
          </section>
        );
      })}
      {revocando && (
        <Dialogo titulo={revocando.deshabilitar ? "Deshabilitar equipo principal" : revocando.secundario ? "Revocar equipo" : "Cancelar invitación"} variante="rechazar" confirmarLabel={revocando.deshabilitar ? "Deshabilitar" : revocando.secundario ? "Revocar" : "Cancelar invitación"}
          mensaje={revocando.deshabilitar
            ? `«${revocando.equipo.nombre}» de ${revocando.empresa.nombre} dejará de ser válido: sus sesiones se cortan y el administrador no podrá entrar hasta enrolar otro equipo principal.`
            : revocando.secundario
              ? `«${revocando.equipo.nombre}» de ${revocando.empresa.nombre} dejará de ser válido y sus sesiones se cortan. El historial de marcajes se conserva.`
              : `«${revocando.equipo.nombre}» de ${revocando.empresa.nombre} quedará sin efecto y el enlace enviado dejará de funcionar.`}
          onConfirmar={revocar} onCancelar={() => setRevocando(null)} />
      )}
    </div>
  );
}
