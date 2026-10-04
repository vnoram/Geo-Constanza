import { T, FONT, ROLES } from "../../theme/theme";
import { Input } from "../ui/Input";
import { Btn } from "../ui/Btn";
import { Icon } from "../ui/Icon";

export function TwoFactorStep({ code2fa, setCode2fa, error, loading, pendingUser, onVerify, onBack }) {
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 14, color: T.text }}>
          Ingresa el código de tu app authenticator
        </div>
        <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>
          Requerido para{" "}
          <span style={{ color: T.focusText }}>
            {ROLES[pendingUser?.user?.rol]?.label}
          </span>
        </div>
      </div>

      <Input
        label="Código 2FA"
        icon="key-round"
        mono
        value={code2fa}
        onChange={v => setCode2fa(v.replace(/\D/g, ""))}
        placeholder="123456"
        maxLength={6}
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

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="outline" onClick={onBack}>Volver</Btn>
        <Btn onClick={onVerify} loading={loading} full>Verificar</Btn>
      </div>

      <div style={{
        marginTop: 16, border: `1px solid ${T.border}`, borderRadius: T.radius,
        padding: "10px 12px", fontSize: 12, color: T.textSec, display: "flex", gap: 8, alignItems: "center",
      }}>
        <Icon name="info" size={15} />
        <span>Demo: usa el código <span style={{ fontFamily: FONT.mono, color: T.text }}>123456</span></span>
      </div>
    </div>
  );
}
