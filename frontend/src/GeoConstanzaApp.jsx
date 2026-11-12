import { useEffect, useState } from "react";
import { leerSesion } from "./services/almacenSesion";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ConfirmarInvitacionDispositivo } from "./screens/auth/ConfirmarInvitacionDispositivo";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { Enroll2FAScreen } from "./screens/auth/Enroll2FAScreen";
import { ResetPasswordScreen } from "./screens/auth/ResetPasswordScreen";
import { AppShell } from "./components/layout/AppShell";

// ═══════════════════════════════════════════════════════════════
// GEO CONSTANZA — FASE 1: AUTENTICACIÓN + PERSISTENCIA DE SESIÓN
// ═══════════════════════════════════════════════════════════════

// AppRouter decide qué renderizar según el estado de autenticación.
// Espera a `ready` para que AuthProvider restaure la sesión desde
// localStorage antes de mostrar cualquier pantalla.
function invitacionDelFragmento() {
  const ruta = "#/enrolar?";
  return window.location.hash.startsWith(ruta)
    ? new URLSearchParams(window.location.hash.slice(ruta.length)).get("t")
    : null;
}

function AppRouter() {
  const { user, token, login, logout, ready } = useAuth();
  const [invitacion, setInvitacion] = useState(invitacionDelFragmento);
  const [confirmada, setConfirmada] = useState(false);

  useEffect(() => {
    const actualizar = () => {
      setInvitacion(invitacionDelFragmento());
      setConfirmada(false);
    };
    window.addEventListener("hashchange", actualizar);
    return () => window.removeEventListener("hashchange", actualizar);
  }, []);
  const limpiarFragmento = () => window.history.replaceState(null, "", window.location.pathname + window.location.search);
  const cancelarInvitacion = () => {
    limpiarFragmento();
    setInvitacion(null);
    setConfirmada(false);
  };
  // /restablecer?token=... llega desde el correo; sin token es la solicitud del enlace.
  const [restablecer, setRestablecer] = useState(() => window.location.pathname === "/restablecer");
  const volverAlLogin = () => {
    window.history.replaceState(null, "", "/");
    setRestablecer(false);
    if (user) logout();      // el enlace era de otra persona: cierra la sesión que estaba abierta
  };

  if (!ready) return null;   // Evita flash de /login durante la hidratación

  // El enlace del correo manda aunque ya haya una sesión abierta en este navegador.
  if (restablecer && (!user || new URLSearchParams(window.location.search).get("token"))) {
    const tokenUrl = new URLSearchParams(window.location.search).get("token");
    const esInvitacion = new URLSearchParams(window.location.search).get("invitacion") === "1";
    return <ResetPasswordScreen token={tokenUrl} invitacion={esInvitacion} onBack={volverAlLogin} />;
  }

  if (invitacion && !confirmada) {
    return <ConfirmarInvitacionDispositivo token={invitacion} onCancelar={cancelarInvitacion} onConfirmar={() => {
      limpiarFragmento();
      if (user) logout();
      setConfirmada(true);
    }} />;
  }

  if (!user) {
    return <LoginScreen invitacion={invitacion} onCancelarInvitacion={cancelarInvitacion}
      onLogin={(...sesion) => { if (invitacion) cancelarInvitacion(); login(...sesion); }}
      onForgot={() => setRestablecer(true)} />;
  }

  if (user.mustEnroll2FA) {
    const { mustEnroll2FA, ...usuario } = user; // eslint-disable-line no-unused-vars
    return <Enroll2FAScreen onDone={() => login({ ...usuario, segundoFactor: true }, leerSesion("gc_token") || token)} onLogout={logout} />;
  }

  return <AppShell user={user} token={token} onLogout={logout} />;
}

export default function GeoConstanzaApp() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
