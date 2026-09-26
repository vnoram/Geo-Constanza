// ─── GEOCODING (OpenStreetMap / Nominatim) ───────────────────────
// Servicio gratuito y sin API key. Política de uso: máx. ~1 req/s,
// por eso los componentes que lo consumen aplican debounce.
const NOMINATIM = "https://nominatim.openstreetmap.org";

// Extrae calle + número y comuna desde el objeto `address` de Nominatim
function normalizar(item) {
  const a = item.address || {};
  const calle = [a.road || a.pedestrian || a.footway || a.name, a.house_number]
    .filter(Boolean)
    .join(" ");
  const comuna = a.city || a.town || a.village || a.municipality || a.suburb || a.county || "";
  return {
    direccion: calle || item.name || item.display_name?.split(",")[0] || "",
    comuna,
    etiqueta: item.display_name,
    latitud: parseFloat(item.lat),
    longitud: parseFloat(item.lon),
  };
}

export async function buscarDirecciones(texto, { signal } = {}) {
  const params = new URLSearchParams({
    q: texto,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "cl",
    limit: "5",
    "accept-language": "es",
  });
  const res = await fetch(`${NOMINATIM}/search?${params}`, { signal });
  if (!res.ok) throw new Error("No se pudo consultar el servicio de direcciones");
  const data = await res.json();
  return data.map(normalizar);
}

export async function direccionDesdeCoordenadas(latitud, longitud, { signal } = {}) {
  const params = new URLSearchParams({
    lat: String(latitud),
    lon: String(longitud),
    format: "jsonv2",
    addressdetails: "1",
    zoom: "18",
    "accept-language": "es",
  });
  const res = await fetch(`${NOMINATIM}/reverse?${params}`, { signal });
  if (!res.ok) throw new Error("No se pudo obtener la dirección");
  const data = await res.json();
  if (data.error) return null;
  return normalizar(data);
}
