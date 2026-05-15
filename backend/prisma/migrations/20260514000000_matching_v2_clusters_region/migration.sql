-- Matching v2: structured region/city locks on User, region + Schwartz clusters on Opportunity

-- User location preferences
ALTER TABLE "User" ADD COLUMN "region" TEXT;
ALTER TABLE "User" ADD COLUMN "city" TEXT;
ALTER TABLE "User" ADD COLUMN "regionLock" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "cityLock" BOOLEAN NOT NULL DEFAULT false;

-- Opportunity region + Schwartz cluster classification
ALTER TABLE "Opportunity" ADD COLUMN "region" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "clusterScores" JSONB;
ALTER TABLE "Opportunity" ADD COLUMN "clusterPrimary" TEXT;

CREATE INDEX "Opportunity_region_idx" ON "Opportunity"("region");
CREATE INDEX "Opportunity_clusterPrimary_idx" ON "Opportunity"("clusterPrimary");
