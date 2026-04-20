-- Expand Opportunity schema: events, hackathons, summer programs, fellowships, etc.

-- 1. New enum types
CREATE TYPE "OpportunityFormat" AS ENUM ('ONLINE', 'IN_PERSON', 'HYBRID');

CREATE TYPE "FieldOfStudy" AS ENUM (
  'COMPUTER_SCIENCE',
  'ENGINEERING',
  'MEDICINE',
  'LIFE_SCIENCES',
  'PHYSICAL_SCIENCES',
  'MATHEMATICS',
  'ECONOMICS',
  'BUSINESS',
  'LAW',
  'POLITICAL_SCIENCE',
  'HUMANITIES',
  'DESIGN',
  'ARCHITECTURE',
  'PSYCHOLOGY',
  'EDUCATION',
  'ANY'
);

-- 2. New OpportunityType enum values
ALTER TYPE "OpportunityType" ADD VALUE IF NOT EXISTS 'SUMMER_PROGRAM';
ALTER TYPE "OpportunityType" ADD VALUE IF NOT EXISTS 'HACKATHON';
ALTER TYPE "OpportunityType" ADD VALUE IF NOT EXISTS 'COMPETITION';
ALTER TYPE "OpportunityType" ADD VALUE IF NOT EXISTS 'EXCHANGE';
ALTER TYPE "OpportunityType" ADD VALUE IF NOT EXISTS 'VOLUNTEERING';
ALTER TYPE "OpportunityType" ADD VALUE IF NOT EXISTS 'CONFERENCE';
ALTER TYPE "OpportunityType" ADD VALUE IF NOT EXISTS 'BOOTCAMP';
ALTER TYPE "OpportunityType" ADD VALUE IF NOT EXISTS 'RESEARCH';

-- 3. New columns on Opportunity (all nullable / with defaults — non-breaking)
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "startDate"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endDate"             TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "durationDays"        INTEGER,
  ADD COLUMN IF NOT EXISTS "format"              "OpportunityFormat",
  ADD COLUMN IF NOT EXISTS "city"                TEXT,
  ADD COLUMN IF NOT EXISTS "country"             TEXT,
  ADD COLUMN IF NOT EXISTS "cost"                INTEGER,
  ADD COLUMN IF NOT EXISTS "hasScholarship"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "scholarshipDetails"  TEXT,
  ADD COLUMN IF NOT EXISTS "stipend"             INTEGER,
  ADD COLUMN IF NOT EXISTS "eligibleFields"      "FieldOfStudy"[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "minYearOfStudy"      INTEGER,
  ADD COLUMN IF NOT EXISTS "maxYearOfStudy"      INTEGER,
  ADD COLUMN IF NOT EXISTS "requiredLanguages"   JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "organizer"           TEXT,
  ADD COLUMN IF NOT EXISTS "verified"            BOOLEAN NOT NULL DEFAULT false;

-- 4. Backfill format from existing isRemote flag
UPDATE "Opportunity"
SET "format" = 'ONLINE'
WHERE "isRemote" = true AND "format" IS NULL;

UPDATE "Opportunity"
SET "format" = 'IN_PERSON'
WHERE "isRemote" = false AND "format" IS NULL AND "location" IS NOT NULL;

-- 5. New indexes
CREATE INDEX IF NOT EXISTS "Opportunity_startDate_idx"       ON "Opportunity"("startDate");
CREATE INDEX IF NOT EXISTS "Opportunity_format_idx"          ON "Opportunity"("format");
CREATE INDEX IF NOT EXISTS "Opportunity_country_idx"         ON "Opportunity"("country");
CREATE INDEX IF NOT EXISTS "Opportunity_type_deadline_idx"   ON "Opportunity"("type", "deadline");
CREATE INDEX IF NOT EXISTS "Opportunity_type_startDate_idx"  ON "Opportunity"("type", "startDate");
