-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'OPPORTUNITY');

-- AlterTable
ALTER TABLE "PathMatesMessage" ADD COLUMN "type" "MessageType" NOT NULL DEFAULT 'TEXT';
ALTER TABLE "PathMatesMessage" ADD COLUMN "opportunityId" TEXT;

-- AddForeignKey
ALTER TABLE "PathMatesMessage" ADD CONSTRAINT "PathMatesMessage_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
