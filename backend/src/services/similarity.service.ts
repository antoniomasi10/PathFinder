import prisma from '../lib/prisma';

/**
 * Scores how similar two user profiles are (0-100).
 * Extracted from courseComparison.service.ts for reuse across the app.
 */
export function profileSimilarityScore(
  profileA: { primaryInterest?: string | null; clusterTag?: string | null; careerVision?: string | null; passions?: string[] },
  profileB: { primaryInterest?: string | null; clusterTag?: string | null; careerVision?: string | null; passions?: string[] },
): number {
  let score = 0;

  // Same primary interest (35 pts)
  if (profileA.primaryInterest && profileA.primaryInterest === profileB.primaryInterest) {
    score += 35;
  }

  // Same cluster tag (30 pts)
  if (profileA.clusterTag && profileA.clusterTag === profileB.clusterTag) {
    score += 30;
  }

  // Same career vision (20 pts)
  if (profileA.careerVision && profileA.careerVision === profileB.careerVision) {
    score += 20;
  }

  // Shared passions (15 pts max)
  if (profileA.passions?.length && profileB.passions?.length) {
    const setA = new Set(profileA.passions);
    const shared = profileB.passions.filter((p) => setA.has(p)).length;
    const total = Math.max(profileA.passions.length, profileB.passions.length);
    if (total > 0) {
      score += Math.round((shared / total) * 15);
    }
  }

  return Math.min(score, 100);
}

interface FriendSuggestion {
  id: string;
  name: string;
  avatar: string | null;
  avatarBgColor: string | null;
  courseOfStudy: string | null;
  university: { name: string } | null;
  similarityScore: number;
}

/**
 * Smart friend suggestions using two-stage approach:
 * Stage 1: Candidate retrieval (vector or SQL filter)
 * Stage 2: Re-rank with detailed scoring (profile similarity, university, mutual friends, etc.)
 */
