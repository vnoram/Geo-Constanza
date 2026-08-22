const PRODUCTION_BACKEND_URL = "https://geo-constanza-production.up.railway.app";
const defaultBackendUrl = import.meta.env.PROD ? PRODUCTION_BACKEND_URL : "http://localhost:3005";
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");

export const API_URL = configuredApiUrl
  ? (configuredApiUrl.endsWith("/api/v1") ? configuredApiUrl : `${configuredApiUrl}/api/v1`)
  : `${defaultBackendUrl}/api/v1`;

export const BACKEND_URL = API_URL.replace(/\/api\/v1$/, "");
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL?.trim().replace(/\/$/, "") || BACKEND_URL;
