import { useState } from "react";
import { T, FONT } from "../../theme/theme";
import { Input } from "../../components/ui/Input";
import { Btn } from "../../components/ui/Btn";
import { Icon } from "../../components/ui/Icon";
import arteLogin from "../../assets/login-ilustracion.webp";
import { DemoPanel } from "../../components/auth/DemoPanel";
import { TwoFactorStep } from "../../components/auth/TwoFactorStep";
import { useLoginForm } from "../../hooks/useLoginForm";

// Credenciales de demostración: solo en desarrollo o si se pide explícitamente al compilar.
const MOSTRAR_DEMO = import.meta.env.DEV || import.meta.env.VITE_MOSTRAR_DEMO === "true";

// Guía del enrolamiento: se muestra cuando el login llega desde el enlace de invitación.
function PasosEnrolamiento() {
  const pasos = [
    { icono: "circle-check", titulo: "Enlace confirmado", detalle: "Tu invitación es válida.", hecho: true },
    { icono: "key-round", titulo: "Inicia sesión", detalle: "Con la cuenta a la que se invitó este equipo." },
    { icono: "monitor", titulo: "Equipo registrado", detalle: "Este navegador quedará como equipo corporativo." },
  ];
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radius, background: T.bgCard, padding: "12px 14px", marginBottom: 18 }}>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
        {pasos.map((p, i) => (
          <li key={p.titulo} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span aria-hidden="true" style={{
              flex: "none", width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
              border: `1px solid ${p.hecho ? T.accent : T.border}`, background: p.hecho ? T.accentGhost : "transparent",
            }}><Icon name={p.icono} size={15} color={p.hecho ? T.accent : T.focusText} /></span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{i + 1}. {p.titulo}</div>
              <div style={{ fontSize: 12, color: T.textSec }}>{p.detalle}</div>
            </div>
          </li>
        ))}
      </ol>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.textMut }}>
        <Icon name="clock" size={13} /> El enlace vence a los 15 minutos y se usa una sola vez.
      </div>
    </div>
  );
}

export function LoginScreen({ onLogin, onForgot, invitacion, onCancelarInvitacion }) {
  const [showDemo, setShowDemo] = useState(false);

  const {
    rut, pass, setPass, error, loading,
    step, code2fa, setCode2fa,
    locked, lockLabel,
    formatRut, handleLogin, handle2FA, resetTo2FA,
    email2FA, resendAt, resends, handleResend,
  } = useLoginForm({ onLogin, invitacion });
  const enrolando = !!invitacion;

  return (
    <div className="login">
      {/* Marca: panel lateral callado, solo en pantallas anchas */}
      <aside className="login__brand">
        {/* Ilustración decorativa: la imagen se ve completa en el panel */}
        <img className="login__art" src={arteLogin} alt="" aria-hidden="true" />
        <div className="login__art-tint" aria-hidden="true" />
        <div />
        <div>
          <p style={{ margin: 0, fontSize: 14, color: T.textSec, maxWidth: 280 }}>
            {enrolando ? "Registro de equipo corporativo" : "Plataforma de gestión operacional"}
          </p>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: T.textMut, fontFamily: FONT.mono }}>
            v1.1
          </p>
        </div>
      </aside>

      <main className="login__panel">
        <div className="login__form">
          <div className="login__head">
            <div className="login__head-text">
              <div>
                <h1 className="login__title" style={{ fontSize: 22, fontWeight: 600, color: T.text, letterSpacing: "-0.01em", fontFamily: FONT.ui }}>
                  {step === "login" ? (enrolando ? "Enrolar equipo" : "Iniciar sesión") : "Verificación de seguridad"}
                </h1>
                <p className="login__sub" style={{ fontSize: 13, color: T.textSec }}>
                  {step === "login" ? (enrolando ? "Registra este equipo como corporativo" : "Ingresa con tu RUT") : (enrolando ? "Un último paso para enrolar el equipo" : "Segundo paso de autenticación")}
                </p>
              </div>
            </div>
            {/* Solo celular y tablet: en pantallas anchas la ilustración va en el panel lateral */}
            <div className="login__thumb" aria-hidden="true">
              <img className="login__thumb-img" src={arteLogin} alt="" />
              <div className="login__art-tint" />
            </div>
          </div>

          {step === "login" && (
            <div>
              {enrolando && <PasosEnrolamiento />}
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
                {locked ? `Bloqueado (${lockLabel})` : enrolando ? "Iniciar sesión y enrolar equipo" : "Iniciar sesión"}
              </Btn>

              {onForgot && !enrolando && (
                <div style={{ marginTop: 14, textAlign: "center" }}>
                  <button onClick={onForgot} className="login__demo-toggle">
                    <Icon name="key-round" size={14} />
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              {invitacion && <Btn variant="outline" onClick={onCancelarInvitacion} disabled={loading} full style={{ marginTop: 10 }}>Cancelar enrolamiento</Btn>}

              {MOSTRAR_DEMO && !enrolando && (
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
              )}

              {MOSTRAR_DEMO && !enrolando && showDemo && (
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
              onVerify={handle2FA}
              onBack={resetTo2FA}
              email2FA={email2FA}
              resendAt={resendAt}
              resends={resends}
              onResend={handleResend}
            />
          )}

          <div className="login__footer">Geo Constanza v1.1 · Noviembre 2026</div>
        </div>
      </main>
    </div>
  );
}
