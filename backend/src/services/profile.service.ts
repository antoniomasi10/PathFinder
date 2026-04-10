import prisma from '../lib/prisma';
import { GpaRange, EnglishLevel, WillingnessToRelocate } from '@prisma/client';
import { uploadImage } from '../utils/imageUpload';

/** Select all User scalar fields except `embedding` (Unsupported vector type) and `passwordHash`. */
const safeUserSelect = {
  id: true, email: true, name: true, surname: true, username: true, phone: true,
  googleId: true, provider: true, emailVerified: true, avatar: true, avatarBgColor: true,
  bio: true, universityId: true, courseOfStudy: true, yearOfStudy: true, gpa: true,
  englishLevel: true, willingToRelocate: true, profileCompleted: true, publicProfile: true,
  privacySavedOpps: true, privacyPathmates: true, messagePrivacy: true, privacySkills: true,
  privacyUniversity: true, passwordResetToken: true, passwordResetExpiry: true,
  skills: true,
  createdAt: true, updatedAt: true,
} as const;

interface ProfileData {
  answers: {
    yearOfStudy: string;
    gpa: string;
    englishLevel: string;
    languages: string[];
    willingToRelocate: string;
    naturalActivity: string;
    freeTimeActivity: string;
    problemSolvingStyle: string;
    riskTolerance: string;
    careerPreference: string;
    professionalIdentity: string;
  };
  cluster: 'INNOVATOR' | 'ANALYST' | 'LEADER' | 'HELPER';
  languages: Array<{ lingua: string; peso: number; valoreLibero?: string }>;
  filters: {
    yearOfStudy: string;
    gpa: string;
    englishLevel: string;
    mobility: string;
  };
  interests?: Array<{ id: string; name: string; selectedAt: string }>;
  avatarId?: string;
  avatarBgColor?: string;
}

function mapGpa(gpa: string): GpaRange {
  switch (gpa) {
    case '18-21': return 'GPA_18_20';
    case '21-24': return 'GPA_21_24';
    case '24-27': return 'GPA_25_27';
    case '27-30+': return 'GPA_28_30';
    default: return 'GPA_25_27';
  }
}

function mapEnglishLevel(level: string): EnglishLevel {
  if (level.startsWith('A2')) return 'A2';
  if (level.startsWith('B1')) return 'B1_B2';
  if (level.startsWith('C1')) return 'C1';
  if (level.startsWith('C2')) return 'C2_PLUS';
  return 'B1_B2';
}

function mapWillingToRelocate(w: string): WillingnessToRelocate {
  if (w.startsWith('Sì')) return 'YES';
  if (w === 'No, preferisco restare nella mia città') return 'NO';
  return 'MAYBE';
}

function extractYearOfStudy(s: string): number {
  const match = s.match(/(\d+)°/);
  const year = match ? parseInt(match[1]) : 1;
  if (s.startsWith('Magistrale')) return year + 3;
  return year;
}

function derivePrimaryInterest(cluster: ProfileData['cluster']): string {
  switch (cluster) {
    case 'INNOVATOR': return 'tech';
    case 'ANALYST': return 'tech';
    case 'LEADER': return 'business';
    case 'HELPER': return 'general';
  }
}

export async function saveQuestionnaire(userId: string, input: ProfileData) {
  const { answers, cluster } = input;
  const primaryInterest = derivePrimaryInterest(cluster);

  const profileFields = {
    primaryInterest,
    naturalActivity: answers.naturalActivity,
    freeTimeActivity: answers.freeTimeActivity,
    problemSolvingStyle: answers.problemSolvingStyle,
    riskTolerance: answers.riskTolerance,
    careerVision: answers.careerPreference,
    professionalGoal: answers.professionalIdentity,
    languages: input.languages || [],
    clusterTag: cluster,
  };

  return prisma.$transaction(async (tx) => {
    const profile = await tx.userProfile.upsert({
      where: { userId },
      update: { ...profileFields, completedAt: new Date() },
      create: { userId, ...profileFields, completedAt: new Date() },
    });

    // Build skills JSON with onboarding interests if provided
    const skillsUpdate: Record<string, unknown> = {};
    if (input.interests && input.interests.length > 0) {
      const existing = await tx.user.findUnique({
        where: { id: userId },
        select: { skills: true },
      });
      const currentSkills = (existing?.skills as Record<string, unknown>) || {};
      Object.assign(skillsUpdate, {
        skills: {
          ...currentSkills,
          core: currentSkills.core ?? null,
          side: currentSkills.side ?? [],
          promptShownAt: currentSkills.promptShownAt ?? null,
          promptDismissedAt: currentSkills.promptDismissedAt ?? null,
          definedAt: currentSkills.definedAt ?? null,
          lastUpdatedAt: currentSkills.lastUpdatedAt ?? null,
          interests: input.interests,
        },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        yearOfStudy: extractYearOfStudy(answers.yearOfStudy),
        gpa: mapGpa(answers.gpa),
        englishLevel: mapEnglishLevel(answers.englishLevel),
        willingToRelocate: mapWillingToRelocate(answers.willingToRelocate),
        profileCompleted: true,
        ...(input.avatarId && { avatar: input.avatarId }),
        ...(input.avatarBgColor && { avatarBgColor: input.avatarBgColor }),
        ...skillsUpdate,
      },
    });

    return profile;
  });
}

