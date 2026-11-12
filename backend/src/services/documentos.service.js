const { prisma } = require('../config/database');
const { ROLES } = require('../constants/roles');
const { registrarAuditoria } = require('../middlewares/auditLog');
const { uploadAdjuntoToAzure, generarUrlLectura } = require('../utils/azureStorage');

const TIPOS = { contrato: 'Contrato', liquidacion: 'Liquidación', os10: 'Certificado OS-10', anexo: 'Anexo', otro: 'Documento' };
const GUARDIAS = [ROLES.GGSS];
const error = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// El contenedor es privado: el cliente recibe un link temporal, nunca la URL guardada.
const publico = async ({ archivo_url, ...resto }) => ({ ...resto, url_firmada: await generarUrlLectura(archivo_url) });

/** Guardia: sus propios documentos. Administración: los de un guardia (o todos los de la empresa). */
async function listar(user, { usuario_id } = {}) {
  const where = GUARDIAS.includes(user.rol) ? { usuario_id: user.id } : (usuario_id ? { usuario_id } : {});
  const filas = await prisma.documento.findMany({
    where, orderBy: { created_at: 'desc' }, take: 200,
    include: { usuario: { select: { id: true, nombre: true } }, autor: { select: { nombre: true } } },
  });
  return Promise.all(filas.map(publico));
}

/**
 * El guardia solo sube su certificado OS-10; Administración publica cualquier tipo para un guardia
 * de su empresa (contrato, liquidación, anexo...).
 */
async function subir(user, body, archivo, contexto) {
  if (!archivo) throw error(400, 'Adjunta el archivo del documento.');
  const esGuardia = GUARDIAS.includes(user.rol);
  const tipo = esGuardia ? 'os10' : body.tipo;
  if (!TIPOS[tipo]) throw error(400, `Tipo de documento inválido. Valores permitidos: ${Object.keys(TIPOS).join(', ')}`);

  let duenio = user.id;
  if (!esGuardia) {
    duenio = String(body.usuario_id || '');
    const guardia = duenio && await prisma.usuario.findFirst({ where: { id: duenio, rol: { in: GUARDIAS } }, select: { id: true } });
    if (!guardia) throw error(400, 'Selecciona un guardia de tu empresa.');
  }
  const nombre = String(body.nombre || '').trim().slice(0, 100) || TIPOS[tipo];

  let url;
  try {
    url = await uploadAdjuntoToAzure(archivo.buffer, { usuarioId: user.id, prefijo: 'documentos' });
  } catch (err) {
    if (err.statusCode) throw err;
    throw error(503, 'No se pudo guardar el documento. Intenta nuevamente.');
  }
  const creado = await prisma.documento.create({
    data: {
      usuario_id: duenio, tipo, nombre, archivo_url: url, subido_por: user.id,
      archivo_nombre: String(archivo.originalname || 'documento').slice(0, 100),
    },
    include: { usuario: { select: { id: true, nombre: true } }, autor: { select: { nombre: true } } },
  });
  await registrarAuditoria({
    usuarioId: user.id, accion: 'subir_documento', tablaAfectada: 'documentos', registroId: creado.id,
    valoresDespues: { tipo, usuario_id: duenio }, ...contexto,
  });
  return publico(creado);
}

module.exports = { listar, subir, TIPOS };