export async function getSmartFriendSuggestions(
  userId: string,
  limit: number = 10,
): Promise<FriendSuggestion[]> {
  // Get current user with profile
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      savedOpportunities: { select: { id: true } },
      savedCourses: { select: { id: true } },
    },
  });

  if (!currentUser?.profile) {
    // No profile: return random suggestions (legacy behavior)
    return getRandomSuggestions(userId, limit);
  }

  // Get existing friend/request IDs to exclude
  const existingRelations = await prisma.friendRequest.findMany({
    where: {
      OR: [
        { fromUserId: userId },
        { toUserId: userId },
      ],
      status: { in: ['PENDING', 'ACCEPTED'] },
    },
    select: { fromUserId: true, toUserId: true },
  });

  const excludeIds = new Set<string>([userId]);
  existingRelations.forEach((r) => {
    excludeIds.add(r.fromUserId);
    excludeIds.add(r.toUserId);
  });

  const excludeArray = Array.from(excludeIds);

  // Check if user has embedding for vector candidate retrieval
  const hasEmbedding = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM "User" WHERE id = $1 AND embedding IS NOT NULL`,
    userId,
  );
  const userHasEmbedding = hasEmbedding[0]?.count > 0n;

  let candidateIds: string[];

  if (userHasEmbedding) {
    // Stage 1: Vector candidate retrieval (top 30 similar users)
    const vectorCandidates = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT u2.id
       FROM "User" u1, "User" u2
       WHERE u1.id = $1
         AND u2.id != $1
         AND u2."profileCompleted" = true
         AND u2.embedding IS NOT NULL
         AND u2.id != ALL($2::text[])
       ORDER BY u2.embedding <=> u1.embedding
       LIMIT 30`,
      userId,
      excludeArray,
    );
    candidateIds = vectorCandidates.map((c) => c.id);
  } else {
    // Fallback: get all eligible users (limited to 50 for performance)
    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: excludeArray },
        profileCompleted: true,
      },
      select: { id: true },
      take: 50,
    });
    candidateIds = candidates.map((c) => c.id);
  }

  if (candidateIds.length === 0) {
    return [];
  }

  // Load full candidate data for re-ranking
  const candidates = await prisma.user.findMany({
    where: { id: { in: candidateIds } },
    select: {
      id: true,
      name: true,
      avatar: true,
      avatarBgColor: true,
      courseOfStudy: true,
      universityId: true,
      university: { select: { name: true } },
      profile: {
        select: {
          primaryInterest: true,
          clusterTag: true,
          careerVision: true,
          passions: true,
        },
      },
      savedOpportunities: { select: { id: true } },
      savedCourses: { select: { id: true } },
    },
  });

  // Get mutual friends count for each candidate
  const currentUserFriendIds = new Set(
    existingRelations
      .filter((r) => r.fromUserId === userId || r.toUserId === userId)
      .map((r) => r.fromUserId === userId ? r.toUserId : r.fromUserId),
  );

  // Get all friend relations for candidate users (to find mutual friends)
  const candidateFriendRelations = await prisma.friendRequest.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { fromUserId: { in: candidateIds } },
        { toUserId: { in: candidateIds } },
      ],
    },
    select: { fromUserId: true, toUserId: true },
  });

  // Build mutual friend count map
  const mutualFriendsMap = new Map<string, number>();
  for (const candidateId of candidateIds) {
    const candidateFriends = new Set<string>();
    for (const r of candidateFriendRelations) {
      if (r.fromUserId === candidateId) candidateFriends.add(r.toUserId);
      if (r.toUserId === candidateId) candidateFriends.add(r.fromUserId);
    }
    let mutual = 0;
    for (const fid of candidateFriends) {
      if (currentUserFriendIds.has(fid)) mutual++;
    }
    mutualFriendsMap.set(candidateId, mutual);
  }

  // Stage 2: Re-rank with detailed scoring
  const currentSavedOppIds = new Set(currentUser.savedOpportunities.map((o) => o.id));
  const currentSavedCourseIds = new Set(currentUser.savedCourses.map((c) => c.id));

  const scored = candidates.map((candidate) => {
    let score = 0;

    // Profile similarity (weight 0.4, max 40 pts)
    if (candidate.profile) {
      score += profileSimilarityScore(currentUser.profile!, candidate.profile) * 0.4;
    }

    // Same university (+20)
    if (currentUser.universityId && candidate.universityId === currentUser.universityId) {
      score += 20;
    }

    // Same course of study (+15)
    if (currentUser.courseOfStudy && candidate.courseOfStudy === currentUser.courseOfStudy) {
      score += 15;
    }

    // Mutual friends (+5 per mutual, max +15)
    const mutualCount = mutualFriendsMap.get(candidate.id) || 0;
    score += Math.min(mutualCount * 5, 15);

    // Shared saved opportunities/courses (+10)
    let sharedSaves = 0;
    for (const opp of candidate.savedOpportunities) {
      if (currentSavedOppIds.has(opp.id)) sharedSaves++;
    }
    for (const course of candidate.savedCourses) {
      if (currentSavedCourseIds.has(course.id)) sharedSaves++;
    }
    if (sharedSaves > 0) score += Math.min(sharedSaves * 3, 10);

    return {
      id: candidate.id,
      name: candidate.name,
      avatar: candidate.avatar,
      avatarBgColor: candidate.avatarBgColor,
      courseOfStudy: candidate.courseOfStudy,
      university: candidate.university,
      similarityScore: Math.round(score),
    };
  });

  scored.sort((a, b) => b.similarityScore - a.similarityScore);

  return scored.slice(0, limit);
}

async function getRandomSuggestions(userId: string, limit: number): Promise<FriendSuggestion[]> {
  const existingRelations = await prisma.friendRequest.findMany({
    where: {
      OR: [{ fromUserId: userId }, { toUserId: userId }],
      status: { in: ['PENDING', 'ACCEPTED'] },
    },
    select: { fromUserId: true, toUserId: true },
  });

  const excludeIds = new Set<string>([userId]);
  existingRelations.forEach((r) => {
    excludeIds.add(r.fromUserId);
    excludeIds.add(r.toUserId);
  });

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: Array.from(excludeIds) },
      profileCompleted: true,
    },
    select: {
      id: true,
      name: true,
      avatar: true,
      avatarBgColor: true,
      courseOfStudy: true,
      university: { select: { name: true } },
    },
    take: limit,
  });

  return users.map((u) => ({ ...u, similarityScore: 0 }));
}

/**
 * Vector-based similar users query (used by course comparison social proof).
 */
export async function getVectorSimilarUsers(
  userId: string,
  limit: number = 20,
): Promise<{ id: string; similarity: number }[]> {
  try {
    const results = await prisma.$queryRawUnsafe<{ id: string; similarity: number }[]>(
      `SELECT u2.id, 1 - (u2.embedding <=> u1.embedding) AS similarity
       FROM "User" u1, "User" u2
       WHERE u1.id = $1
         AND u2.id != $1
         AND u2."profileCompleted" = true
         AND u2.embedding IS NOT NULL
         AND u1.embedding IS NOT NULL
       ORDER BY u2.embedding <=> u1.embedding
       LIMIT $2`,
      userId,
      limit,
    );
    return results;
  } catch {
    return [];
  }
}
