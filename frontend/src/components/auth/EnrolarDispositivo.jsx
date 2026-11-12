import { useState } from "react";
import { api } from "../../services/api";
import { guardarDeviceToken } from "../../services/dispositivos";
import { Input } from "../ui/Input";
import { Btn } from "../ui/Btn";

export function EnrolarDispositivo() {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [enrolado, setEnrolado] = useState(false);

  const canjear = async () => {
    setError("");
    setOcupado(true);
    try {
      const { token } = await api.canjearDispositivo(codigo.trim());
      guardarDeviceToken(token);
      setCodigo("");
      setEnrolado(true);
      setAbierto(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <Btn variant="outline" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>Usar código manual de enrolamiento</Btn>
      {abierto && <>
        <Input label="Código de enrolamiento" value={codigo} onChange={setCodigo} maxLength={24} mono />
        <Btn onClick={canjear} loading={ocupado} disabled={codigo.trim().length !== 24}>Canjear código</Btn>
      </>}
      {enrolado && <p role="status">Dispositivo enrolado. Ya puedes iniciar sesión.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
