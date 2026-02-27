import prisma from '../lib/prisma';
import { GpaRange, EnglishLevel, WillingnessToRelocate } from '@prisma/client';

interface QuestionnaireInput {
  // Step 1 - Structural
  yearOfStudy: number;
  gpa: GpaRange;
  englishLevel: EnglishLevel;
  willingToRelocate: WillingnessToRelocate;
  // Step 2 - Behavioral
  naturalActivity: string;
  freeTimeActivity: string;
  // Step 3 - Ambition
  problemSolvingStyle: string;
  riskTolerance: string;
  careerVision: string;
  professionalGoal: string;
}

function deriveClusterTag(input: QuestionnaireInput): string {
  const { naturalActivity, problemSolvingStyle, riskTolerance, careerVision } = input;

  // Derive cluster from behavioral + ambition answers
  if (naturalActivity === 'analizzare_dati' || problemSolvingStyle === 'analitico') {
    return 'Analista';
  }
  if (naturalActivity === 'creare_contenuti' || careerVision === 'creativo') {
    return 'Creativo';
  }
  if (naturalActivity === 'organizzare_team' || careerVision === 'leader') {
    return 'Leader';
  }
  if (riskTolerance === 'alto' || careerVision === 'imprenditore') {
    return 'Imprenditore';
  }
  if (naturalActivity === 'aiutare_altri' || careerVision === 'sociale') {
    return 'Sociale';
  }
  return 'Explorer';
}

function derivePrimaryInterest(naturalActivity: string, careerVision: string): string {
  if (naturalActivity === 'risolvere_problemi' || naturalActivity === 'analizzare_dati') return 'tech';
  if (naturalActivity === 'organizzare_team' || careerVision === 'leader' || careerVision === 'imprenditore') return 'business';
  if (naturalActivity === 'creare_contenuti' || careerVision === 'creativo') return 'creative';
  if (naturalActivity === 'aiutare_altri' || careerVision === 'sociale') return 'social';
  return 'general';
}

export async function saveQuestionnaire(userId: string, input: QuestionnaireInput) {
  const clusterTag = deriveClusterTag(input);
  const primaryInterest = derivePrimaryInterest(input.naturalActivity, input.careerVision);

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update: {
      primaryInterest,
      naturalActivity: input.naturalActivity,
      freeTimeActivity: input.freeTimeActivity,
      problemSolvingStyle: input.problemSolvingStyle,
      riskTolerance: input.riskTolerance,
      careerVision: input.careerVision,
      professionalGoal: input.professionalGoal,
      passions: [],
      clusterTag,
      completedAt: new Date(),
    },
    create: {
      userId,
      primaryInterest,
      naturalActivity: input.naturalActivity,
      freeTimeActivity: input.freeTimeActivity,
      problemSolvingStyle: input.problemSolvingStyle,
      riskTolerance: input.riskTolerance,
      careerVision: input.careerVision,
      professionalGoal: input.professionalGoal,
      passions: [],
      clusterTag,
      completedAt: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      yearOfStudy: input.yearOfStudy,
      gpa: input.gpa,
      englishLevel: input.englishLevel,
      willingToRelocate: input.willingToRelocate,
      profileCompleted: true,
    },
  });

  return profile;
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

export async function updateProfile(userId: string, data: { name?: string; bio?: string; avatar?: string; courseOfStudy?: string; passions?: string[] }) {
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
