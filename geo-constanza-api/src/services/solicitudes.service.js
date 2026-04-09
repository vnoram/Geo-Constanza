// src/services/solicitudes.service.js

const { prisma } = require('../config/database');

/**
 * Lógica de negocio para las Solicitudes (Vacaciones, Permisos, etc.)
 */
const getAllSolicitudes = async () => {
    return await prisma.solicitud.findMany();
};

module.exports = {
    getAllSolicitudes
};