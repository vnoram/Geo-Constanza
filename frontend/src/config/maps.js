const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY || "cb1_3yse_1_0c334a4ba6e46f0dc7c9e6a6";

export const CARTO_TILE_URL = `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?api_key=${CARTO_API_KEY}`;

export const CARTO_TILE_OPTIONS = {
  maxZoom: 19,
  subdomains: "abcd",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
};
