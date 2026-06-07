-- Add contextualizedSkills column (AI-generated skill descriptions for TIROCINIO opportunities)
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "contextualizedSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
