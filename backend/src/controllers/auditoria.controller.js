const { prisma } = require('../config/database');
const { filtrosAuditoria, exportarPDF } = require('../services/auditoria.service');

const listar = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const where = filtrosAuditoria(req.query);

    const [registros, total] = await Promise.all([
      prisma.auditoria.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (+page - 1) * +limit,
        take: +limit,
        include: { usuario: { select: { nombre: true, email: true, rol: true } } },
      }),
      prisma.auditoria.count({ where }),
    ]);

    res.json({ data: registros, total, page: +page, totalPages: Math.ceil(total / +limit) });
  } catch (error) {
    next(error);
  }
};

const exportar = async (req, res, next) => {
  try {
    const pdf = await exportarPDF(req.query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="bitacora-auditoria.pdf"');
    res.send(pdf);
  } catch (error) { next(error); }
};
module.exports = { listar, exportar };
