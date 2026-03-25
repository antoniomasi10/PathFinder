import prisma from '../lib/prisma';
import { createNotification } from './notification.service';

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
      avatarBgColor: true,
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
        createdBy: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
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
  if (!requesterMember || requesterMember.role !== 'CREATOR') {
    throw { status: 403, message: 'Solo il creatore del gruppo può aggiungere membri' };
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
      createdBy: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
    },
  });
}

export async function getGroup(groupId: string, userId: string) {
  const group = await prisma.pathMatesGroup.findUnique({
    where: { id: groupId },
    include: {
      members: { select: memberSelect },
      createdBy: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
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
          createdBy: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
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

export async function updateGroupPhoto(
  groupId: string,
  userId: string,
  image: string,
) {
  const group = await prisma.pathMatesGroup.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) {
    throw { status: 404, message: 'Gruppo non trovato' };
  }

  // Change from checking just membership to checking CREATOR role
  const member = group.members.find((m) => m.userId === userId);
  if (!member || member.role !== 'CREATOR') {
    throw { status: 403, message: 'Solo il creatore del gruppo può modificare la foto' };
  }

  return prisma.pathMatesGroup.update({
    where: { id: groupId },
    data: { image },
    include: {
      members: { select: memberSelect },
      createdBy: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
    },
  });
}

export async function removeMember(
  groupId: string,
  requesterId: string,
  targetUserId: string,
) {
  const group = await prisma.pathMatesGroup.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: { select: { name: true } } } } },
  });

  if (!group) {
    throw { status: 404, message: 'Gruppo non trovato' };
  }

  const requester = group.members.find((m) => m.userId === requesterId);
  if (!requester || requester.role !== 'CREATOR') {
    throw { status: 403, message: 'Solo il creatore può rimuovere membri' };
  }

  if (targetUserId === requesterId) {
    throw { status: 400, message: 'Non puoi rimuovere te stesso. Usa "Esci dal gruppo"' };
  }

  const target = group.members.find((m) => m.userId === targetUserId);
  if (!target) {
    throw { status: 404, message: 'L\'utente non è membro del gruppo' };
  }

  await prisma.groupMember.delete({
    where: { id: target.id },
  });

  await createNotification(
    targetUserId,
    'GENERAL',
    `Sei stato rimosso dal gruppo "${group.name}"`,
    '/networking',
  );

  return { success: true };
}

export async function leaveGroup(groupId: string, userId: string) {
  const group = await prisma.pathMatesGroup.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) {
    throw { status: 404, message: 'Gruppo non trovato' };
  }

  const member = group.members.find((m) => m.userId === userId);
  if (!member) {
    throw { status: 403, message: 'Non sei membro di questo gruppo' };
  }

  // If creator and there are other members, block
  if (member.role === 'CREATOR' && group.members.length > 1) {
    throw {
      status: 400,
      message: 'Il creatore non può uscire dal gruppo se ci sono altri membri. Elimina il gruppo o rimuovi prima tutti i membri.',
    };
  }

  // If last member, delete the whole group
  if (group.members.length === 1) {
    await prisma.pathMatesMessage.deleteMany({ where: { groupId } });
    await prisma.pathMatesGroup.delete({ where: { id: groupId } });
    return { deleted: true };
  }

  // Otherwise just remove self
  await prisma.groupMember.delete({
    where: { id: member.id },
  });

  return { deleted: false };
}

export async function deleteGroup(groupId: string, userId: string) {
  const group = await prisma.pathMatesGroup.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) {
    throw { status: 404, message: 'Gruppo non trovato' };
  }

  const requester = group.members.find((m) => m.userId === userId);
  if (!requester || requester.role !== 'CREATOR') {
    throw { status: 403, message: 'Solo il creatore può eliminare il gruppo' };
  }

  // Notify all other members
  const otherMembers = group.members.filter((m) => m.userId !== userId);
  for (const m of otherMembers) {
    await createNotification(
      m.userId,
      'GENERAL',
      `Il gruppo "${group.name}" è stato eliminato`,
      '/networking',
    );
  }

  // Delete messages first (no cascade), then group (cascades members)
  await prisma.pathMatesMessage.deleteMany({ where: { groupId } });
  await prisma.pathMatesGroup.delete({ where: { id: groupId } });

  return { success: true };
}
