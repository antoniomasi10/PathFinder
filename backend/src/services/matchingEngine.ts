import { UserProfile, User, Opportunity, GpaRange, EnglishLevel, UserInteraction } from '@prisma/client';
import prisma from '../lib/prisma';

// ─── Constants & Maps ────────────────────────────────────────────────

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

const CEFR_LEVELS: Record<string, number> = {
  A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
};

const INTEREST_TYPE_MAP: Record<string, string[]> = {
  tech: ['INTERNSHIP', 'STAGE'],
  business: ['FELLOWSHIP', 'INTERNSHIP'],
  creative: ['EXTRACURRICULAR', 'EVENT'],
  sport: ['EXTRACURRICULAR', 'EVENT'],
  general: ['STAGE', 'EVENT', 'EXTRACURRICULAR'],
};

const CLUSTER_TYPE_MAP: Record<string, string[]> = {
  Analista: ['INTERNSHIP', 'STAGE'],
  Creativo: ['EXTRACURRICULAR', 'EVENT'],
  Leader: ['FELLOWSHIP', 'INTERNSHIP'],
  Imprenditore: ['FELLOWSHIP', 'STAGE'],
  Sociale: ['EXTRACURRICULAR', 'EVENT'],
  Explorer: ['STAGE', 'EVENT', 'INTERNSHIP'],
};

// V2 action weights (outcome-focused)
const ACTION_WEIGHTS: Record<string, number> = {
  view: 0.5,
  click: 1,
  like: 2,
  comment: 3,
  save: 4,
  apply_clicked: 8,
  application_submitted: 15,
  friend_request: 2,
  unsave: -4,
  ignored_repeatedly: -2,
};

// ─── V1 Algorithm (preserved for A/B testing) ────────────────────────

export function scoreOpportunity(
  profile: UserProfile,
  user: Pick<User, 'gpa' | 'englishLevel' | 'willingToRelocate' | 'yearOfStudy'>,
  opportunity: Opportunity
): number {
  let score = 0;

  const interest = profile.primaryInterest || 'general';
  const preferredTypes = INTEREST_TYPE_MAP[interest] || INTEREST_TYPE_MAP.general;
  if (preferredTypes[0] === opportunity.type) {
    score += 30;
  } else if (preferredTypes.includes(opportunity.type)) {
    score += 20;
  } else {
    score += 5;
  }

  const cluster = profile.clusterTag || 'Explorer';
  const clusterTypes = CLUSTER_TYPE_MAP[cluster] || CLUSTER_TYPE_MAP.Explorer;
  if (clusterTypes[0] === opportunity.type) {
    score += 25;
  } else if (clusterTypes.includes(opportunity.type)) {
    score += 15;
  } else {
    score += 5;
  }

  if (!opportunity.minGpa) {
    score += 15;
  } else if (user.gpa && GPA_ORDER[user.gpa] >= GPA_ORDER[opportunity.minGpa]) {
    score += 15;
  } else if (user.gpa && GPA_ORDER[user.gpa] === GPA_ORDER[opportunity.minGpa] - 1) {
    score += 8;
  }

  if (!opportunity.requiredEnglishLevel) {
    score += 15;
  } else if (user.englishLevel && ENGLISH_ORDER[user.englishLevel] >= ENGLISH_ORDER[opportunity.requiredEnglishLevel]) {
    score += 15;
  } else if (user.englishLevel && ENGLISH_ORDER[user.englishLevel] === ENGLISH_ORDER[opportunity.requiredEnglishLevel] - 1) {
    score += 8;
  }

  if (!opportunity.isAbroad && !opportunity.location) {
    score += 10;
  } else if (opportunity.isRemote) {
    score += 10;
  } else if (user.willingToRelocate === 'YES') {
    score += 10;
  } else if (user.willingToRelocate === 'MAYBE') {
    score += 5;
  }

  if (!user.yearOfStudy || user.yearOfStudy >= 2) {
    score += 5;
  } else {
    score += 2;
  }

  return Math.min(score, 100);
}

