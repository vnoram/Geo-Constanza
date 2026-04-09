/**
 * Servicio de Validación Geográfica - Geo Constanza
 */

// Función interna: Calcula la distancia en metros entre dos puntos GPS
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radio de la Tierra en metros (constante fundamental)
  
  // Convertir grados a radianes
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  // Fórmula de Haversine
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanciaMetros = R * c;
  return distanciaMetros;
}

/**
 * Valida si un guardia está dentro del radio permitido de la instalación
 * @param {number} latGuardia - Latitud del celular del guardia
 * @param {number} lonGuardia - Longitud del celular del guardia
 * @param {number} latInstalacion - Latitud del punto de marcaje (ej. Portería)
 * @param {number} lonInstalacion - Longitud del punto de marcaje
 * @param {number} radioPermitido - Metros de holgura (por defecto 50 metros)
 * @returns {object} Objeto con el resultado de la validación
 */
function validarAsistencia(latGuardia, lonGuardia, latInstalacion, lonInstalacion, radioPermitido = 50) {
  const distancia = calcularDistancia(latGuardia, lonGuardia, latInstalacion, lonInstalacion);
  
  return {
    esValido: distancia <= radioPermitido,
    distanciaMetros: Math.round(distancia),
    mensaje: distancia <= radioPermitido 
      ? `Marcaje válido. Guardia a ${Math.round(distancia)}m (Límite: ${radioPermitido}m).`
      : `Marcaje rechazado. Guardia muy lejos: a ${Math.round(distancia)}m (Límite: ${radioPermitido}m).`
  };
}

// Exportamos las funciones para usarlas en los controladores
module.exports = {
  calcularDistancia,
  validarAsistencia
};