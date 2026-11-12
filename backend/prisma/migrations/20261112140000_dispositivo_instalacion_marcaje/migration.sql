ALTER TABLE "Dispositivo" ADD COLUMN "instalacion_id" TEXT;
ALTER TABLE "Asistencia" ADD COLUMN "dispositivo_id" TEXT;
CREATE UNIQUE INDEX "Dispositivo_empresa_id_id_key" ON "Dispositivo"("empresa_id", "id");
ALTER TABLE "Dispositivo" ADD CONSTRAINT "Dispositivo_empresa_id_instalacion_id_fkey"
  FOREIGN KEY ("empresa_id", "instalacion_id") REFERENCES "Instalacion"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_empresa_id_dispositivo_id_fkey"
  FOREIGN KEY ("empresa_id", "dispositivo_id") REFERENCES "Dispositivo"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
