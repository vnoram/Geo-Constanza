# components/maps/

Reservado para los componentes de mapa en tiempo real del panel de Operador
Central (Leaflet), ej. `MapaOperativo.jsx`, `MarcadorGuardia.jsx`. Aún no
implementados.

## Implementados

- `MapaUbicacion.jsx` — mapa selector con pin arrastrable y geocerca (radio)
  en vivo. Click en el mapa o arrastrar el pin emite `onCambio(lat, lng)`.
  Usado en el modal de crear/editar instalación.
- `DireccionAutocomplete.jsx` — campo de dirección con sugerencias de
  geocoding (OpenStreetMap / Nominatim, ver `services/geocoding.js`).
