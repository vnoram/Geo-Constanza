import { useEffect, useState } from "react";
import { T } from "../../theme/theme";
import { Input } from "../ui/Input";
import { Btn } from "../ui/Btn";
import { Icon } from "../ui/Icon";

export function TwoFactorStep({ code2fa, setCode2fa, error, loading, onVerify, onBack, email2FA, resendAt, resends, onResend }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!email2FA) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [email2FA]);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 14, color: T.text }}>
          {email2FA ? "Ingresa el código que enviamos a tu correo" : "Ingresa el código de tu app authenticator"}
        </div>
        <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>
          {email2FA ? "El desafío vence 10 minutos después de iniciar sesión." : "También puedes usar un código de recuperación"}
        </div>
      </div>

      <Input
        label="Código 2FA"
        icon="key-round"
        mono
        value={code2fa}
        onChange={v => setCode2fa(email2FA ? v.replace(/\D/g, "").slice(0, 6) : v.replace(/[^0-9a-zA-Z-]/g, "").toUpperCase())}
        placeholder="123456"
        maxLength={email2FA ? 6 : 11}
        inputMode={email2FA ? "numeric" : undefined}
        autoComplete={email2FA ? "one-time-code" : undefined}
      />

      {error && (
        <div role="alert" style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          background: T.alertGhost, border: `1px solid ${T.alert}`, borderRadius: T.radius,
          padding: "10px 12px", marginBottom: 16, fontSize: 13, color: T.text,
        }}>
          <Icon name="circle-alert" size={17} color={T.alert} style={{ marginTop: 1 }} />
          <div>{error}</div>
        </div>
      )}

      <div className="admin-actions" style={{ display: "flex", gap: 10 }}>
        <Btn variant="outline" onClick={onBack}>Volver</Btn>
        <Btn onClick={onVerify} loading={loading} full>Verificar</Btn>
      </div>
      {email2FA && (
        <div style={{ marginTop: 12 }}>
          <Btn variant="outline" onClick={onResend} disabled={loading || remaining > 0 || resends >= 3}>
            {resends >= 3 ? "Límite de reenvíos alcanzado" : `Reenviar código${remaining > 0 ? ` (${remaining} s)` : ""}`}
          </Btn>
        </div>
      )}

    </div>
  );
}
