import { UserProfile, User, Opportunity, GpaRange, EnglishLevel } from '@prisma/client';

const GPA_ORDER: Record<GpaRange, number> = {
  GPA_18_20: 1,
  GPA_21_24: 2,
  GPA_25_27: 3,
  GPA_28_30: 4,
};

const ENGLISH_ORDER: Record<EnglishLevel, number> = {
  A2: 1,
  B1_B2: 2,
  C1: 3,
  C2_PLUS: 4,
};

// Interest → preferred opportunity types (30 pts)
const INTEREST_TYPE_MAP: Record<string, string[]> = {
  tech: ['INTERNSHIP', 'STAGE'],
  business: ['FELLOWSHIP', 'INTERNSHIP'],
  creative: ['EXTRACURRICULAR', 'EVENT'],
  sport: ['EXTRACURRICULAR', 'EVENT'],
  general: ['STAGE', 'EVENT', 'EXTRACURRICULAR'],
};

// Cluster → preferred opportunity types (25 pts)
const CLUSTER_TYPE_MAP: Record<string, string[]> = {
  Analista: ['INTERNSHIP', 'STAGE'],
  Creativo: ['EXTRACURRICULAR', 'EVENT'],
  Leader: ['FELLOWSHIP', 'INTERNSHIP'],
  Imprenditore: ['FELLOWSHIP', 'STAGE'],
  Sociale: ['EXTRACURRICULAR', 'EVENT'],
  Explorer: ['STAGE', 'EVENT', 'INTERNSHIP'],
};

export function scoreOpportunity(
  profile: UserProfile,
  user: Pick<User, 'gpa' | 'englishLevel' | 'willingToRelocate' | 'yearOfStudy'>,
  opportunity: Opportunity
): number {
  let score = 0;

  // 1. Primary interest → opportunity type (30 pts)
  const interest = profile.primaryInterest || 'general';
  const preferredTypes = INTEREST_TYPE_MAP[interest] || INTEREST_TYPE_MAP.general;
  if (preferredTypes[0] === opportunity.type) {
    score += 30;
  } else if (preferredTypes.includes(opportunity.type)) {
    score += 20;
  } else {
    score += 5;
  }

  // 2. Cluster tag → opportunity type (25 pts)
  const cluster = profile.clusterTag || 'Explorer';
  const clusterTypes = CLUSTER_TYPE_MAP[cluster] || CLUSTER_TYPE_MAP.Explorer;
  if (clusterTypes[0] === opportunity.type) {
    score += 25;
  } else if (clusterTypes.includes(opportunity.type)) {
    score += 15;
  } else {
    score += 5;
  }

  // 3. GPA sufficient (15 pts)
  if (!opportunity.minGpa) {
    score += 15;
  } else if (user.gpa && GPA_ORDER[user.gpa] >= GPA_ORDER[opportunity.minGpa]) {
    score += 15;
  } else if (user.gpa && GPA_ORDER[user.gpa] === GPA_ORDER[opportunity.minGpa] - 1) {
    score += 8;
  }

  // 4. English level (15 pts)
  if (!opportunity.requiredEnglishLevel) {
    score += 15;
  } else if (user.englishLevel && ENGLISH_ORDER[user.englishLevel] >= ENGLISH_ORDER[opportunity.requiredEnglishLevel]) {
    score += 15;
  } else if (user.englishLevel && ENGLISH_ORDER[user.englishLevel] === ENGLISH_ORDER[opportunity.requiredEnglishLevel] - 1) {
    score += 8;
  }

  // 5. Willing to relocate (10 pts)
  if (!opportunity.isAbroad && !opportunity.location) {
    score += 10;
  } else if (opportunity.isRemote) {
    score += 10;
  } else if (user.willingToRelocate === 'YES') {
    score += 10;
  } else if (user.willingToRelocate === 'MAYBE') {
    score += 5;
  }

  // 6. Year of study accessibility (5 pts)
  if (!user.yearOfStudy || user.yearOfStudy >= 2) {
    score += 5;
  } else {
    score += 2;
  }

  return Math.min(score, 100);
}
