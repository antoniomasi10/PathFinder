-- CreateEnum (safe if already exists)
DO $$ BEGIN
  CREATE TYPE "MessageType" AS ENUM ('TEXT', 'OPPORTUNITY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable (safe if columns already exist)
DO $$ BEGIN
  ALTER TABLE "PathMatesMessage" ADD COLUMN "type" "MessageType" NOT NULL DEFAULT 'TEXT';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PathMatesMessage" ADD COLUMN "opportunityId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- AddForeignKey (safe if already exists)
DO $$ BEGIN
  ALTER TABLE "PathMatesMessage" ADD CONSTRAINT "PathMatesMessage_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
