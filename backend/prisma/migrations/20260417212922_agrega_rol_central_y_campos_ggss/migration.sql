/*
  Warnings:

  - You are about to drop the column `fechas` on the `Solicitud` table. All the data in the column will be lost.
  - Added the required column `fecha_desde` to the `Solicitud` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Solicitud` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Asistencia" ADD COLUMN     "dispositivo_usado" TEXT;

-- AlterTable
ALTER TABLE "Solicitud" DROP COLUMN "fechas",
ADD COLUMN     "fecha_desde" DATE NOT NULL,
ADD COLUMN     "fecha_hasta" DATE,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "estado" SET DEFAULT 'pendiente';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "dispositivo_principal" TEXT,
ADD COLUMN     "imei_dispositivo" TEXT,
ADD COLUMN     "instalacion_asignada_id" TEXT,
ADD COLUMN     "tipo_ggss" TEXT;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_instalacion_asignada_id_fkey" FOREIGN KEY ("instalacion_asignada_id") REFERENCES "Instalacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
