export const API_URL = 
  import.meta.env.VITE_API_URL 
    ? `${import.meta.env.VITE_API_URL}/api/v1`
    : "http://localhost:3005/api/v1";