// ─── Time Decay ──────────────────────────────────────────────────────

function timeDecay(interactionDate: Date): number {
  const daysSince = (Date.now() - interactionDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 7) return 1.0;
  if (daysSince >= 30) return 0.3;
  return 1.0 - (0.7 * (daysSince - 7)) / 23;
}

// ─── V1 Feedback Boost ──────────────────────────────────────────────

function computeFeedbackBoostV1(
  interactions: UserInteraction[],
  _opportunity: Opportunity,
): number {
  let boost = 0;
  const typeInteractions = interactions.filter((i) => i.targetType === 'opportunity');
  if (typeInteractions.length === 0) return 0;

  let positiveSignal = 0;
  let negativeSignal = 0;
  let hasRecentTypeInteraction = false;

  for (const interaction of typeInteractions) {
    const decay = timeDecay(interaction.createdAt);
    if (['save', 'apply', 'click'].includes(interaction.action)) {
      positiveSignal += interaction.weight * decay;
    }
    if (interaction.action === 'unsave') {
      negativeSignal += Math.abs(interaction.weight) * decay;
    }
    if (interaction.action === 'view') {
      hasRecentTypeInteraction = true;
    }
  }

  boost += Math.min(positiveSignal * 1.5, 15);
  boost -= Math.min(negativeSignal * 2, 10);
  if (!hasRecentTypeInteraction) boost += 5;

  return Math.max(-10, Math.min(boost, 15));
}

// ─── V2: Relevance Score (35% of final) ─────────────────────────────

function calculateRelevanceScore(
  profile: UserProfile,
  user: Pick<User, 'gpa' | 'englishLevel' | 'willingToRelocate' | 'yearOfStudy'>,
  opportunity: Opportunity,
): number {
  // Reuse existing base scoring logic, normalized to 0-1
  return scoreOpportunity(profile, user, opportunity) / 100;
}

// ─── V2: Success Probability (45% of final) ─────────────────────────

interface Requirements {
  minGPA?: number;
  languageLevel?: string;
  experienceRequired?: boolean;
  experienceType?: string;
  testScore?: { type: string; minScore: number };
  portfolio?: boolean;
  letters?: number;
}

interface Experience {
  type: string;
  duration?: number;
  description?: string;
}

function normalizeGPA(gpa: number, scale?: string | null): number {
  switch (scale) {
    case 'out_of_4': return gpa / 4;
    case 'out_of_110': return gpa / 110;
    case 'percentage': return gpa / 100;
    case 'out_of_30':
    default: return gpa / 30;
  }
}

function gpaRangeToNumeric(gpaRange: GpaRange | null): number {
  switch (gpaRange) {
    case 'GPA_28_30': return 29;
    case 'GPA_25_27': return 26;
    case 'GPA_21_24': return 22.5;
    case 'GPA_18_20': return 19;
    default: return 24; // neutral default
  }
}

function englishLevelToCEFR(level: EnglishLevel | null): string {
  switch (level) {
    case 'C2_PLUS': return 'C2';
    case 'C1': return 'C1';
    case 'B1_B2': return 'B2';
    case 'A2': return 'A2';
    default: return 'B1';
  }
}

