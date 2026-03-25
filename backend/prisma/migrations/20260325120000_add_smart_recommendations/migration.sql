-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "UserInteraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserInteraction_userId_targetType_idx" ON "UserInteraction"("userId", "targetType");

-- CreateIndex
CREATE INDEX "UserInteraction_targetId_targetType_idx" ON "UserInteraction"("targetId", "targetType");

-- CreateIndex
CREATE INDEX "UserInteraction_userId_targetType_action_idx" ON "UserInteraction"("userId", "targetType", "action");

-- AddForeignKey
ALTER TABLE "UserInteraction" ADD CONSTRAINT "UserInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add embedding columns
ALTER TABLE "User" ADD COLUMN "embedding" vector(384);
ALTER TABLE "Opportunity" ADD COLUMN "embedding" vector(384);
ALTER TABLE "Course" ADD COLUMN "embedding" vector(384);

-- Create HNSW indexes for fast similarity search
CREATE INDEX "User_embedding_idx" ON "User" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "Opportunity_embedding_idx" ON "Opportunity" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "Course_embedding_idx" ON "Course" USING hnsw ("embedding" vector_cosine_ops);
