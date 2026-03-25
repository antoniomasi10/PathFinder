import prisma from '../lib/prisma';

// V2 action weights (outcome-focused)
const ACTION_WEIGHTS: Record<string, number> = {
  view: 0.5,
  click: 1,
  like: 2,
  comment: 3,
  save: 4,
  apply: 5,
  apply_clicked: 8,
  application_submitted: 15,
  friend_request: 2,
  unsave: -4,
  ignored_repeatedly: -2,
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
