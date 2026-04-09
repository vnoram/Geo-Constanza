// src/services/priorizacion.service.js

/**
 * Servicio encargado de determinar la urgencia y priorización 
 * de las novedades reportadas.
 */

const evaluarUrgencia = (tipoNovedad, descripcion) => {
    // TODO: Implementar lógica de palabras clave o matriz de riesgos
    // Retornamos "verde" por defecto de momento. (verde, amarillo, rojo)
    return 'verde';
};

module.exports = {
    evaluarUrgencia
};
