-- DropForeignKey
ALTER TABLE "Turno" DROP CONSTRAINT "Turno_usuario_id_fkey";

-- AlterTable
ALTER TABLE "Solicitud" ADD COLUMN     "vacante_turno_id" TEXT;

-- AlterTable
ALTER TABLE "Turno" ALTER COLUMN "usuario_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_vacante_turno_id_fkey" FOREIGN KEY ("vacante_turno_id") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;
