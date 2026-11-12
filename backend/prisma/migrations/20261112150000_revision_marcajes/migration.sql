ALTER TABLE "Asistencia"
  ADD COLUMN "revisado_por" TEXT,
  ADD COLUMN "revisado_en" TIMESTAMP(3),
  ADD COLUMN "comentario_revision" TEXT,
  ADD COLUMN "revision_estado" TEXT CHECK ("revision_estado" IN ('aprobado', 'rechazado'));
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_empresa_id_revisado_por_fkey"
  FOREIGN KEY ("empresa_id", "revisado_por") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
