// OpenStreetMap oficial sin API keys ni marcas de agua
export const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export const MAP_TILE_OPTIONS = {
  maxZoom: 19,
  subdomains: ["a", "b", "c"],
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  className: "gc-dark-tile",
};

// Aliases para retrocompatibilidad
export const CARTO_TILE_URL = MAP_TILE_URL;
export const CARTO_TILE_OPTIONS = MAP_TILE_OPTIONS;
