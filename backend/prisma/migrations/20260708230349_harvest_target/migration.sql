-- AlterTable
ALTER TABLE "ScrapeJob" ADD COLUMN     "harvestTargetId" TEXT,
ALTER COLUMN "companyId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "HarvestTarget" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "categoryHint" "OpportunityType",
    "feedKind" TEXT NOT NULL,
    "scrapeTier" TEXT,
    "discoverySource" TEXT,
    "domain" TEXT,
    "country" TEXT DEFAULT 'IT',
    "region" TEXT,
    "contentHash" TEXT,
    "contentHashAt" TIMESTAMP(3),
    "lastScrapeStatus" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "robotsAllowed" BOOLEAN,
    "robotsCheckedAt" TIMESTAMP(3),
    "tosAllowed" BOOLEAN,
    "tosAnalyzedAt" TIMESTAMP(3),
    "tosNotes" TEXT,
    "tosPageNotFound" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HarvestTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HarvestTarget_url_key" ON "HarvestTarget"("url");

-- CreateIndex
CREATE INDEX "HarvestTarget_isActive_idx" ON "HarvestTarget"("isActive");

-- CreateIndex
CREATE INDEX "HarvestTarget_feedKind_idx" ON "HarvestTarget"("feedKind");

-- CreateIndex
CREATE INDEX "HarvestTarget_sourceLabel_idx" ON "HarvestTarget"("sourceLabel");

-- CreateIndex
CREATE INDEX "ScrapeJob_harvestTargetId_idx" ON "ScrapeJob"("harvestTargetId");

