import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export const prisma = new PrismaClient();

export interface TestUsers {
  userA: { id: string; email: string };
  userB: { id: string; email: string };
}

const TEST_PREFIX = '__test_notif__';

export async function setupTestUsers(): Promise<TestUsers> {
  const hash = await bcrypt.hash('test123', 10);

  const userA = await prisma.user.create({
    data: {
      name: `${TEST_PREFIX}User A`,
      email: `${TEST_PREFIX}a@test.com`,
      passwordHash: hash,
      profileCompleted: true,
    },
  });

  const userB = await prisma.user.create({
    data: {
      name: `${TEST_PREFIX}User B`,
      email: `${TEST_PREFIX}b@test.com`,
      passwordHash: hash,
      profileCompleted: true,
    },
  });

  // Create default notification preferences
  await prisma.notificationPreference.createMany({
    data: [
      { userId: userA.id },
      { userId: userB.id },
    ],
  });

  return {
    userA: { id: userA.id, email: userA.email },
    userB: { id: userB.id, email: userB.email },
  };
}

export async function cleanupTestData() {
  // Delete in order respecting FK constraints
  const testUsers = await prisma.user.findMany({
    where: { name: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });

  const ids = testUsers.map((u) => u.id);
  if (ids.length === 0) return;

  await prisma.pushSubscription.deleteMany({ where: { userId: { in: ids } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.notificationPreference.deleteMany({ where: { userId: { in: ids } } });
  await prisma.postComment.deleteMany({ where: { authorId: { in: ids } } });
  await prisma.postLike.deleteMany({ where: { userId: { in: ids } } });
  await prisma.post.deleteMany({ where: { authorId: { in: ids } } });
  await prisma.pathMatesMessage.deleteMany({
    where: { OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }] },
  });
  await prisma.friendRequest.deleteMany({
    where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] },
  });
  await prisma.userProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
