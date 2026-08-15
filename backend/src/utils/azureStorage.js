/**
 * Módulo mejorado para subida segura de archivos a Azure Blob Storage
 *
 * Características:
 * - Validación completa de entrada
 * - Manejo robusto de errores
 * - Logging detallado
 * - Reintentos automáticos
 * - Timeout configurable
 * - Seguridad mejorada
 *
 * @module utils/azureStorage
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const { logger } = require('../config/logger');

// Configuraciones
const CONFIG = {
  MAX_FILE_SIZE_MB: 50,
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30000,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
};

/**
 * Valida que las variables de entorno necesarias estén configuradas
 * @throws {Error} Si falta configuración crítica
 */
function validarConfiguracion() {
  const required = ['AZURE_STORAGE_CONNECTION_STRING', 'AZURE_STORAGE_CONTAINER_NAME'];

  for (const key of required) {
    if (!process.env[key]) {
      const error = new Error(`Variable de entorno "${key}" no está configurada`);
      error.code = 'CONFIG_ERROR';
      throw error;
    }
  }
}

/**
 * Valida el buffer de archivo
 * @param {Buffer} buffer - Buffer del archivo
 * @param {string} mimetype - Tipo MIME del archivo
 * @param {number} filesize - Tamaño del archivo en bytes
 * @throws {Error} Si la validación falla
 */
function validarArchivo(buffer, mimetype, filesize) {
  // ✅ Validar que es un Buffer
  if (!buffer || !Buffer.isBuffer(buffer)) {
    const error = new Error('El archivo debe ser un Buffer válido');
    error.code = 'INVALID_BUFFER';
    throw error;
  }

  // ✅ Validar tipo MIME
  if (!CONFIG.ALLOWED_TYPES.includes(mimetype)) {
    const error = new Error(
      `Tipo de archivo no permitido. Acepta: ${CONFIG.ALLOWED_TYPES.join(', ')}`
    );
    error.code = 'INVALID_TYPE';
    error.statusCode = 400;
    throw error;
  }

  // ✅ Validar tamaño
  const maxBytes = CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (filesize > maxBytes) {
    const error = new Error(
      `Archivo supera el tamaño máximo de ${CONFIG.MAX_FILE_SIZE_MB}MB (${filesize} bytes)`
    );
    error.code = 'FILE_TOO_LARGE';
    error.statusCode = 413;
    throw error;
  }

  // ✅ Validar que no esté vacío
  if (filesize === 0) {
    const error = new Error('El archivo está vacío');
    error.code = 'EMPTY_FILE';
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Sanitiza nombre de archivo para evitar problemas de seguridad
 * @param {string} originalName - Nombre original
 * @returns {string} Nombre sanitizado
 */
function sanitizarNombre(originalName) {
  const ext = originalName.split('.').pop().toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `novedades-${timestamp}-${random}.${ext}`;
}

/**
 * Intenta una subida a Azure con reintentos automáticos
 * @private
 */
async function intentarSubida(blockBlobClient, buffer, uploadOptions, intento = 1) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    try {
      await blockBlobClient.upload(buffer, buffer.length, {
        ...uploadOptions,
        abortSignal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const esRecuperable =
      error.code === 'REQUEST_SEND_ERROR' ||
      error.code === 'TIMEOUT' ||
      (error.statusCode && error.statusCode >= 500);

    if (esRecuperable && intento < CONFIG.MAX_RETRIES) {
      const espera = Math.pow(2, intento) * 1000; // Backoff exponencial
      logger.warn(`🔄 Reintentando subida (intento ${intento}/${CONFIG.MAX_RETRIES}) en ${espera}ms`, {
        nombreArchivo: blockBlobClient.name,
        error: error.message,
      });

      await new Promise(resolve => setTimeout(resolve, espera));
      return intentarSubida(blockBlobClient, buffer, uploadOptions, intento + 1);
    }

    throw error;
  }
}

/**
 * Sube una foto a Azure Blob Storage con validaciones completas
 *
 * @async
 * @param {Buffer} fotoBuffer - Buffer de la imagen
 * @param {string} nombreArchivo - Nombre original del archivo
 * @param {Object} metadata - Metadatos adicionales (opcional)
 * @returns {Promise<string>} URL pública del blob en Azure
 * @throws {Error} Si hay problemas con validación, Azure o red
 */
async function uploadFotoToAzure(fotoBuffer, nombreArchivo, metadata = {}) {
  const startTime = Date.now();

  try {
    validarConfiguracion();

    if (!nombreArchivo || typeof nombreArchivo !== 'string') {
      const error = new Error('nombreArchivo debe ser una cadena no vacía');
      error.code = 'INVALID_NAME';
      error.statusCode = 400;
      throw error;
    }

    validarArchivo(fotoBuffer, metadata.mimetype || 'image/jpeg', fotoBuffer.length);

    const nombreSanitizado = sanitizarNombre(nombreArchivo);

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(nombreSanitizado);

    const uploadOptions = {
      metadata: {
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'geo-constanza-api',
        originalName: nombreArchivo.substring(0, 100),
        usuarioId: metadata.usuarioId || 'unknown',
        tipo: metadata.tipo || 'documento',
      },
      blobHTTPHeaders: {
        blobContentType: metadata.mimetype || 'image/jpeg',
      },
    };

    await intentarSubida(blockBlobClient, fotoBuffer, uploadOptions);

    const blobUrl = blockBlobClient.url;
    const duracion = Date.now() - startTime;

    logger.info(`✅ Foto subida a Azure exitosamente`, {
      nombreArchivo: nombreSanitizado,
      url: blobUrl,
      tamanio: `${(fotoBuffer.length / 1024).toFixed(2)} KB`,
      duracion: `${duracion}ms`,
      usuarioId: metadata.usuarioId,
    });

    return blobUrl;
  } catch (error) {
    const duracion = Date.now() - startTime;

    logger.error(`❌ Error al subir foto a Azure`, {
      nombreArchivo,
      tamanio: fotoBuffer ? `${(fotoBuffer.length / 1024).toFixed(2)} KB` : 'n/a',
      duracion: `${duracion}ms`,
      error: error.message,
      codigo: error.code,
      statusCode: error.statusCode,
      usuarioId: metadata.usuarioId,
    });

    const errEnriquecido = new Error(
      `No se pudo subir archivo a Azure Storage: ${error.message}`
    );
    errEnriquecido.statusCode = error.statusCode || 500;
    errEnriquecido.originalError = error;
    errEnriquecido.code = error.code;

    throw errEnriquecido;
  }
}

/**
 * Obtiene las propiedades de un blob (útil para verificar existencia)
 */
async function obtenerPropiedadesBlob(nombreArchivo) {
  try {
    validarConfiguracion();

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(nombreArchivo);

    return await blockBlobClient.getProperties();
  } catch (error) {
    logger.error(`Error obteniendo propiedades del blob: ${nombreArchivo}`, {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Elimina un blob de Azure Storage
 */
async function eliminarBlob(nombreArchivo) {
  try {
    validarConfiguracion();

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(nombreArchivo);

    await blockBlobClient.delete();
    logger.info(`Blob eliminado: ${nombreArchivo}`);
  } catch (error) {
    logger.error(`Error al eliminar blob: ${nombreArchivo}`, {
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  uploadFotoToAzure,
  obtenerPropiedadesBlob,
  eliminarBlob,
  CONFIG,
};