export async function getProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { ...safeUserSelect, profile: true, university: true },
  });
}

export async function getProfileForViewer(ownerId: string, viewerId: string) {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: {
      ...safeUserSelect,
      profile: true,
      university: true,
      savedOpportunities: {
        select: { id: true, title: true, company: true, type: true, university: { select: { name: true } } },
      },
    },
  });
  if (!user) return null;

  // Check relationship with requester
  const friendRequest = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { fromUserId: viewerId, toUserId: ownerId },
        { fromUserId: ownerId, toUserId: viewerId },
      ],
    },
  });
  const isPathmate = friendRequest?.status === 'ACCEPTED';
  const friendStatus = friendRequest?.status ?? null;
  const friendRequestId = friendRequest?.id ?? null;
  const iAmRequester = friendRequest ? friendRequest.fromUserId === viewerId : null;

  // Get pathmates of target
  const friendRequests = await prisma.friendRequest.findMany({
    where: {
      OR: [
        { fromUserId: ownerId, status: 'ACCEPTED' },
        { toUserId: ownerId, status: 'ACCEPTED' },
      ],
    },
    include: {
      fromUser: { select: { id: true, name: true, avatar: true, courseOfStudy: true, university: { select: { name: true } } } },
      toUser: { select: { id: true, name: true, avatar: true, courseOfStudy: true, university: { select: { name: true } } } },
    },
    take: 20,
  });
  const pathmates = friendRequests.map((fr) =>
    fr.fromUserId === ownerId ? fr.toUser : fr.fromUser
  );

  const isPublic = (user as any).publicProfile !== false;
  const canSeeProfile = isPublic || isPathmate;
  const savedOppsVisibility = (user as any).privacySavedOpps as string | undefined;
  const canSeeSavedOpps = !isPublic
    ? isPathmate
    : (savedOppsVisibility === 'Tutti' ||
       (savedOppsVisibility === 'Pathmates' && isPathmate) ||
       savedOppsVisibility === undefined);
  const privacyPathmates = ((user as any).privacyPathmates as string | undefined) ?? 'Tutti';
  const messagePrivacy = ((user as any).messagePrivacy as string | undefined) ?? 'Pathmates';
  const privacySkills = ((user as any).privacySkills as string | undefined) ?? 'Tutti';
  const privacyUniversity = ((user as any).privacyUniversity as string | undefined) ?? 'Tutti';
  const canSeeSkills =
    isPublic
      ? privacySkills === 'Tutti' || (privacySkills === 'Pathmates' && isPathmate)
      : isPathmate;
  const canSeeUniversity =
    isPublic
      ? privacyUniversity === 'Tutti' || (privacyUniversity === 'Pathmates' && isPathmate)
      : isPathmate;

  const canMessage =
    messagePrivacy === 'Tutti' ||
    (messagePrivacy === 'Pathmates' && isPathmate) ||
    ownerId === viewerId;

  if (!canSeeProfile) {
    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar ?? null,
      university: canSeeUniversity && user.university ? { name: user.university.name } : null,
      publicProfile: false,
      bio: null,
      courseOfStudy: null,
      yearOfStudy: null,
      profile: null,
      savedOpportunities: null,
      pathmates: [],
      pathmatesCount: pathmates.length,
      friendStatus,
      friendRequestId,
      iAmRequester,
      isPathmate,
      messagePrivacy,
      canMessage,
      canSeeSkills: false,
    };
  }

  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar ?? null,
    bio: user.bio ?? null,
    courseOfStudy: user.courseOfStudy ?? null,
    yearOfStudy: user.yearOfStudy ?? null,
    university: canSeeUniversity && user.university ? { name: user.university.name } : null,
    publicProfile: isPublic,
    privacySavedOpps: savedOppsVisibility ?? 'Pathmates',
    privacyPathmates,
    profile: canSeeSkills && user.profile
      ? { clusterTag: user.profile.clusterTag, passions: user.profile.passions }
      : null,
    savedOpportunities: canSeeSavedOpps ? user.savedOpportunities : null,
    pathmates,
    pathmatesCount: pathmates.length,
    friendStatus,
    friendRequestId,
    iAmRequester,
    isPathmate,
    messagePrivacy,
    canMessage,
    canSeeSkills,
  };
}

