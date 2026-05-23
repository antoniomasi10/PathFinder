-- CreateTable
CREATE TABLE "CompanyWatchlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "careersUrl" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
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

    CONSTRAINT "CompanyWatchlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyWatchlist_careersUrl_key" ON "CompanyWatchlist"("careersUrl");

-- CreateIndex
CREATE INDEX "CompanyWatchlist_isActive_idx" ON "CompanyWatchlist"("isActive");

-- CreateIndex
CREATE INDEX "CompanyWatchlist_tosAllowed_idx" ON "CompanyWatchlist"("tosAllowed");
