import { useState } from "react";
import { T } from "../../theme/theme";
import { GlowOrb } from "../../components/ui/GlowOrb";
import { Input } from "../../components/ui/Input";
import { Btn } from "../../components/ui/Btn";
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
    <div style={{
      minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center",
      justifyContent: "center", padding: 20, fontFamily: "'Outfit', sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />

      <GlowOrb x="-10%" y="10%" color={T.accentGlow} size={400} />
      <GlowOrb x="70%" y="60%" color="rgba(108,155,255,0.1)" size={350} />
      <GlowOrb x="30%" y="80%" color="rgba(185,140,255,0.06)" size={300} />

      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: `radial-gradient(circle at 1px 1px, ${T.border}22 1px, transparent 0)`,
        backgroundSize: "40px 40px", pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 380 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: step === "login" ? 36 : 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${T.accent}, ${T.accentDim})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, boxShadow: `0 8px 32px ${T.accentGlow}`,
          }}>🛡️</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: T.text, letterSpacing: -0.5 }}>
            Geo Constanza
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: T.textMut }}>
            {step === "login" ? "Plataforma de Gestión Operacional" : "Verificación de Seguridad"}
          </p>
        </div>

        {/* Login Form */}
        {step === "login" && (
          <div style={{
            background: `${T.bgCard}CC`, backdropFilter: "blur(20px)",
            border: `1px solid ${T.border}`, borderRadius: 20, padding: 28,
          }}>
            <Input label="RUT" icon="🪪" value={rut} onChange={formatRut} placeholder="12345678-9" maxLength={12} />
            <Input label="Contraseña" type="password" icon="🔒" value={pass} onChange={setPass} placeholder="••••••••" />

            {error && (
              <div style={{
                background: T.redGhost, border: `1px solid ${T.red}33`,
                borderRadius: 10, padding: "10px 14px", marginBottom: 16,
                fontSize: 12, color: T.red, fontWeight: 500,
              }}>
                ⚠️ {error}
                {locked && (
                  <div style={{ marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                    Desbloqueo en: {lockLabel}
                  </div>
                )}
              </div>
            )}

            <Btn onClick={handleLogin} loading={loading} disabled={locked} full>
              {locked ? `Bloqueado (${lockLabel})` : "Iniciar Sesión"}
            </Btn>

            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                onClick={() => setShowDemo(v => !v)}
                style={{
                  background: "none", border: "none", color: T.textMut, fontSize: 12,
                  cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                  textDecoration: "underline", textUnderlineOffset: 3,
                }}
              >
                {showDemo ? "Ocultar credenciales demo" : "Ver credenciales demo"}
              </button>
            </div>

            {showDemo && (
              <DemoPanel onSelect={(rut, pwd) => { formatRut(rut); setPass(pwd); }} />
            )}
          </div>
        )}

        {/* 2FA Step */}
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

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: T.textMut }}>
          Geo Constanza v1.0 · Fase 1 · Abril 2026
        </div>
      </div>
    </div>
  );
}
