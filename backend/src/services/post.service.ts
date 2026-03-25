import prisma from '../lib/prisma';

const AUTHOR_SELECT = {
  id: true, name: true, avatar: true, avatarBgColor: true,
  courseOfStudy: true, university: { select: { name: true } },
};

export async function getPosts(page: number = 1, limit: number = 20, currentUserId?: string) {
  const skip = (page - 1) * limit;
  const posts = await prisma.post.findMany({
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: AUTHOR_SELECT },
      _count: { select: { likes: true, comments: true } },
      likes: currentUserId ? { where: { userId: currentUserId }, select: { userId: true } } : false,
    },
  });

  return posts.map(({ likes, ...post }) => ({
    ...post,
    liked: Array.isArray(likes) && likes.length > 0,
  }));
}

/**
 * Personalized post feed with engagement-based ranking.
 * Scoring: friend post (+30), same university (+15), engagement score (max +25),
 * recency (max +30), same cluster (+10).
 */
export async function getPersonalizedPosts(
  page: number = 1,
  limit: number = 20,
  userId: string,
) {
  // Get current user data for scoring
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!currentUser?.profile) {
    return getPosts(page, limit, userId);
  }

  // Get friend IDs
  const friendRelations = await prisma.friendRequest.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
    select: { fromUserId: true, toUserId: true },
  });

  const friendIds = new Set<string>();
  friendRelations.forEach((r) => {
    friendIds.add(r.fromUserId === userId ? r.toUserId : r.fromUserId);
  });

  // Fetch more posts than needed so we can re-rank and paginate
  const fetchLimit = Math.min(limit * 5, 200);
  const posts = await prisma.post.findMany({
    take: fetchLimit,
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          ...AUTHOR_SELECT,
          universityId: true,
          profile: { select: { clusterTag: true } },
        },
      },
      _count: { select: { likes: true, comments: true } },
      likes: { where: { userId }, select: { userId: true } },
    },
  });

  const now = Date.now();

  const scored = posts.map(({ likes, ...post }) => {
    let score = 0;

    // Friend post (+30)
    if (friendIds.has(post.authorId)) {
      score += 30;
    }

    // Same university (+15)
    if (currentUser.universityId && post.author.universityId === currentUser.universityId) {
      score += 15;
    }

    // Engagement score: log2(likes + comments*2 + 1) * 10, max 25
    const engagement = post._count.likes + post._count.comments * 2;
    score += Math.min(Math.log2(engagement + 1) * 10, 25);

    // Recency bonus
    const ageMs = now - new Date(post.createdAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours < 1) score += 30;
    else if (ageHours < 6) score += 20;
    else if (ageHours < 24) score += 10;
    else if (ageHours < 168) score += 5; // 7 days

    // Same cluster tag (+10)
    if (currentUser.profile!.clusterTag && post.author.profile?.clusterTag === currentUser.profile!.clusterTag) {
      score += 10;
    }

    // Strip extra fields from author to match original shape
    const { universityId: _uniId, profile: _profile, ...authorClean } = post.author;

    return {
      ...post,
      author: authorClean,
      liked: Array.isArray(likes) && likes.length > 0,
      feedScore: Math.round(score),
    };
  });

  // Sort by feed score (desc), then createdAt (desc) as tiebreaker
  scored.sort((a, b) => {
    if (b.feedScore !== a.feedScore) return b.feedScore - a.feedScore;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Paginate
  const skip = (page - 1) * limit;
  return scored.slice(skip, skip + limit);
}

export async function createPost(authorId: string, content: string, images: string[] = []) {
  const post = await prisma.post.create({
    data: { authorId, content, images },
    include: {
      author: { select: AUTHOR_SELECT },
      _count: { select: { likes: true, comments: true } },
    },
  });
  return { ...post, liked: false };
}

export async function likePost(postId: string, userId: string) {
  try {
    return await prisma.postLike.create({ data: { postId, userId } });
  } catch (err: any) {
    // Unique constraint violation - already liked
    if (err.code === 'P2002') return null;
    throw err;
  }
}

export async function unlikePost(postId: string, userId: string) {
  try {
    return await prisma.postLike.delete({ where: { postId_userId: { postId, userId } } });
  } catch (err: any) {
    // Record not found - already unliked
    if (err.code === 'P2025') return null;
    throw err;
  }
}

export async function getComments(postId: string) {
  return prisma.postComment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
    },
  });
}

export async function getPostById(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
}

export async function createComment(postId: string, authorId: string, content: string) {
  return prisma.postComment.create({
    data: { postId, authorId, content },
    include: {
      author: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
    },
  });
}
