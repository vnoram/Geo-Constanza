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

const semana = async (req, res, next) => {
  try {
    const result = await reportesService.novedadesPorSemana();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const estadoHoy = async (req, res, next) => {
  try {
    const result = await reportesService.estadoGuardias();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const mensual = async (req, res, next) => {
  try {
    const mes  = parseInt(req.query.mes,  10) || (new Date().getMonth() + 1);
    const anio = parseInt(req.query.anio, 10) || new Date().getFullYear();
    const result = await reportesService.resumenMensual(mes, anio);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const exportar = async (req, res, next) => {
  try {
    const { tipo } = req.params;

    if (tipo === 'csv' || tipo === 'excel') {
      const buffer = await reportesService.exportarCSV(req.query, req.user);
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename=reporte_geo_constanza.csv');
      return res.send(buffer);
    }

    // PDF se genera en el cliente — el backend solo devuelve el JSON necesario
    if (tipo === 'pdf') {
      const [asistencias, novedades] = await Promise.all([
        reportesService.reporteAsistencia(req.query, req.user),
        reportesService.reporteIncidentes(req.query, req.user),
      ]);
      return res.json({ asistencias, novedades });
    }

    res.status(400).json({ error: 'Tipo de exportación no válido. Use: csv, excel, pdf' });
  } catch (error) {
    next(error);
  }
};

module.exports = { asistencia, incidentes, semana, estadoHoy, mensual, exportar };
