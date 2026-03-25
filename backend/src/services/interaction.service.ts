import prisma from '../lib/prisma';

const ACTION_WEIGHTS: Record<string, number> = {
  view: 1,
  click: 2,
  like: 2,
  comment: 3,
  save: 3,
  apply: 5,
  friend_request: 2,
  unsave: -2,
};

export async function trackInteraction(
  userId: string,
  targetType: 'opportunity' | 'course' | 'post' | 'user',
  targetId: string,
  action: string,
): Promise<void> {
  const weight = ACTION_WEIGHTS[action] ?? 1;

  await prisma.userInteraction.create({
    data: { userId, targetType, targetId, action, weight },
  });
}

export async function getUserInteractions(
  userId: string,
  targetType?: string,
  since?: Date,
) {
  return prisma.userInteraction.findMany({
    where: {
      userId,
      ...(targetType && { targetType }),
      ...(since && { createdAt: { gte: since } }),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getUserInteractionsByType(
  userId: string,
  targetType: string,
) {
  return prisma.userInteraction.groupBy({
    by: ['action'],
    where: { userId, targetType },
    _sum: { weight: true },
    _count: true,
  });
}
