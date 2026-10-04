import { useState } from "react";
import { T, FONT } from "../../theme/theme";
import { Input } from "../../components/ui/Input";
import { Btn } from "../../components/ui/Btn";
import { Icon } from "../../components/ui/Icon";
import { Wordmark } from "../../components/ui/Wordmark";
import { DemoPanel } from "../../components/auth/DemoPanel";
import { TwoFactorStep } from "../../components/auth/TwoFactorStep";
import { useLoginForm } from "../../hooks/useLoginForm";

export function LoginScreen({ onLogin }) {
  const [showDemo, setShowDemo] = useState(false);

  const {
    rut, pass, setPass, error, loading,
    step, code2fa, setCode2fa, pendingUser,
    locked, lockTime, lockLabel,
    formatRut, handleLogin, handle2FA, resetTo2FA,
  } = useLoginForm({ onLogin });

  return (
    <div className="login">
      {/* Marca: panel lateral callado, solo en pantallas anchas */}
      <aside className="login__brand">
        <Wordmark size={18} markSize={28} />
        <div>
          <p style={{ margin: 0, fontSize: 14, color: T.textSec, maxWidth: 280 }}>
            Plataforma de gestión operacional
          </p>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: T.textMut, fontFamily: FONT.mono }}>
            v1.0
          </p>
        </div>
      </aside>

      <main className="login__panel">
        <div className="login__form">
          <div className="login__mobile-mark"><Wordmark /></div>

          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, color: T.text, letterSpacing: "-0.01em", fontFamily: FONT.ui }}>
            {step === "login" ? "Iniciar sesión" : "Verificación de seguridad"}
          </h1>
          <p style={{ margin: "0 0 22px", fontSize: 13, color: T.textSec }}>
            {step === "login" ? "Ingresa con tu RUT" : "Segundo paso de autenticación"}
          </p>

          {step === "login" && (
            <div>
              <Input label="RUT" icon="id-card" mono value={rut} onChange={formatRut} placeholder="12345678-9" maxLength={12} />
              <Input label="Contraseña" type="password" icon="key-round" value={pass} onChange={setPass} placeholder="••••••••" />

              {error && (
                <div role="alert" style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  background: T.alertGhost, border: `1px solid ${T.alert}`,
                  borderRadius: T.radius, padding: "10px 12px", marginBottom: 16,
                  fontSize: 13, color: T.text,
                }}>
                  <Icon name="circle-alert" size={17} color={T.alert} style={{ marginTop: 1 }} />
                  <div>
                    {error}
                    {locked && (
                      <div style={{ marginTop: 4, fontFamily: FONT.mono, fontSize: 12, color: T.textSec }}>
                        Desbloqueo en: {lockLabel}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Btn onClick={handleLogin} loading={loading} disabled={locked} full>
                {locked ? `Bloqueado (${lockLabel})` : "Iniciar sesión"}
              </Btn>

              <div style={{ marginTop: 18 }}>
                <button
                  onClick={() => setShowDemo(v => !v)}
                  aria-expanded={showDemo}
                  className="login__demo-toggle"
                >
                  <Icon name={showDemo ? "chevron-down" : "chevron-right"} size={14} />
                  Credenciales de demostración
                </button>
              </div>

              {showDemo && (
                <DemoPanel onSelect={(rut, pwd) => { formatRut(rut); setPass(pwd); }} />
              )}
            </div>
          )}

          {step === "2fa" && (
            <TwoFactorStep
              code2fa={code2fa}
              setCode2fa={setCode2fa}
              error={error}
              loading={loading}
              pendingUser={pendingUser}
              onVerify={handle2FA}
              onBack={resetTo2FA}
            />
          )}

          <div className="login__footer">Geo Constanza v1.0 · Fase 1 · Abril 2026</div>
        </div>
      </main>
    </div>
  );
}
