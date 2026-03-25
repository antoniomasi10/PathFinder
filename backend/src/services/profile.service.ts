import prisma from '../lib/prisma';
import { GpaRange, EnglishLevel, WillingnessToRelocate } from '@prisma/client';
import { uploadImage } from '../utils/imageUpload';

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

function mapNumericGpa(gpa: string): number {
  switch (gpa) {
    case '18-21': return 19.5;
    case '21-24': return 22.5;
    case '24-27': return 25.5;
    case '27-30+': return 28.5;
    default: return 24;
  }
}

function mapCEFRLevel(level: string): string {
  if (level.startsWith('A2')) return 'A2';
  if (level.startsWith('B1')) return 'B2'; // B1/B2 maps to B2 for CEFR
  if (level.startsWith('C1')) return 'C1';
  if (level.startsWith('C2')) return 'C2';
  return 'B1';
}

function deriveCareerGoals(cluster: ProfileData['cluster'], careerPreference: string, professionalIdentity: string): string[] {
  const goals: string[] = [];

  // From career preference
  switch (careerPreference) {
    case 'Costruire qualcosa di tuo':
      goals.push('entrepreneur', 'startup founder');
      break;
    case 'Percorso competitivo':
      goals.push('management consultant', 'strategy consultant');
      break;
    case 'Percorso stabile':
      goals.push('corporate career', 'project manager');
      break;
    case 'Fare ricerca e innovazione':
      goals.push('researcher', 'research scientist', 'innovation manager');
      break;
  }

  // From professional identity
  switch (professionalIdentity) {
    case 'Imprenditore/fondatore':
      goals.push('entrepreneur', 'business owner');
      break;
    case 'Specialista':
      goals.push('specialist', 'expert');
      break;
    case 'Manager/leader':
      goals.push('manager', 'team leader');
      break;
    case 'Ricercatore/accademico':
      goals.push('researcher', 'academic', 'professor');
      break;
  }

  // From cluster
  switch (cluster) {
    case 'INNOVATOR':
      goals.push('tech lead', 'product manager');
      break;
    case 'ANALYST':
      goals.push('data analyst', 'software engineer');
      break;
    case 'LEADER':
      goals.push('ceo', 'director');
      break;
    case 'HELPER':
      goals.push('social worker', 'educator');
      break;
  }

  // Deduplicate
  return [...new Set(goals)];
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
    passions: (input.languages || []).map((l) => JSON.stringify(l)),
    clusterTag: cluster,
    // V2 fields
    gpa: mapNumericGpa(answers.gpa),
    gpaScale: 'out_of_30',
    languageLevel: mapCEFRLevel(answers.englishLevel),
    careerGoals: deriveCareerGoals(cluster, answers.careerPreference, answers.professionalIdentity),
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
        ...(input.avatarId && { avatar: input.avatarId }),
        ...(input.avatarBgColor && { avatarBgColor: input.avatarBgColor }),
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
  if (user) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
  return user;
}

export async function updateProfile(userId: string, data: { name?: string; bio?: string; avatar?: string; courseOfStudy?: string; passions?: string[] }) {
  const { passions, ...userFields } = data;

  // Upload avatar to Cloudinary if it's a data URI
  if (userFields.avatar && userFields.avatar.startsWith('data:image/')) {
    userFields.avatar = await uploadImage(userFields.avatar, 'avatars');
  }

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
