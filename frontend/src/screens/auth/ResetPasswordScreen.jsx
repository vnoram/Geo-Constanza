import { useState } from "react";
import { T, FONT } from "../../theme/theme";
import { Input } from "../../components/ui/Input";
import { Btn } from "../../components/ui/Btn";
import { Icon } from "../../components/ui/Icon";
import { Wordmark } from "../../components/ui/Wordmark";
import { api } from "../../services/api";

const PASSWORD_MIN = 10;

// Sin token: pide el correo. Con token (enlace del correo): define la nueva contraseña.
export function ResetPasswordScreen({ token, onBack }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [hecho, setHecho] = useState(false);
  const [loading, setLoading] = useState(false);

  const solicitar = async () => {
    setError("");
    if (!email.trim()) { setError("Ingrese su correo"); return; }
    setLoading(true);
    try {
      const res = await api.requestPasswordReset(email.trim());
      setMensaje(res.message);
      setHecho(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const confirmar = async () => {
    setError("");
    if (pass.length < PASSWORD_MIN) { setError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`); return; }
    if (pass !== pass2) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true);
    try {
      const res = await api.confirmPasswordReset(token, pass);
      setMensaje(res.message);
      setHecho(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const titulo = hecho ? (token ? "Contraseña actualizada" : "Revisa tu correo")
    : token ? "Nueva contraseña" : "Restablecer contraseña";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: T.bg }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ marginBottom: 20 }}><Wordmark /></div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: T.text, margin: "0 0 6px", fontFamily: FONT.ui }}>{titulo}</h1>

        {hecho ? (
          <div>
            <p style={{ fontSize: 13, color: T.textSec, margin: "0 0 18px" }}>{mensaje}</p>
            <Btn onClick={onBack} icon="arrow-left" full>Volver a iniciar sesión</Btn>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: T.textSec, margin: "0 0 18px" }}>
              {token
                ? "Elige una contraseña nueva de al menos 10 caracteres."
                : "Ingresa el correo de tu cuenta y te enviaremos un enlace válido por 30 minutos."}
            </p>
            {token ? (
              <>
                <Input label="Nueva contraseña" type="password" icon="key-round" value={pass} onChange={setPass} />
                <Input label="Repetir contraseña" type="password" icon="key-round" value={pass2} onChange={setPass2} />
              </>
            ) : (
              <Input label="Correo" icon="id-card" value={email} onChange={setEmail} placeholder="nombre@empresa.cl" />
            )}
            {error && (
              <div role="alert" style={{
                display: "flex", gap: 10, alignItems: "flex-start", background: T.alertGhost,
                border: `1px solid ${T.alert}`, borderRadius: T.radius, padding: "10px 12px",
                marginBottom: 16, fontSize: 13, color: T.text,
              }}>
                <Icon name="circle-alert" size={17} color={T.alert} style={{ marginTop: 1 }} />
                <div>{error}</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="secondary" onClick={onBack}>Cancelar</Btn>
              <Btn onClick={token ? confirmar : solicitar} loading={loading} full>
                {token ? "Cambiar contraseña" : "Enviar enlace"}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
