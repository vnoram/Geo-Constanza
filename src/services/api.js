const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3005/api/v1";

export const api = {
  login: async (rut, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Credenciales inválidas");
    // El backend devuelve { usuario, accessToken, refreshToken }
    // Lo normalizamos al formato que espera el frontend
    return {
      user: data.usuario,
      token: data.accessToken,
      refreshToken: data.refreshToken,
    };
  },

  verify2FA: async (code) => {
    await new Promise(r => setTimeout(r, 800));
    if (code === "123456") return { verified: true };
    throw new Error("Código 2FA inválido");
  },

  getProfile: async (token) => {
    const res = await fetch(`${API_BASE}/usuarios/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  },
};
