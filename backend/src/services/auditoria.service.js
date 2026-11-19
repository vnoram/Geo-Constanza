const PDFDocument = require('pdfkit');
const { prisma } = require('../config/database');
const { TABLAS, TIPOS, describir } = require('../utils/auditoriaEtiquetas');
const { inicioDiaChile, finDiaChile } = require('../utils/fechaChile');

const filtrosAuditoria = ({ usuario_id, accion, fecha_inicio, fecha_fin }) => {
  const where = {};
  for (const [campo, valor] of Object.entries({ usuario_id, accion })) {
    if (valor !== undefined && typeof valor !== 'string') throw Object.assign(new Error(`Filtro inválido: ${campo}.`), { statusCode: 400 });
    if (valor?.trim()) where[campo] = valor.trim();
  }
  // Varias acciones separadas por coma (filtro por tipo en la pantalla).
  if (where.accion?.includes(',')) where.accion = { in: where.accion.split(',').map(x => x.trim()).filter(Boolean).slice(0, 50) };
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
  // Con filtro de usuario, todas las filas son suyas: se toma el nombre de la primera (sin otra consulta).
  const usuarioFiltrado = query.usuario_id ? (registros[0]?.usuario?.nombre ?? 'Usuario seleccionado') : null;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: 'Bitácora de auditoría — Geo Constanza' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk)); doc.on('error', reject); doc.on('end', () => resolve(Buffer.concat(chunks)));

    const VERDE = '#14532D', GRIS = '#6B7280', TEXTO = '#111827', ZEBRA = '#F3F4F6', LINEA = '#E5E7EB';
    const COLOR_CATEGORIA = { gestion: '#15803D', equipos: '#6D28D9', seguridad: '#B45309', acceso: '#6B7280' };
    const X = 40, ANCHO = 515, COLS = { fecha: 40, accion: 128, usuario: 300, ip: 455 };
    const FIN_PAGINA = 842 - 60;
    const fechaChile = (d) => {
      const p = Object.fromEntries(new Intl.DateTimeFormat('es-CL', {
        timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(new Date(d)).map(x => [x.type, x.value]));
      return `${p.day}-${p.month}-${p.year} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
    };

    // Encabezado del documento
    doc.rect(0, 0, 595, 74).fill(VERDE);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('Geo Constanza', X, 22);
    doc.font('Helvetica').fontSize(11).text('Bitácora de auditoría', X, 48);
    doc.font('Helvetica').fontSize(9).text(`Generada el ${fechaChile(new Date())} (hora de Chile)`, X, 30, { width: ANCHO, align: 'right' });

    // Resumen de filtros
    const tipo = TIPOS[query.tipo] ?? (query.accion ? 'Acción filtrada' : 'Todo');
    const desde = query.fecha_inicio || 'sin inicio', hasta = query.fecha_fin || 'sin fin';
    doc.fillColor(TEXTO);
    const resumen = [['Tipo', tipo], ['Usuario', usuarioFiltrado || 'Todos'], ['Período', `${desde} a ${hasta}`], ['Registros', String(registros.length)]];
    let y = 92, x = X;
    for (const [etiqueta, valor] of resumen) {
      doc.font('Helvetica').fontSize(8).fillColor(GRIS).text(etiqueta.toUpperCase(), x, y, { width: 120 });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXTO).text(valor, x, y + 11, { width: 120 });
      x += 130;
    }
    y += 40;

    const encabezadoTabla = () => {
      doc.rect(X, y, ANCHO, 20).fill(VERDE);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
      doc.text('FECHA', COLS.fecha + 6, y + 6); doc.text('ACCIÓN', COLS.accion, y + 6);
      doc.text('USUARIO', COLS.usuario, y + 6); doc.text('IP', COLS.ip, y + 6);
      y += 24;
    };
    encabezadoTabla();

    if (!registros.length) doc.font('Helvetica').fontSize(10).fillColor(GRIS).text('Sin registros para los filtros seleccionados.', X, y + 6);
    registros.forEach((r, i) => {
      if (y + 32 > FIN_PAGINA) { doc.addPage(); y = 48; encabezadoTabla(); }
      const { texto, categoria } = describir(r.accion);
      if (i % 2 === 0) doc.rect(X, y - 3, ANCHO, 31).fill(ZEBRA);
      doc.circle(COLS.fecha + 2, y + 5, 2.5).fill(COLOR_CATEGORIA[categoria]);
      doc.fillColor(TEXTO).font('Helvetica').fontSize(9).text(fechaChile(r.created_at), COLS.fecha + 8, y, { width: 82, lineBreak: false });
      doc.font('Helvetica-Bold').text(texto, COLS.accion, y, { width: 165, lineBreak: false, ellipsis: true });
      doc.font('Helvetica').text(r.usuario?.nombre || 'Sistema', COLS.usuario, y, { width: 150, lineBreak: false, ellipsis: true });
      doc.text(r.ip_address || '—', COLS.ip, y, { width: 100, lineBreak: false });
      doc.fillColor(GRIS).fontSize(7.5).text(`${TABLAS[r.tabla_afectada] ?? r.tabla_afectada} · ${r.registro_id ?? '—'}`, COLS.accion, y + 14, { width: 420, lineBreak: false });
      y += 31;
    });

    // Pie con numeración
    const { count } = doc.bufferedPageRange();
    for (let i = 0; i < count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // el pie va dentro del margen: sin esto pdfkit abriría páginas nuevas
      doc.moveTo(X, 842 - 44).lineTo(X + ANCHO, 842 - 44).strokeColor(LINEA).lineWidth(0.5).stroke();
      doc.fillColor(GRIS).font('Helvetica').fontSize(8).text('Geo Constanza · Bitácora de auditoría', X, 842 - 36, { width: ANCHO / 2, lineBreak: false });
      doc.text(`Página ${i + 1} de ${count}`, X + ANCHO / 2, 842 - 36, { width: ANCHO / 2, align: 'right', lineBreak: false });
    }
    doc.end();
  });
};
module.exports = { filtrosAuditoria, exportarPDF };
