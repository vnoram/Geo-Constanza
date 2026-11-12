CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "archivo_url" TEXT NOT NULL,
    "archivo_nombre" TEXT,
    "subido_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Documento_empresa_id_usuario_id_idx" ON "Documento"("empresa_id", "usuario_id");

ALTER TABLE "Documento" ADD CONSTRAINT "Documento_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_empresa_id_usuario_id_fkey"
  FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_empresa_id_subido_por_fkey"
  FOREIGN KEY ("empresa_id", "subido_por") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