interface UpdateProfileData {
  name?: string;
  bio?: string;
  avatar?: string;
  courseOfStudy?: string;
  passions?: string[];
  interests?: Array<{ id: string; name: string; selectedAt: string }>;
  publicProfile?: boolean;
  privacySkills?: string;
  privacyUniversity?: string;
  privacySavedOpps?: string;
  privacyPathmates?: string;
  messagePrivacy?: string;
}

const ALLOWED_USER_FIELDS = [
  'name', 'bio', 'avatar', 'courseOfStudy',
  'publicProfile', 'privacySkills', 'privacyUniversity',
  'privacySavedOpps', 'privacyPathmates', 'messagePrivacy',
] as const;

export async function updateProfile(userId: string, data: UpdateProfileData) {
  const { passions, interests, ...rawFields } = data;

  // Whitelist only allowed fields to prevent mass assignment
  const userFields: Record<string, unknown> = {};
  for (const key of ALLOWED_USER_FIELDS) {
    if (key in rawFields && rawFields[key as keyof typeof rawFields] !== undefined) {
      userFields[key] = rawFields[key as keyof typeof rawFields];
    }
  }

  // Upload avatar to Cloudinary if it's a data URI
  if (typeof userFields.avatar === 'string' && userFields.avatar.startsWith('data:image/')) {
    userFields.avatar = await uploadImage(userFields.avatar as string, 'avatars');
  }

  if (passions !== undefined) {
    await prisma.userProfile.update({
      where: { userId },
      data: { passions },
    });
  }

  // Store interests in user's skills JSON
  if (interests !== undefined) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { skills: true },
    });
    const currentSkills = (existing?.skills as Record<string, unknown>) || {};
    userFields.skills = { ...currentSkills, interests };
  }

  if (Object.keys(userFields).length > 0) {
    return prisma.user.update({
      where: { id: userId },
      data: userFields,
      select: { ...safeUserSelect, profile: true, university: true },
    });
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: { ...safeUserSelect, profile: true, university: true },
  });
}

export async function deleteAccount(userId: string) {
  // 1. Delete friend requests (no cascade on User)
  await prisma.friendRequest.deleteMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
  });

  // 2. Handle groups created by this user (no cascade on User)
  const createdGroups = await prisma.pathMatesGroup.findMany({
    where: { createdById: userId },
    include: { members: { where: { userId: { not: userId } }, take: 1 } },
  });
  for (const group of createdGroups) {
    if (group.members.length > 0) {
      // Reassign creator to another member so group survives
      await prisma.pathMatesGroup.update({
        where: { id: group.id },
        data: { createdById: group.members[0].userId },
      });
    } else {
      // Solo creator — delete group messages then group
      await prisma.pathMatesMessage.deleteMany({ where: { groupId: group.id } });
      await prisma.pathMatesGroup.delete({ where: { id: group.id } });
    }
  }

  // 3. Remove group memberships (for groups the user is a member but not creator)
  await prisma.groupMember.deleteMany({ where: { userId } });

  // 4. Delete all messages sent or received by this user (no cascade on User)
  await prisma.pathMatesMessage.deleteMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
  });

  // 5. Delete the user — remaining relations have onDelete: Cascade
  //    (UserProfile, Notification, Post, PostLike, PostComment)
  await prisma.user.delete({ where: { id: userId } });
}
