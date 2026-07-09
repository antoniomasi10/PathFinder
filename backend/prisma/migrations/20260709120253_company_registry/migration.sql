-- CreateTable
CREATE TABLE "CompanyRegistry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "domain" TEXT,
    "websiteUrl" TEXT,
    "legalId" TEXT,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT,
    "sector" TEXT,
    "employeeBand" TEXT,
    "region" TEXT,
    "atsType" TEXT,
    "atsToken" TEXT,
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "watchlistId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyRegistry_domain_key" ON "CompanyRegistry"("domain");

-- CreateIndex
CREATE INDEX "CompanyRegistry_status_priorityScore_idx" ON "CompanyRegistry"("status", "priorityScore" DESC);

-- CreateIndex
CREATE INDEX "CompanyRegistry_normalizedName_idx" ON "CompanyRegistry"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyRegistry_source_sourceRef_key" ON "CompanyRegistry"("source", "sourceRef");

