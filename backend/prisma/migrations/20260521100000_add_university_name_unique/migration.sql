-- Add unique constraint on University.name to prevent duplicate universities
ALTER TABLE "University" ADD CONSTRAINT "University_name_key" UNIQUE ("name");