function calculateRequirementMatch(
  profile: UserProfile & { gpa?: number | null; gpaScale?: string | null; languageLevel?: string | null; experiences?: any[] },
  user: Pick<User, 'gpa' | 'englishLevel' | 'willingToRelocate' | 'yearOfStudy'>,
  opportunity: Opportunity,
): number {
  let score = 1.0;

  const requirements = (opportunity as any).requirements as Requirements | null;

  // GPA matching - use V2 profile.gpa if available, fallback to V1 enum
  if (requirements?.minGPA) {
    const userGPA = profile.gpa
      ? normalizeGPA(profile.gpa, profile.gpaScale)
      : normalizeGPA(gpaRangeToNumeric(user.gpa ?? null), 'out_of_30');
    const requiredGPA = normalizeGPA(requirements.minGPA, 'out_of_30');

    if (userGPA >= requiredGPA) {
      score *= 1.0;
    } else {
      const gap = requiredGPA - userGPA;
      score *= Math.max(0.2, 1 - gap * 2);
    }
  } else if (opportunity.minGpa) {
    // Fallback to V1 enum-based GPA matching
    const userGpaOrder = user.gpa ? GPA_ORDER[user.gpa] : 2;
    const reqGpaOrder = GPA_ORDER[opportunity.minGpa];
    if (userGpaOrder >= reqGpaOrder) {
      score *= 1.0;
    } else {
      score *= Math.max(0.3, 1 - (reqGpaOrder - userGpaOrder) * 0.25);
    }
  }

  // Language matching - use V2 profile.languageLevel if available, fallback to V1 enum
  if (requirements?.languageLevel) {
    const userLevel = CEFR_LEVELS[profile.languageLevel || englishLevelToCEFR(user.englishLevel ?? null)] || 3;
    const requiredLevel = CEFR_LEVELS[requirements.languageLevel] || 3;

    if (userLevel >= requiredLevel) {
      score *= 1.0;
    } else {
      const gap = requiredLevel - userLevel;
      score *= Math.max(0.1, 1 - gap * 0.25);
    }
  } else if (opportunity.requiredEnglishLevel) {
    const userEngOrder = user.englishLevel ? ENGLISH_ORDER[user.englishLevel] : 2;
    const reqEngOrder = ENGLISH_ORDER[opportunity.requiredEnglishLevel];
    if (userEngOrder >= reqEngOrder) {
      score *= 1.0;
    } else {
      score *= Math.max(0.2, 1 - (reqEngOrder - userEngOrder) * 0.3);
    }
  }

  // Experience matching
  if (requirements?.experienceRequired) {
    const experiences = (profile.experiences || []) as Experience[];
    const hasExperience = experiences.some(
      (exp) => exp.type === requirements.experienceType
    );
    score *= hasExperience ? 1.0 : 0.3;
  }

  return score;
}

function calculateProfileStrength(
  profile: UserProfile & { gpa?: number | null; gpaScale?: string | null; experiences?: any[]; skills?: string[]; achievements?: string[] },
  user: Pick<User, 'gpa' | 'englishLevel' | 'willingToRelocate' | 'yearOfStudy'>,
): number {
  let strength = 0;

  // GPA component (40%)
  const gpaValue = profile.gpa
    ? normalizeGPA(profile.gpa, profile.gpaScale)
    : normalizeGPA(gpaRangeToNumeric(user.gpa ?? null), 'out_of_30');
  strength += gpaValue * 0.4;

  // Experience component (30%)
  const experiences = (profile.experiences || []) as Experience[];
  const experienceScore = Math.min(1.0, experiences.length * 0.25);
  const hasQualityExperience = experiences.some(
    (e) => (e.duration || 0) >= 3 && e.type !== 'basic'
  );
  strength += (experienceScore + (hasQualityExperience ? 0.2 : 0)) * 0.3;

  // Skills component (15%)
  const skills = profile.skills || [];
  const skillScore = Math.min(1.0, skills.length * 0.1);
  strength += skillScore * 0.15;

  // Achievements component (15%)
  const achievements = profile.achievements || [];
  const achievementScore = Math.min(1.0, achievements.length * 0.15);
  strength += achievementScore * 0.15;

  return Math.min(1.0, strength);
}

