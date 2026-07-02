-- AlterTable
ALTER TABLE "CompanyWatchlist" ADD COLUMN     "atsToken" TEXT,
ADD COLUMN     "atsType" TEXT,
ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "contentHashAt" TIMESTAMP(3),
ADD COLUMN     "country" TEXT DEFAULT 'IT',
ADD COLUMN     "discoverySource" TEXT,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "lastScrapeStatus" TEXT,
ADD COLUMN     "scrapeTier" TEXT;

-- CreateTable
CREATE TABLE "ScrapeJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapeJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapeJob_status_runAfter_priority_idx" ON "ScrapeJob"("status", "runAfter", "priority");

-- CreateIndex
CREATE INDEX "ScrapeJob_companyId_idx" ON "ScrapeJob"("companyId");

-- CreateIndex
CREATE INDEX "CompanyWatchlist_atsType_idx" ON "CompanyWatchlist"("atsType");

-- CreateIndex
CREATE INDEX "CompanyWatchlist_scrapeTier_idx" ON "CompanyWatchlist"("scrapeTier");

-- CreateIndex
CREATE INDEX "CompanyWatchlist_domain_idx" ON "CompanyWatchlist"("domain");

