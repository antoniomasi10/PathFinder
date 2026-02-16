import prisma from '../lib/prisma';

async function areConnected(userA: string, userB: string): Promise<boolean> {
  const conn = await prisma.friendRequest.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { fromUserId: userA, toUserId: userB },
        { fromUserId: userB, toUserId: userA },
      ],
    },
  });
  return !!conn;
}

const memberSelect = {
  id: true,
  role: true,
  joinedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      avatar: true,
      courseOfStudy: true,
      university: { select: { name: true } },
    },
  },
};

export async function createGroup(
  creatorId: string,
  name: string,
  memberIds: string[],
  description?: string,
  image?: string,
) {
  // memberIds dovrebbe includere anche il creatore
  const allMemberIds = Array.from(new Set([creatorId, ...memberIds]));

  if (allMemberIds.length < 3) {
    throw { status: 400, message: 'Un gruppo deve avere almeno 3 membri' };
  }

  // Verifica che tutti i membri (escluso il creatore) siano connessi con il creatore
  const otherMembers = allMemberIds.filter((id) => id !== creatorId);
  for (const memberId of otherMembers) {
    const connected = await areConnected(creatorId, memberId);
    if (!connected) {
      throw { status: 400, message: `L'utente ${memberId} non è tra le tue connessioni` };
    }
  }

  return prisma.$transaction(async (tx) => {
    const group = await tx.pathMatesGroup.create({
      data: {
        name,
        description,
        image,
        createdById: creatorId,
        members: {
          create: allMemberIds.map((userId) => ({
            userId,
            role: userId === creatorId ? 'CREATOR' : 'MEMBER',
          })),
        },
      },
      include: {
        members: { select: memberSelect },
        createdBy: { select: { id: true, name: true, avatar: true } },
      },
    });

    return group;
  });
}

export async function addMember(
  groupId: string,
  requesterId: string,
  newMemberId: string,
) {
  const group = await prisma.pathMatesGroup.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) {
    throw { status: 404, message: 'Gruppo non trovato' };
  }

  const requesterMember = group.members.find((m) => m.userId === requesterId);
  if (!requesterMember) {
    throw { status: 403, message: 'Non sei membro di questo gruppo' };
  }

  const alreadyMember = group.members.find((m) => m.userId === newMemberId);
  if (alreadyMember) {
    throw { status: 400, message: 'L\'utente è già membro del gruppo' };
  }

  const connected = await areConnected(requesterId, newMemberId);
  if (!connected) {
    throw { status: 400, message: 'L\'utente non è tra le tue connessioni' };
  }

  return prisma.groupMember.create({
    data: { groupId, userId: newMemberId },
    select: memberSelect,
  });
}

export async function updateGroup(
  groupId: string,
  userId: string,
  data: { name?: string; description?: string; image?: string },
) {
  const group = await prisma.pathMatesGroup.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) {
    throw { status: 404, message: 'Gruppo non trovato' };
  }

  const member = group.members.find((m) => m.userId === userId);
  if (!member || member.role !== 'CREATOR') {
    throw { status: 403, message: 'Solo il creatore può modificare il gruppo' };
  }

  return prisma.pathMatesGroup.update({
    where: { id: groupId },
    data,
    include: {
      members: { select: memberSelect },
      createdBy: { select: { id: true, name: true, avatar: true } },
    },
  });
}

export async function getGroup(groupId: string, userId: string) {
  const group = await prisma.pathMatesGroup.findUnique({
    where: { id: groupId },
    include: {
      members: { select: memberSelect },
      createdBy: { select: { id: true, name: true, avatar: true } },
    },
  });

  if (!group) {
    throw { status: 404, message: 'Gruppo non trovato' };
  }

  const isMember = group.members.some((m) => m.user.id === userId);
  if (!isMember) {
    throw { status: 403, message: 'Non sei membro di questo gruppo' };
  }

  return group;
}

export async function getUserGroups(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: {
      group: {
        include: {
          members: { select: memberSelect },
          createdBy: { select: { id: true, name: true, avatar: true } },
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            include: {
              sender: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { group: { createdAt: 'desc' } },
  });

  return memberships.map((m) => ({
    ...m.group,
    lastMessage: m.group.messages[0] || null,
    messages: undefined,
  }));
}
