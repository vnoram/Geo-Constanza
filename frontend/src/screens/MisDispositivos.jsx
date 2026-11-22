import "./ggss-libre/LibreVisual.css";
import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import { guardarDeviceToken } from "../services/dispositivos";
import { FONT, T } from "../theme/theme";
import { Badge } from "../components/ui/Badge";
import { Icon } from "../components/ui/Icon";
import { Btn } from "../components/ui/Btn";
import { Dialogo } from "../components/ui/Dialogo";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Aviso } from "../components/ui/Aviso";

/** Invitaciones de equipo dirigidas al usuario (supervisor / operador central). */
export function MisDispositivos({ user }) {
  const [invitaciones, setInvitaciones] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try { setInvitaciones(await api.get("/dispositivos/mis-invitaciones")); }
    catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const [porAceptar, setPorAceptar] = useState(null);
  const aceptar = async (inv) => {
    setPorAceptar(null);
    setError(""); setAviso(""); setOcupado(true);
    try {
      const { token } = await api.post(`/dispositivos/${inv.id}/aceptar`, {});
      guardarDeviceToken(token);
      setAviso("Equipo registrado como corporativo. Cierra sesión y vuelve a entrar para aplicarlo.");
    } catch (err) { setError(err.message); }
    finally { setOcupado(false); cargar(); }
  };

  const corporativo = user.dispositivo === "corporativo";
  const tarjeta = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 16 };
  const etiqueta = { fontSize: 12, color: T.textSec, marginBottom: 10 };
  const banner = { display: "flex", alignItems: "center", gap: 8, borderRadius: T.radius, padding: "10px 14px", marginBottom: 12, fontSize: 13 };

  return (
    <div className="gc-audited-screen libre-visual libre-dispositivos">
      {porAceptar && (
        <Dialogo titulo="Registrar este equipo" mensaje={`Este equipo quedará registrado como corporativo («${porAceptar.nombre}»).`} confirmarLabel="Registrar equipo"
          onConfirmar={() => aceptar(porAceptar)} onCancelar={() => setPorAceptar(null)} />
      )}
      <SectionHeader title="Dispositivos" sub="Equipos corporativos" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12, marginBottom: 16 }}>
        <div className="libre-dispositivo__resumen" style={tarjeta}>
          <div style={etiqueta}>Este equipo</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name={corporativo ? "monitor" : "smartphone"} size={26} color={corporativo ? T.accent : T.textMut} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{corporativo ? "Dispositivo corporativo" : "Sin registrar"}</div>
            </div>
          </div>
        </div>
        <div className="libre-dispositivo__resumen" style={tarjeta}>
          <div style={etiqueta}>Invitaciones pendientes</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="key-round" size={26} color={invitaciones.length > 0 ? T.focusText : T.textMut} />
            <div style={{ fontSize: 28, fontWeight: 500, fontFamily: FONT.mono, color: invitaciones.length > 0 ? T.focusText : T.text, lineHeight: 1 }}>{invitaciones.length}</div>
          </div>
        </div>
      </div>

      <Aviso mensaje={aviso} />
      {error && (
        <div role="alert" style={{ ...banner, color: T.red, background: T.redGhost, border: `1px solid ${T.red}` }}>
          <Icon name="circle-alert" size={16} /> {error}
        </div>
      )}

      <div style={{ fontWeight: 800, fontSize: 14, color: T.focusMuted, margin: "4px 0 10px" }}>
        Invitaciones {invitaciones.length > 0 && <span style={{ fontWeight: 500, color: T.textMut }}>({invitaciones.length})</span>}
      </div>
      {invitaciones.length === 0 ? (
        <div style={{ ...tarjeta, textAlign: "center", padding: "28px 16px" }}>
          <Icon name="key-round" size={28} color={T.textMut} />
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>Sin invitaciones pendientes</div>
          <div style={{ fontSize: 12, color: T.textMut, marginTop: 4 }}>Pídele a un administrador que te invite desde su panel de Dispositivos.</div>
        </div>
      ) : invitaciones.map(inv => (
        <div className="libre-dispositivo__invitacion" key={inv.id} style={{ ...tarjeta, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <Icon name="monitor" size={22} color={T.focusText} />
          <div style={{ flex: 1, minWidth: "min(100%, 180px)", overflowWrap: "anywhere" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{inv.nombre}</span>
              {inv.instalacion && <Badge color="accent">{inv.instalacion.nombre}</Badge>}
            </div>
            <div style={{ fontSize: 12, color: T.textMut, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name="clock" size={13} /> vence {new Date(inv.invitacion_expira_en).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <Btn variant="morado" disabled={ocupado} onClick={() => setPorAceptar(inv)}>Aceptar en este equipo</Btn>
        </div>
      ))}
    </div>
  );
}
