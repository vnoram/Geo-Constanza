import { Aparecer } from "../../components/ui/Aparecer";
import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { Btn } from "../../components/ui/Btn";
import { T } from "../../theme/theme";

export function ConfirmarInvitacionDispositivo({ token, onConfirmar, onCancelar }) {
  const [empresa, setEmpresa] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    api.confirmarInvitacionDispositivo(token)
      .then(datos => { if (vigente) setEmpresa(datos.empresa); })
      .catch(err => { if (vigente) setError(err.message); });
    return () => { vigente = false; };
  }, [token]);

  return (
    <Aparecer elemento="main" className="gc-invitacion" style={{ maxWidth: 480, margin: "48px auto", padding: 20, color: T.text }}>
      <h1 className="fluid-title" style={{ color: T.focusText }}>Enrolar equipo corporativo</h1>
      {empresa && <p>Este equipo será registrado como corporativo de {empresa}.</p>}
      {error && <p role="alert" style={{ color: T.alert }}>{error}</p>}
      {!empresa && !error && <p role="status">Comprobando la invitación…</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Btn onClick={onConfirmar} disabled={!empresa}>Confirmar</Btn>
        <Btn onClick={onCancelar} variant="outline">Cancelar</Btn>
      </div>
    </Aparecer>
  );
}
