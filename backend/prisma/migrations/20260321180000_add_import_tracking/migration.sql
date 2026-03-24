-- AlterTable: Opportunity
ALTER TABLE "Opportunity" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

-- AlterTable: University
ALTER TABLE "University" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "University" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "University" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

-- AlterTable: Course
ALTER TABLE "Course" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Course" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "Course" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

-- CreateTable: ImportLog
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Opportunity_sourceId_idx" ON "Opportunity"("sourceId");
CREATE INDEX "Opportunity_lastSyncedAt_idx" ON "Opportunity"("lastSyncedAt");
CREATE INDEX "University_sourceId_idx" ON "University"("sourceId");
CREATE INDEX "Course_sourceId_idx" ON "Course"("sourceId");
CREATE INDEX "ImportLog_source_type_idx" ON "ImportLog"("source", "type");
CREATE INDEX "ImportLog_startedAt_idx" ON "ImportLog"("startedAt");
