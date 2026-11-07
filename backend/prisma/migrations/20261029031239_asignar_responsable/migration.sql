-- AlterTable
ALTER TABLE "Novedad" ADD COLUMN     "asignada_a" TEXT;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_asignada_a_fkey" FOREIGN KEY ("asignada_a") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
