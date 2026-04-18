// src/services/priorizacion.service.js

/**
 * Servicio encargado de determinar la urgencia y priorización
 * de las novedades reportadas.
 *
 * Niveles: 'rojo' > 'amarillo' > 'verde'
 */

// Matriz de riesgo: tipo de novedad → urgencia base
const MATRIZ_URGENCIA = {
  // ── ROJO: Amenaza inmediata a personas o propiedad ─────────────
  'Robo':                 'rojo',
  'Robo en progreso':     'rojo',
  'Intrusión':            'rojo',
  'Incendio':             'rojo',
  'Agresión':             'rojo',
  'Emergencia médica':    'rojo',

  // ── AMARILLO: Anomalía que requiere atención ────────────────────
  'Falla técnica':        'amarillo',
  'Puerta abierta':       'amarillo',
  'Acceso no autorizado': 'amarillo',
  'Vandalismo':           'amarillo',
  'Alarma activada':      'amarillo',
  'Mantenimiento':        'amarillo',

  // ── VERDE: Novedad informativa o rutinaria ──────────────────────
  'Ronda':                'verde',
  'Sin novedad':          'verde',
  'Fin de ronda':         'verde',
  'Cambio de turno':      'verde',
};

/**
 * Evalúa la urgencia de una novedad basado en su tipo.
 * Si el tipo no está en la matriz, retorna 'amarillo' como precaución.
 *
 * @param {string} tipoNovedad - Tipo de novedad (ej: 'Robo', 'Ronda')
 * @returns {'rojo'|'amarillo'|'verde'} Nivel de urgencia
 */
const evaluarUrgencia = (tipoNovedad) => {
  if (!tipoNovedad) return 'amarillo';
  return MATRIZ_URGENCIA[tipoNovedad] ?? 'amarillo';
};

module.exports = {
  evaluarUrgencia,
};
