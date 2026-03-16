-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "avgSalaryAfterGraduation" INTEGER,
ADD COLUMN     "employmentRate" DOUBLE PRECISION,
ADD COLUMN     "field" TEXT,
ADD COLUMN     "internationalOpportunities" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "internshipsAvailable" INTEGER,
ADD COLUMN     "languageOfInstruction" TEXT,
ADD COLUMN     "programDuration" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "_SavedCourses" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_SavedCourses_AB_unique" ON "_SavedCourses"("A", "B");

-- CreateIndex
CREATE INDEX "_SavedCourses_B_index" ON "_SavedCourses"("B");

-- AddForeignKey
ALTER TABLE "_SavedCourses" ADD CONSTRAINT "_SavedCourses_A_fkey" FOREIGN KEY ("A") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SavedCourses" ADD CONSTRAINT "_SavedCourses_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
