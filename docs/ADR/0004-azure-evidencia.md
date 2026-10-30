# ADR 0004 — Evidencia en Azure Blob con URLs firmadas

**Estado:** implementada. Las pruebas de servicio simulan Azure; no se verificó entrega contra un proveedor externo durante estos cambios.

## Contexto

Las fotos de novedades no deben depender del disco efímero del backend ni convertirse en archivos públicos permanentes. Deben poder consultarse tras verificar permisos sobre la novedad.

## Decisión

Guardar evidencia en Azure Blob Storage y persistir `foto_url` como referencia. Generar `foto_url_firmada` de lectura temporal mediante `generarUrlLectura` al serializar el listado/detalle. La configuración actual usa una vigencia de 60 minutos y contenedor privado; las credenciales viven en entorno, nunca en código.

`POST /novedades` usa multipart con `foto` opcional. En este recurso se aceptan JPEG/PNG/WebP hasta 10 MB: MIME inválido produce 400 y exceso de tamaño 413. El nombre se sanea antes de subir. La ausencia de foto permite crear; si la subida al proveedor falla, el comportamiento actual registra la novedad sin evidencia y deja un aviso.

## Alternativas y consecuencias

- Disco local evita un proveedor, pero no ofrece persistencia adecuada al reiniciar o escalar el backend.
- Imágenes dentro de PostgreSQL simplificarían una transacción única, pero aumentarían almacenamiento y tráfico de la base.
- Una URL SAS puede utilizarse por quien la posea hasta su vencimiento: no compartirla en logs, commits o documentos. Renovar mediante una nueva lectura autorizada.
- La carga al almacenamiento y la transacción PostgreSQL no son una transacción distribuida; puede requerirse limpieza de archivos huérfanos si falla la persistencia después de subir.
- Antes de habilitar un entorno real deben validarse contenedor privado, credenciales y ciclo de lectura/expiración.

## Evidencia

`backend/src/utils/azureStorage.js`, `backend/src/services/novedades.service.js`, `backend/src/routes/novedades.routes.js` y pruebas funcionales `novedades.test.js`.
