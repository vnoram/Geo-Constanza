import { useState, useCallback } from "react";
import { AuthCtx } from "./context/AuthContext";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { AppShell } from "./components/layout/AppShell";

// ═══════════════════════════════════════════════════════════════
// GEO CONSTANZA — FASE 1: AUTENTICACIÓN + PANTALLAS BASE
// Repo: github.com/geoconstanza
// Stack: React (frontend) ↔ Express API (backend)
// ═══════════════════════════════════════════════════════════════

export default function GeoConstanzaApp() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const handleLogin = useCallback((u, t) => {
    setUser(u);
    setToken(t);
    // En producción: AsyncStorage.setItem("token", t);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setToken(null);
    // En producción:
    // fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    // AsyncStorage.removeItem("token");
  }, []);

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <AuthCtx.Provider value={{ user, token, logout: handleLogout }}>
      <AppShell user={user} token={token} onLogout={handleLogout} />
    </AuthCtx.Provider>
  );
}