async function calculateSimilarityToSuccessful(
  user: Pick<User, 'gpa' | 'universityId'>,
  opportunity: Opportunity,
): Promise<number> {
  // Find users from same university who saved/applied to this opportunity
  const sameUniversityInteractions = await prisma.userInteraction.count({
    where: {
      targetType: 'opportunity',
      targetId: opportunity.id,
      action: { in: ['save', 'apply', 'apply_clicked', 'application_submitted'] },
      user: {
        universityId: user.universityId || undefined,
      },
    },
  });

  if (sameUniversityInteractions === 0) return 0.5; // Neutral - no data

  // Also check how many from same university saved similar type
  const sameUniSimilarType = await prisma.userInteraction.count({
    where: {
      targetType: 'opportunity',
      action: { in: ['save', 'apply', 'apply_clicked'] },
      user: {
        universityId: user.universityId || undefined,
      },
    },
  });

  return Math.min(1.0, sameUniSimilarType / 10);
}

function calculateEngagementIntent(
  interactions: UserInteraction[],
  opportunity: Opportunity,
): number {
  let intent = 0.5; // Baseline

  // Filter to opportunity interactions
  const oppInteractions = interactions.filter((i) => i.targetType === 'opportunity');

  // Has saved similar opportunity types
  const savedSimilar = oppInteractions.filter(
    (i) => i.action === 'save'
  );
  intent += Math.min(0.3, savedSimilar.length * 0.1);

  // Has clicked "apply" on opportunities
  const appliedSimilar = oppInteractions.filter(
    (i) => ['apply', 'apply_clicked', 'application_submitted'].includes(i.action)
  );
  intent += Math.min(0.2, appliedSimilar.length * 0.15);

  return Math.min(1.0, intent);
}

async function calculateSuccessProbability(
  profile: UserProfile,
  user: Pick<User, 'gpa' | 'englishLevel' | 'willingToRelocate' | 'yearOfStudy' | 'universityId'>,
  opportunity: Opportunity,
  interactions: UserInteraction[],
): Promise<number> {
  const reqMatch = calculateRequirementMatch(profile as any, user, opportunity);
  const profStrength = calculateProfileStrength(profile as any, user);
  const similarity = await calculateSimilarityToSuccessful(user as any, opportunity);
  const intent = calculateEngagementIntent(interactions, opportunity);

  return reqMatch * 0.40 + profStrength * 0.30 + similarity * 0.20 + intent * 0.10;
}

// ─── V2: Exploration Score (20% of final) ────────────────────────────

function calculateNovelty(
  interactions: UserInteraction[],
  opportunity: Opportunity,
  allOpportunities: Map<string, Opportunity>,
): number {
  const viewedOppIds = new Set(
    interactions
      .filter((i) => i.targetType === 'opportunity')
      .map((i) => i.targetId)
  );

  const seenTypes = new Set<string>();
  const seenLocations = new Set<string>();
  const seenUniversities = new Set<string>();

  for (const oppId of viewedOppIds) {
    const opp = allOpportunities.get(oppId);
    if (opp) {
      seenTypes.add(opp.type);
      if (opp.location) seenLocations.add(opp.location);
      if (opp.universityId) seenUniversities.add(opp.universityId);
    }
  }

  let noveltyScore = 0;

  if (!seenTypes.has(opportunity.type)) noveltyScore += 0.4;
  if (opportunity.location && !seenLocations.has(opportunity.location)) noveltyScore += 0.3;
  if (opportunity.universityId && !seenUniversities.has(opportunity.universityId)) noveltyScore += 0.3;

  return Math.min(1.0, noveltyScore);
}

function calculateCareerAlignment(
  profile: UserProfile & { careerGoals?: string[] },
  opportunity: Opportunity,
): number {
  const careerGoals = profile.careerGoals || [];
  if (careerGoals.length === 0) return 0.5; // Neutral if no goals set

  const opportunityOutcomes = (opportunity as any).careerOutcomes as string[] || [];
  if (opportunityOutcomes.length === 0) return 0.5;

  // Simple keyword overlap matching
  const goalWords = new Set(
    careerGoals.flatMap((g: string) => g.toLowerCase().split(/\s+/))
  );
  const outcomeWords = opportunityOutcomes.flatMap((o: string) => o.toLowerCase().split(/\s+/));

  const matches = outcomeWords.filter((w: string) => goalWords.has(w)).length;
  const alignment = Math.min(1.0, matches / Math.max(1, goalWords.size));

  return alignment;
}

