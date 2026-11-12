import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import { guardarDeviceToken } from "../services/dispositivos";
import { T } from "../theme/theme";
import { Btn } from "../components/ui/Btn";
import { SectionHeader } from "../components/ui/SectionHeader";

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

  const aceptar = async (inv) => {
    if (!window.confirm(`¿Registrar este equipo como corporativo («${inv.nombre}»)?`)) return;
    setError(""); setAviso(""); setOcupado(true);
    try {
      const { token } = await api.post(`/dispositivos/${inv.id}/aceptar`, {});
      guardarDeviceToken(token);
      setAviso("Equipo registrado como corporativo. Cierra sesión y vuelve a entrar para aplicarlo.");
    } catch (err) { setError(err.message); }
    finally { setOcupado(false); cargar(); }
  };

  return (
    <div>
      <SectionHeader title="Dispositivos" sub="Equipos corporativos" />
      <p style={{ color: T.textSec, fontSize: 13 }}>
        Equipo actual: {user.dispositivo === "corporativo" ? "corporativo" : "sin registrar"}.
      </p>
      {aviso && <p role="status" style={{ color: T.accent }}>{aviso}</p>}
      {error && <p role="alert" style={{ color: T.red }}>{error}</p>}
      {invitaciones.length === 0
        ? <p style={{ color: T.textMut, fontSize: 13 }}>No tienes invitaciones pendientes. Pídele a un administrador que te invite desde su panel de Dispositivos.</p>
        : invitaciones.map(inv => (
          <div key={inv.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
            <span>{inv.nombre}{inv.instalacion ? ` · ${inv.instalacion.nombre}` : ""}</span>
            <span style={{ color: T.textMut, fontSize: 12 }}>vence {new Date(inv.invitacion_expira_en).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>
            <Btn disabled={ocupado} onClick={() => aceptar(inv)}>Aceptar en este equipo</Btn>
          </div>
        ))}
    </div>
  );
}
