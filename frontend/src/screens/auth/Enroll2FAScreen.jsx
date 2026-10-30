import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { T, FONT } from "../../theme/theme";
import { Input } from "../../components/ui/Input";
import { Btn } from "../../components/ui/Btn";
import { Icon } from "../../components/ui/Icon";
import { Wordmark } from "../../components/ui/Wordmark";
import { api } from "../../services/api";

// Enrolamiento obligatorio del segundo factor (supervisor y administrador).
// Paso 1: escanear el QR y confirmar un código. Paso 2: guardar los códigos de recuperación.
export function Enroll2FAScreen({ onDone, onLogout }) {
  const [paso, setPaso] = useState("qr"); // "qr" | "codigos"
  const [setup, setSetup] = useState(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [codigos, setCodigos] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [guardados, setGuardados] = useState(false);

  useEffect(() => {
    let vivo = true;
    api.setup2FA()
      .then(async (data) => {
        if (!vivo) return;
        setSetup(data);
        setQr(await QRCode.toDataURL(data.otpauth_url, { margin: 1, width: 220 }));
      })
      .catch((err) => vivo && setError(err.message));
    return () => { vivo = false; };
  }, []);

  const confirmar = async () => {
    setError("");
    if (code.length !== 6) { setError("Ingrese el código de 6 dígitos"); return; }
    setLoading(true);
    try {
      const res = await api.enable2FA(code);
      setCodigos(res.codigos_recuperacion || []);
      setPaso("codigos");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const copiar = () => navigator.clipboard?.writeText(codigos.join("\n"));
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([codigos.join("\n") + "\n"], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = "geo-constanza-codigos-recuperacion.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  const alerta = error && (
    <div role="alert" style={{
      display: "flex", gap: 10, alignItems: "flex-start", background: T.alertGhost,
      border: `1px solid ${T.alert}`, borderRadius: T.radius, padding: "10px 12px",
      marginBottom: 16, fontSize: 13, color: T.text,
    }}>
      <Icon name="circle-alert" size={17} color={T.alert} style={{ marginTop: 1 }} />
      <div>{error}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: T.bg }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ marginBottom: 20 }}><Wordmark /></div>

        {paso === "qr" && (
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.text, margin: "0 0 6px", fontFamily: FONT.ui }}>
              Activa la verificación en dos pasos
            </h1>
            <p style={{ fontSize: 13, color: T.textSec, margin: "0 0 16px" }}>
              Tu rol la exige. Escanea el código con una app authenticator y escribe el código de 6 dígitos.
            </p>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              {qr
                ? <img src={qr} alt="Código QR para la app authenticator" width={220} height={220} style={{ background: "#fff", borderRadius: T.radius }} />
                : <div style={{ height: 220, display: "flex", alignItems: "center", color: T.textMut, fontSize: 13 }}>Generando código QR…</div>}
            </div>
            {setup && (
              <p style={{ fontSize: 12, color: T.textSec, margin: "0 0 16px", wordBreak: "break-all" }}>
                ¿No puedes escanear? Clave manual:{" "}
                <span style={{ fontFamily: FONT.mono, color: T.text }}>{setup.secreto}</span>
              </p>
            )}
            <Input label="Código de la app" icon="key-round" mono value={code}
              onChange={v => setCode(v.replace(/\D/g, ""))} placeholder="123456" maxLength={6} />
            {alerta}
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="secondary" onClick={onLogout}>Salir</Btn>
              <Btn onClick={confirmar} loading={loading} disabled={!setup} full>Activar</Btn>
            </div>
          </div>
        )}

        {paso === "codigos" && (
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.text, margin: "0 0 6px", fontFamily: FONT.ui }}>
              Guarda tus códigos de recuperación
            </h1>
            <p style={{ fontSize: 13, color: T.textSec, margin: "0 0 16px" }}>
              Cada código sirve una sola vez si pierdes tu teléfono. No se volverán a mostrar.
            </p>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 12, marginBottom: 12,
              border: `1px solid ${T.border}`, borderRadius: T.radius, fontFamily: FONT.mono, fontSize: 14, color: T.text,
            }}>
              {codigos.map(c => <span key={c}>{c}</span>)}
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <Btn variant="secondary" icon="clipboard-list" onClick={copiar}>Copiar</Btn>
              <Btn variant="secondary" icon="download" onClick={descargar}>Descargar</Btn>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: T.text, marginBottom: 16 }}>
              <input type="checkbox" checked={guardados} onChange={e => setGuardados(e.target.checked)} />
              Ya guardé mis códigos en un lugar seguro
            </label>
            <Btn onClick={onDone} disabled={!guardados} full>Continuar</Btn>
          </div>
        )}
      </div>
    </div>
  );
}
