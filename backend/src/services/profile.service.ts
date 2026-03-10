import prisma from '../lib/prisma';
import { GpaRange, EnglishLevel, WillingnessToRelocate } from '@prisma/client';

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

    await tx.user.update({
      where: { id: userId },
      data: {
        yearOfStudy: extractYearOfStudy(answers.yearOfStudy),
        gpa: mapGpa(answers.gpa),
        englishLevel: mapEnglishLevel(answers.englishLevel),
        willingToRelocate: mapWillingToRelocate(answers.willingToRelocate),
        profileCompleted: true,
      },
    });

    return profile;
  });
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      university: true,
    },
  });
  return user;
}

export async function getProfileForViewer(ownerId: string, viewerId: string) {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    include: {
      profile: true,
      university: true,
      savedOpportunities: {
        select: { id: true, title: true, company: true, type: true, university: { select: { name: true } } },
      },
    },
  });
  if (!user) return null;

  const friendship = await prisma.friendRequest.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { fromUserId: viewerId, toUserId: ownerId },
        { fromUserId: ownerId, toUserId: viewerId },
      ],
    },
  });
  const isPathmate = !!friendship;

  const { publicProfile, privacySavedOpps, messagePrivacy, savedOpportunities, ...rest } = user;

  // When profile is private every individual setting is effectively forced to 'Pathmates'
  const effectiveSavedOpps  = publicProfile ? privacySavedOpps  : 'Pathmates';
  const effectiveMessage    = publicProfile ? messagePrivacy    : 'Pathmates';

  const canViewDetails =
    publicProfile || isPathmate; // skills, university, bio visible only to pathmates when private
  const canViewSaved =
    effectiveSavedOpps === 'Tutti' ||
    (effectiveSavedOpps === 'Pathmates' && isPathmate);
  const canMessage =
    effectiveMessage === 'Tutti' ||
    (effectiveMessage === 'Pathmates' && isPathmate);

  return {
    ...rest,
    isPathmate,
    canViewDetails,
    canMessage,
    savedOpportunities: canViewSaved ? savedOpportunities : null,
  };
}

export async function deleteAccount(userId: string) {
  await prisma.userProfile.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: {
      bio: null,
      avatar: null,
      courseOfStudy: null,
      yearOfStudy: null,
      gpa: null,
      englishLevel: null,
      willingToRelocate: null,
      profileCompleted: false,
    },
  });
}

export async function updateProfile(userId: string, data: { name?: string; bio?: string; avatar?: string; courseOfStudy?: string; passions?: string[]; privacySavedOpps?: string; messagePrivacy?: string; publicProfile?: boolean }) {
  const { passions, ...userFields } = data;

  if (passions !== undefined) {
    await prisma.userProfile.update({
      where: { userId },
      data: { passions },
    });
  }

  if (Object.keys(userFields).length > 0) {
    return prisma.user.update({
      where: { id: userId },
      data: userFields,
      include: { profile: true, university: true },
    });
  }

  return prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, university: true },
  });
}
