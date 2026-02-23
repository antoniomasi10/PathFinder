import prisma from '../lib/prisma';

export async function getPosts(page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;
  return prisma.post.findMany({
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, name: true, avatar: true, courseOfStudy: true, university: { select: { name: true } } } },
      _count: { select: { likes: true, comments: true } },
    },
  });
}

export async function createPost(authorId: string, content: string, images: string[] = []) {
  return prisma.post.create({
    data: { authorId, content, images },
    include: {
      author: { select: { id: true, name: true, avatar: true, courseOfStudy: true, university: { select: { name: true } } } },
      _count: { select: { likes: true, comments: true } },
    },
  });
}

export async function likePost(postId: string, userId: string) {
  return prisma.postLike.create({
    data: { postId, userId },
  });
}

export async function unlikePost(postId: string, userId: string) {
  return prisma.postLike.delete({
    where: { postId_userId: { postId, userId } },
  });
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

export async function createComment(postId: string, authorId: string, content: string) {
  return prisma.postComment.create({
    data: { postId, authorId, content },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
    },
  });
}
