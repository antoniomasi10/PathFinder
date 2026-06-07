-- Merge STAGE and INTERNSHIP into TIROCINIO
-- Uses a single-transaction approach: create new enum, cast column, drop old enum.

CREATE TYPE "OpportunityType_new" AS ENUM (
  'TIROCINIO',
  'EXTRACURRICULAR',
  'EVENT',
  'FELLOWSHIP',
  'SUMMER_PROGRAM',
  'HACKATHON',
  'COMPETITION',
  'EXCHANGE',
  'VOLUNTEERING',
  'BOOTCAMP',
  'RESEARCH'
);

ALTER TABLE "Opportunity"
  ALTER COLUMN type TYPE "OpportunityType_new"
  USING (CASE
    WHEN type::text IN ('STAGE', 'INTERNSHIP') THEN 'TIROCINIO'::"OpportunityType_new"
    ELSE type::text::"OpportunityType_new"
  END);

DROP TYPE "OpportunityType";
ALTER TYPE "OpportunityType_new" RENAME TO "OpportunityType";