function calculateExplorationScore(
  profile: UserProfile,
  interactions: UserInteraction[],
  opportunity: Opportunity,
  allOpportunities: Map<string, Opportunity>,
): number {
  const novelty = calculateNovelty(interactions, opportunity, allOpportunities);
  const careerAlign = calculateCareerAlignment(profile as any, opportunity);
  return novelty * 0.50 + careerAlign * 0.50;
}

// ─── V2: Hard Cutoff ────────────────────────────────────────────────

function applySuccessProbabilityCutoff(score: number, successProbability: number): number {
  if (successProbability < 0.30) return score * 0.3;
  if (successProbability < 0.50) return score * 0.7;
  return score;
}

// ─── V2: Feedback Boost ─────────────────────────────────────────────

function computeFeedbackBoostV2(interactions: UserInteraction[]): number {
  let boost = 0;

  const oppInteractions = interactions.filter((i) => i.targetType === 'opportunity');

  for (const interaction of oppInteractions) {
    const weight = ACTION_WEIGHTS[interaction.action] ?? interaction.weight;
    const recency = timeDecay(interaction.createdAt);
    boost += weight * recency;
  }

  // Sigmoid normalization to -1 to 1 range
  return Math.tanh(boost / 10);
}

// ─── V2: Badge System ───────────────────────────────────────────────

export interface MatchBadge {
  text: string;
  color: string;
}

function getBadge(successProbability: number): MatchBadge {
  if (successProbability >= 0.70) {
    return { text: 'ALTAMENTE CONSIGLIATO', color: '#3DD68C' };
  }
  if (successProbability >= 0.50) {
    return { text: 'BUON MATCH', color: '#6C63FF' };
  }
  if (successProbability >= 0.30) {
    return { text: 'OBIETTIVO AMBIZIOSO', color: '#FF8C42' };
  }
  return { text: 'MOLTO COMPETITIVO', color: '#FF4444' };
}

// ─── V2: Match Reason ───────────────────────────────────────────────

function getMatchReasonV2(
  profile: UserProfile,
  user: Pick<User, 'gpa' | 'englishLevel' | 'willingToRelocate' | 'yearOfStudy'>,
  opportunity: Opportunity,
  successProbability: number,
): string {
  const reasons: string[] = [];

  if (successProbability >= 0.70) {
    reasons.push('Ottima compatibilità con il tuo profilo');
  }

  if (profile.primaryInterest === 'tech' && ['INTERNSHIP', 'STAGE'].includes(opportunity.type)) {
    reasons.push('In linea con i tuoi interessi tech');
  }
  if (profile.primaryInterest === 'business' && opportunity.type === 'FELLOWSHIP') {
    reasons.push('Perfetto per il tuo percorso imprenditoriale');
  }
  if (profile.clusterTag === 'Creativo' && opportunity.type === 'EXTRACURRICULAR') {
    reasons.push('Adatto al tuo profilo creativo');
  }
  if (opportunity.isRemote && user.willingToRelocate === 'NO') {
    reasons.push('Disponibile in remoto');
  }

  if (successProbability < 0.30) {
    reasons.push('Molto competitivo - preparati bene');
  } else if (successProbability < 0.50) {
    reasons.push('Obiettivo raggiungibile con impegno');
  }

  if (reasons.length === 0) reasons.push('Opportunità consigliata per te');
  return reasons.join(' · ');
}

// ─── V1 Match Reason (preserved) ────────────────────────────────────

