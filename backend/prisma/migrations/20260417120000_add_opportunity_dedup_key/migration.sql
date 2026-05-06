-- Add cross-source dedup key to Opportunity
ALTER TABLE "Opportunity" ADD COLUMN "dedupKey" TEXT;
CREATE INDEX "Opportunity_dedupKey_idx" ON "Opportunity"("dedupKey");
