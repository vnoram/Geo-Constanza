import { T, ROLES } from "../../theme/theme";
import { Input } from "../ui/Input";
import { Btn } from "../ui/Btn";

export function TwoFactorStep({ code2fa, setCode2fa, error, loading, pendingUser, onVerify, onBack }) {
  return (
    <div style={{
      background: `${T.bgCard}CC`, backdropFilter: "blur(20px)",
      border: `1px solid ${T.border}`, borderRadius: 20, padding: 28,
    }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
        <div style={{ fontSize: 14, color: T.textSec }}>
          Ingresa el código de tu app authenticator
        </div>
        <div style={{ fontSize: 11, color: T.textMut, marginTop: 4 }}>
          Requerido para{" "}
          <span style={{ color: ROLES[pendingUser?.user?.rol]?.color }}>
            {ROLES[pendingUser?.user?.rol]?.label}
          </span>
        </div>
      </div>

      <Input
        label="Código 2FA"
        icon="🔑"
        value={code2fa}
        onChange={v => setCode2fa(v.replace(/\D/g, ""))}
        placeholder="123456"
        maxLength={6}
      />

      {error && (
        <div style={{
          background: T.redGhost, borderRadius: 10, padding: "10px 14px",
          marginBottom: 16, fontSize: 12, color: T.red,
        }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onBack}>← Volver</Btn>
        <Btn onClick={onVerify} loading={loading} full>Verificar</Btn>
      </div>

      <div style={{
        marginTop: 16, background: T.yellowGhost, borderRadius: 10,
        padding: 12, fontSize: 11, color: T.yellow,
      }}>
        💡 Demo: usa el código{" "}
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>123456</span>
      </div>
    </div>
  );
}