function getMatchReasonV1(profile: any, user: any, opp: any): string {
  const reasons: string[] = [];
  if (profile.primaryInterest === 'tech' && (opp.type === 'INTERNSHIP' || opp.type === 'STAGE')) {
    reasons.push('In linea con i tuoi interessi tech');
  }
  if (profile.primaryInterest === 'business' && opp.type === 'FELLOWSHIP') {
    reasons.push('Perfetto per il tuo percorso imprenditoriale');
  }
  if (profile.clusterTag === 'Creativo' && opp.type === 'EXTRACURRICULAR') {
    reasons.push('Adatto al tuo profilo creativo');
  }
  if (opp.isRemote && user.willingToRelocate === 'NO') {
    reasons.push('Disponibile in remoto');
  }
  if (reasons.length === 0) reasons.push('Opportunità consigliata per te');
  return reasons.join(' · ');
}

// ─── V2: Feed Composition ───────────────────────────────────────────

interface ScoredOpportunity {
  opportunity: any;
  finalScore: number;
  successProbability: number;
  relevanceScore: number;
  explorationScore: number;
  matchBreakdown: {
    requirements: number;
    profileFit: number;
    similarStudents: number;
  };
}

function composeFeed(scored: ScoredOpportunity[], limit: number): ScoredOpportunity[] {
  // Sort by finalScore
  scored.sort((a, b) => b.finalScore - a.finalScore);

  const feed: ScoredOpportunity[] = [];

  // 60% realistic (successProbability > 0.6)
  const realistic = scored.filter((o) => o.successProbability > 0.6);
  const realisticCount = Math.ceil(limit * 0.6);
  feed.push(...realistic.slice(0, realisticCount));

  // 30% stretch (successProbability 0.4-0.6)
  const stretch = scored.filter((o) => o.successProbability >= 0.4 && o.successProbability <= 0.6);
  const stretchCount = Math.ceil(limit * 0.3);
  feed.push(...stretch.slice(0, stretchCount));

  // 10% aspirational (successProbability 0.2-0.4)
  const aspirational = scored.filter((o) => o.successProbability >= 0.2 && o.successProbability < 0.4);
  const aspirationalCount = Math.ceil(limit * 0.1);
  feed.push(...aspirational.slice(0, aspirationalCount));

  // If we don't have enough in categories, fill from overall sorted list
  if (feed.length < limit) {
    const feedIds = new Set(feed.map((f) => f.opportunity.id));
    const remaining = scored.filter((o) => !feedIds.has(o.opportunity.id));
    feed.push(...remaining.slice(0, limit - feed.length));
  }

  // Re-sort by finalScore
  feed.sort((a, b) => b.finalScore - a.finalScore);

  return feed.slice(0, limit);
}

// ─── A/B Test Version Selection ─────────────────────────────────────

export function getAlgorithmVersion(userId: string): 'v1_engagement_based' | 'v2_success_based' {
  // Simple hash-based 50/50 split
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2 === 0 ? 'v2_success_based' : 'v1_engagement_based';
}

// ─── Logging ────────────────────────────────────────────────────────

function logScoringBreakdown(
  userId: string,
  opportunityId: string,
  version: string,
  scores: {
    relevance: number;
    success: number;
    exploration: number;
    final: number;
    requirementMatch?: number;
    profileStrength?: number;
    similarity?: number;
    intent?: number;
    cutoffApplied?: boolean;
  },
) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[SCORING]', {
      userId: userId.slice(0, 8),
      opportunityId: opportunityId.slice(0, 8),
      version,
      ...scores,
    });
  }
}

// ─── Main Entry Point: Hybrid Matched Opportunities ─────────────────

