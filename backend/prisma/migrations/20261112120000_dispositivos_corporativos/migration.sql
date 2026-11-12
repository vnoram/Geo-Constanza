CREATE TABLE "Dispositivo" (
  "id" TEXT PRIMARY KEY,
  "empresa_id" TEXT NOT NULL REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "nombre" TEXT NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'corporativo' CHECK ("tipo" = 'corporativo'),
  "codigo_enrolamiento_hash" TEXT UNIQUE,
  "codigo_expira_en" TIMESTAMP(3),
  "token_hash" TEXT UNIQUE,
  "estado" TEXT NOT NULL DEFAULT 'activo' CHECK ("estado" IN ('activo', 'revocado')),
  "creado_por" TEXT NOT NULL,
  "ultimo_uso" TIMESTAMP(3),
  CONSTRAINT "Dispositivo_empresa_id_creado_por_fkey" FOREIGN KEY ("empresa_id", "creado_por") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Dispositivo_empresa_id_idx" ON "Dispositivo"("empresa_id");
