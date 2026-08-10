/*
  Warnings:

  - Added the required column `approverRole` to the `ApprovalStep` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order` to the `ApprovalStep` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ApprovalStep" DROP CONSTRAINT "ApprovalStep_approverId_fkey";

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "footerLinks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "footerText" TEXT,
ADD COLUMN     "headerLinks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "ApprovalStep" ADD COLUMN     "approverRole" "Role" NOT NULL,
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL,
ALTER COLUMN "approverId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "selectedManagerId" TEXT;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_selectedManagerId_fkey" FOREIGN KEY ("selectedManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