export async function getHybridMatchedOpportunities(
  userId: string,
  limit: number = 20,
  offset: number = 0,
): Promise<{ data: any[]; total: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user?.profile) {
    const [opps, total] = await Promise.all([
      prisma.opportunity.findMany({
        include: { university: true },
        orderBy: { postedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.opportunity.count(),
    ]);
    return { data: opps, total };
  }

  const algorithmVersion = getAlgorithmVersion(userId);

  // Check if user has an embedding for vector search
  const hasEmbedding = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM "User" WHERE id = $1 AND embedding IS NOT NULL`,
    userId,
  );
  const userHasEmbedding = hasEmbedding[0]?.count > 0n;

  let candidates: any[];

  if (userHasEmbedding) {
    candidates = await prisma.$queryRawUnsafe<any[]>(
      `SELECT o.*, u."name" as "universityName", u."city" as "universityCity",
              u."id" as "uniId", u."logoUrl" as "universityLogoUrl",
              1 - (o.embedding <=> usr.embedding) AS "vectorSimilarity"
       FROM "Opportunity" o
       LEFT JOIN "University" u ON o."universityId" = u."id"
       CROSS JOIN "User" usr
       WHERE usr.id = $1 AND o.embedding IS NOT NULL
       ORDER BY o.embedding <=> usr.embedding
       LIMIT 50`,
      userId,
    );
  } else {
    candidates = await prisma.opportunity.findMany({
      include: { university: true },
      orderBy: { postedAt: 'desc' },
    });
  }

  // Get user interactions (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const interactions = await prisma.userInteraction.findMany({
    where: {
      userId,
      targetType: 'opportunity',
      createdAt: { gte: ninetyDaysAgo },
    },
  });

  if (algorithmVersion === 'v1_engagement_based') {
    return scoreWithV1(user, candidates, interactions, userHasEmbedding, limit, offset);
  }

  return scoreWithV2(user, candidates, interactions, userHasEmbedding, limit, offset);
}

// ─── V1 Scoring Pipeline ────────────────────────────────────────────

function scoreWithV1(
  user: any,
  candidates: any[],
  interactions: UserInteraction[],
  userHasEmbedding: boolean,
  limit: number,
  offset: number,
): { data: any[]; total: number } {
  const scored = candidates.map((opp) => {
    const baseScore = scoreOpportunity(user.profile!, user, opp);
    const feedbackBoost = computeFeedbackBoostV1(interactions, opp);
    const vectorSim = opp.vectorSimilarity ?? 0;

    let hybridScore: number;
    if (userHasEmbedding && vectorSim > 0) {
      hybridScore = baseScore * 0.5 + (vectorSim * 100) * 0.3 + (feedbackBoost + 10) * (100 / 25) * 0.2;
    } else {
      hybridScore = baseScore * 0.8 + (feedbackBoost + 10) * (100 / 25) * 0.2;
    }

    const university = opp.university || (opp.uniId ? {
      id: opp.uniId,
      name: opp.universityName,
      city: opp.universityCity,
      logoUrl: opp.universityLogoUrl,
    } : null);

    return {
      id: opp.id,
      title: opp.title,
      description: opp.description,
      about: opp.about,
      url: opp.url,
      type: opp.type,
      universityId: opp.universityId,
      university,
      company: opp.company,
      location: opp.location,
      isRemote: opp.isRemote,
      isAbroad: opp.isAbroad,
      requiredEnglishLevel: opp.requiredEnglishLevel,
      minGpa: opp.minGpa,
      tags: opp.tags,
      deadline: opp.deadline,
      postedAt: opp.postedAt,
      expiresAt: opp.expiresAt,
      sourceId: opp.sourceId,
      matchScore: Math.max(0, Math.min(100, Math.round(hybridScore))),
      matchReason: getMatchReasonV1(user.profile!, user, opp),
      algorithmVersion: 'v1',
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);

  return {
    data: scored.slice(offset, offset + limit),
    total: scored.length,
  };
}

// ─── V2 Scoring Pipeline ────────────────────────────────────────────

async function scoreWithV2(
  user: any,
  candidates: any[],
  interactions: UserInteraction[],
  userHasEmbedding: boolean,
  limit: number,
  offset: number,
): Promise<{ data: any[]; total: number }> {
  // Build opportunity map for novelty calculation
  const oppMap = new Map<string, Opportunity>();
  for (const opp of candidates) {
    oppMap.set(opp.id, opp);
  }

  const feedbackBoost = computeFeedbackBoostV2(interactions);

  const scoredOpportunities: ScoredOpportunity[] = [];

  for (const opp of candidates) {
    const relevance = calculateRelevanceScore(user.profile!, user, opp);
    const success = await calculateSuccessProbability(user.profile!, user, opp, interactions);
    const exploration = calculateExplorationScore(user.profile!, interactions, opp, oppMap);

    const reqMatch = calculateRequirementMatch(user.profile as any, user, opp);
    const profStrength = calculateProfileStrength(user.profile as any, user);

    // Vector similarity bonus (small boost if available)
    const vectorBonus = userHasEmbedding && opp.vectorSimilarity
      ? opp.vectorSimilarity * 0.05
      : 0;

    // Feedback boost as small modifier
    const feedbackModifier = feedbackBoost * 0.05;

    let finalScore =
      relevance * 0.35 +
      success * 0.45 +
      exploration * 0.20 +
      vectorBonus +
      feedbackModifier;

    const cutoffApplied = success < 0.50;
    finalScore = applySuccessProbabilityCutoff(finalScore, success);

    // Scale to 0-100
    const scaledScore = Math.max(0, Math.min(100, Math.round(finalScore * 100)));

    logScoringBreakdown(user.id, opp.id, 'v2', {
      relevance: Math.round(relevance * 100),
      success: Math.round(success * 100),
      exploration: Math.round(exploration * 100),
      final: scaledScore,
      requirementMatch: Math.round(reqMatch * 100),
      profileStrength: Math.round(profStrength * 100),
      cutoffApplied,
    });

    const university = opp.university || (opp.uniId ? {
      id: opp.uniId,
      name: opp.universityName,
      city: opp.universityCity,
      logoUrl: opp.universityLogoUrl,
    } : null);

    const badge = getBadge(success);

    scoredOpportunities.push({
      opportunity: {
        id: opp.id,
        title: opp.title,
        description: opp.description,
        about: opp.about,
        url: opp.url,
        type: opp.type,
        universityId: opp.universityId,
        university,
        company: opp.company,
        location: opp.location,
        isRemote: opp.isRemote,
        isAbroad: opp.isAbroad,
        requiredEnglishLevel: opp.requiredEnglishLevel,
        minGpa: opp.minGpa,
        tags: opp.tags,
        deadline: opp.deadline,
        postedAt: opp.postedAt,
        expiresAt: opp.expiresAt,
        sourceId: opp.sourceId,
        matchScore: scaledScore,
        interestMatch: Math.round(relevance * 100),
        realisticMatch: Math.round(success * 100),
        matchBadge: badge,
        matchBreakdown: {
          requirements: Math.round(reqMatch * 100),
          profileFit: Math.round(profStrength * 100),
          similarStudents: 50, // Neutral until we have more data
        },
        matchReason: getMatchReasonV2(user.profile!, user, opp, success),
        algorithmVersion: 'v2',
      },
      finalScore: scaledScore,
      successProbability: success,
      relevanceScore: relevance,
      explorationScore: exploration,
      matchBreakdown: {
        requirements: Math.round(reqMatch * 100),
        profileFit: Math.round(profStrength * 100),
        similarStudents: 50,
      },
    });
  }

  // Compose balanced feed
  const feed = composeFeed(scoredOpportunities, limit + offset);
  const feedData = feed.map((s) => s.opportunity);

  return {
    data: feedData.slice(offset, offset + limit),
    total: scoredOpportunities.length,
  };
}
