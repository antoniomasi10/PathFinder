-- Add extractedSkills column to Opportunity (AI-extracted, max 5 skills)
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "extractedSkills" TEXT[] NOT NULL DEFAULT '{}';
