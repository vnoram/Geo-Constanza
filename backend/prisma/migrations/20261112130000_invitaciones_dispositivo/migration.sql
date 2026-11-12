ALTER TABLE "Dispositivo"
  ADD COLUMN "invitado_usuario_id" TEXT,
  ADD COLUMN "enrolado_por" TEXT,
  ADD COLUMN "invitacion_hash" TEXT,
  ADD COLUMN "invitacion_expira_en" TIMESTAMP(3);

CREATE UNIQUE INDEX "Dispositivo_invitacion_hash_key" ON "Dispositivo"("invitacion_hash");
ALTER TABLE "Dispositivo"
  ADD CONSTRAINT "Dispositivo_empresa_id_invitado_usuario_id_fkey"
    FOREIGN KEY ("empresa_id", "invitado_usuario_id") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Dispositivo_empresa_id_enrolado_por_fkey"
    FOREIGN KEY ("empresa_id", "enrolado_por") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
