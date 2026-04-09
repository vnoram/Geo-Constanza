// src/services/dashboard.service.js

const { prisma } = require('../config/database');

/**
 * Métricas analíticas y de resumen para el panel de control (Dashboard).
 */
const generarMetricasGenerales = async () => {
    return {
        guardias_activos: await prisma.usuario.count({ where: { rol: 'pauta', estado: 'activo' } }),
        instalaciones: await prisma.instalacion.count(),
        asistencias_hoy: await prisma.asistencia.count(),
        novedades_rojas: await prisma.novedad.count({ where: { urgencia: 'rojo', estado: 'abierta' } })
    };
};

module.exports = {
    generarMetricasGenerales
};