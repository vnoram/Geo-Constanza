// ─── API CONFIG ───
export const API_BASE = "https://api.geoconstanza.cl/api/v1"; // Cambiar a tu URL

// ─── SIMULATED API SERVICE ───
// En producción, estas funciones hacen fetch real al backend Express
export const api = {
  login: async (rut, password) => {
    // SIMULACIÓN — reemplazar con fetch real:
    // const res = await fetch(`${API_BASE}/auth/login`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ rut, password }),
    // });
    // return res.json();

    await new Promise(r => setTimeout(r, 1200));
    const users = {
      "20570418-3": { id: "u1", nombre: "Víctor Norambuena", rol: "pauta", token: "jwt_pauta_mock" },
      "19234567-8": { id: "u2", nombre: "María López", rol: "libre", token: "jwt_libre_mock" },
      "15678901-2": { id: "u3", nombre: "Andrés Martínez", rol: "supervisor", token: "jwt_sup_mock" },
      "12812223-0": { id: "u4", nombre: "Christian González", rol: "admin", token: "jwt_admin_mock" },
    };
    const u = users[rut];
    if (!u || password !== "geo2026") throw new Error("Credenciales inválidas");
    return { user: u, token: u.token, refreshToken: "refresh_" + u.token };
  },

  verify2FA: async (code) => {
    await new Promise(r => setTimeout(r, 800));
    if (code === "123456") return { verified: true };
    throw new Error("Código 2FA inválido");
  },

  getProfile: async (token) => {
    await new Promise(r => setTimeout(r, 400));
    return { lastLogin: "2026-04-09T06:00:00Z", sessionsActive: 1 };
  },
};
