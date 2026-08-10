/*
  Warnings:

  - You are about to drop the column `logoUrl` on the `AppSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AppSettings" DROP COLUMN "logoUrl",
ADD COLUMN     "logoKey" TEXT;
