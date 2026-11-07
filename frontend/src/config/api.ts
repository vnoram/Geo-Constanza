// La URL del backend se define al compilar con VITE_API_URL (producción incluida).
// Sin ella: en desarrollo se usa el backend local; en producción se usa el mismo origen
// (útil si un proxy inverso sirve /api/v1 junto al frontend) y se avisa en consola.
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");
const defaultBackendUrl = import.meta.env.PROD ? window.location.origin : "http://localhost:3005";
if (import.meta.env.PROD && !configuredApiUrl) {
  console.warn("VITE_API_URL no está definida: se usará el mismo origen del frontend como backend.");
}

export const API_URL = configuredApiUrl
  ? (configuredApiUrl.endsWith("/api/v1") ? configuredApiUrl : `${configuredApiUrl}/api/v1`)
  : `${defaultBackendUrl}/api/v1`;

export const BACKEND_URL = API_URL.replace(/\/api\/v1$/, "");
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL?.trim().replace(/\/$/, "") || BACKEND_URL;
