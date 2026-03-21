-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "about" TEXT,
ADD COLUMN     "url" TEXT;

-- CreateIndex
CREATE INDEX "FriendRequest_fromUserId_idx" ON "FriendRequest"("fromUserId");

-- CreateIndex
CREATE INDEX "FriendRequest_toUserId_idx" ON "FriendRequest"("toUserId");

-- CreateIndex
CREATE INDEX "FriendRequest_status_idx" ON "FriendRequest"("status");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Opportunity_universityId_idx" ON "Opportunity"("universityId");

-- CreateIndex
CREATE INDEX "Opportunity_type_idx" ON "Opportunity"("type");

-- CreateIndex
CREATE INDEX "Opportunity_deadline_idx" ON "Opportunity"("deadline");

-- CreateIndex
CREATE INDEX "PathMatesMessage_senderId_idx" ON "PathMatesMessage"("senderId");

-- CreateIndex
CREATE INDEX "PathMatesMessage_receiverId_idx" ON "PathMatesMessage"("receiverId");

-- CreateIndex
CREATE INDEX "PathMatesMessage_groupId_idx" ON "PathMatesMessage"("groupId");

-- CreateIndex
CREATE INDEX "PathMatesMessage_senderId_receiverId_idx" ON "PathMatesMessage"("senderId", "receiverId");

-- CreateIndex
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE INDEX "PostComment_postId_idx" ON "PostComment"("postId");

-- CreateIndex
CREATE INDEX "PostLike_postId_idx" ON "PostLike"("postId");

-- CreateIndex
CREATE INDEX "User_universityId_idx" ON "User"("universityId");
