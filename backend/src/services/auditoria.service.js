const PDFDocument = require('pdfkit');
const { prisma } = require('../config/database');
const { inicioDiaChile, finDiaChile } = require('../utils/fechaChile');

const filtrosAuditoria = ({ usuario_id, accion, fecha_inicio, fecha_fin }) => {
  const where = {};
  for (const [campo, valor] of Object.entries({ usuario_id, accion })) {
    if (valor !== undefined && typeof valor !== 'string') throw Object.assign(new Error(`Filtro inválido: ${campo}.`), { statusCode: 400 });
    if (valor?.trim()) where[campo] = valor.trim();
  }
  for (const fecha of [fecha_inicio, fecha_fin]) {
    if (!fecha) continue;
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(Date.parse(fecha)) || new Date(fecha).toISOString().slice(0, 10) !== fecha) {
      throw Object.assign(new Error('Las fechas deben ser días válidos YYYY-MM-DD.'), { statusCode: 400 });
    }
  }
  if (fecha_inicio && fecha_fin && fecha_inicio > fecha_fin) throw Object.assign(new Error('La fecha inicial debe ser anterior a la final.'), { statusCode: 400 });
  if (fecha_inicio || fecha_fin) {
    where.created_at = {};
    if (fecha_inicio) where.created_at.gte = inicioDiaChile(fecha_inicio);
    if (fecha_fin) where.created_at.lte = finDiaChile(fecha_fin);
  }
  return where;
};

const exportarPDF = async (query) => {
  const where = filtrosAuditoria(query);
  const registros = await prisma.auditoria.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
    select: { id: true, created_at: true, accion: true, tabla_afectada: true, registro_id: true, ip_address: true,
      usuario: { select: { nombre: true } },
    },
  });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: 'Bitácora de auditoría — Geo Constanza' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk)); doc.on('error', reject); doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.fontSize(18).text('Geo Constanza');
    doc.fontSize(14).text('Bitácora de auditoría');
    doc.moveDown().fontSize(9).text(`Usuario: ${query.usuario_id || 'Todos'} | Acción: ${query.accion || 'Todas'}`);
    doc.text(`Fechas: ${query.fecha_inicio || 'Sin inicio'} a ${query.fecha_fin || 'Sin fin'} (hora de Chile)`);
    doc.text(`Registros: ${registros.length}`).moveDown();
    if (!registros.length) doc.text('Sin registros para los filtros seleccionados.');
    for (const registro of registros) {
      const fecha = new Date(registro.created_at).toLocaleString('es-CL', { timeZone: 'America/Santiago', hour12: false });
      doc.font('Helvetica-Bold').fontSize(10).text(`${fecha} — ${registro.accion}`);
      doc.font('Helvetica').fontSize(9).text(`Usuario: ${registro.usuario?.nombre || 'Sin usuario'} | Tabla: ${registro.tabla_afectada}`);
      doc.text(`Registro: ${registro.registro_id} | IP: ${registro.ip_address || 'Sin IP'}`);
      doc.text(`Auditoría: ${registro.id}`).moveDown(0.7);
    }
    doc.end();
  });
};
module.exports = { filtrosAuditoria, exportarPDF };
