import prisma from '../lib/prisma';

export async function getPosts(page: number = 1, limit: number = 20, currentUserId?: string) {
  const skip = (page - 1) * limit;
  const posts = await prisma.post.findMany({
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, name: true, avatar: true, courseOfStudy: true, university: { select: { name: true } } } },
      _count: { select: { likes: true, comments: true } },
      likes: currentUserId ? { where: { userId: currentUserId }, select: { userId: true } } : false,
    },
  });

  return posts.map(({ likes, ...post }) => ({
    ...post,
    liked: Array.isArray(likes) && likes.length > 0,
  }));
}

export async function createPost(authorId: string, content: string, images: string[] = []) {
  const post = await prisma.post.create({
    data: { authorId, content, images },
    include: {
      author: { select: { id: true, name: true, avatar: true, courseOfStudy: true, university: { select: { name: true } } } },
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
      author: { select: { id: true, name: true, avatar: true } },
    },
  });
}

export async function getPostById(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
}

export async function createComment(postId: string, authorId: string, content: string) {
  return prisma.postComment.create({
    data: { postId, authorId, content },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
    },
  });
}
