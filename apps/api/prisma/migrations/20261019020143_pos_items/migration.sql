-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "cancelAuthorizedById" INTEGER,
ADD COLUMN     "consumption" JSONB;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_cancelAuthorizedById_fkey" FOREIGN KEY ("cancelAuthorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
