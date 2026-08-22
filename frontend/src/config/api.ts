const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");

export const API_URL = configuredApiUrl
  ? (configuredApiUrl.endsWith("/api/v1") ? configuredApiUrl : `${configuredApiUrl}/api/v1`)
  : "http://localhost:3005/api/v1";
