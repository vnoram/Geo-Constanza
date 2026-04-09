const reportesService = require('../services/reportes.service');

const asistencia = async (req, res, next) => {
  try {
    const result = await reportesService.reporteAsistencia(req.query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const incidentes = async (req, res, next) => {
  try {
    const result = await reportesService.reporteIncidentes(req.query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const exportar = async (req, res, next) => {
  try {
    const { tipo } = req.params; // pdf o excel
    const buffer = await reportesService.exportar(tipo, req.query, req.user);

    const contentType = tipo === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const ext = tipo === 'pdf' ? 'pdf' : 'xlsx';

    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `attachment; filename=reporte.${ext}`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = { asistencia, incidentes, exportar };
