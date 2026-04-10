import { UserProfile, User, Opportunity, GpaRange, EnglishLevel, UserInteraction } from '@prisma/client';
import prisma from '../lib/prisma';
import type { UserSkills, SkillEntry } from './skills.service';

function parseUserSkills(raw: unknown): UserSkills | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  return {
    core: Array.isArray(obj.core) ? obj.core : null,
    side: Array.isArray(obj.side) ? obj.side : [],
    promptShownAt: (obj.promptShownAt as string) || null,
    promptDismissedAt: (obj.promptDismissedAt as string) || null,
    definedAt: (obj.definedAt as string) || null,
    lastUpdatedAt: (obj.lastUpdatedAt as string) || null,
  };
}

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

/**
 * Compute skill match score (max 20 pts).
 * Core skill in requiredSkills → +6, in recommendedSkills → +3.
 * Side skill in requiredSkills → +2, in recommendedSkills → +1.
 */
function computeSkillMatchScore(
  skills: UserSkills | null,
  opportunity: { requiredSkills?: string | null; recommendedSkills?: string | null },
): number {
  if (!skills?.core) return 0;

  const normalize = (str: string) => str.toLowerCase().trim();

  const reqSkills = (opportunity.requiredSkills || '')
    .split(',')
    .map(normalize)
    .filter(Boolean);

  const recSkills = (opportunity.recommendedSkills || '')
    .split(',')
    .map(normalize)
    .filter(Boolean);

  let score = 0;

  for (const skill of skills.core) {
    const s = normalize(skill.name);
    if (reqSkills.includes(s)) score += 6;
    else if (recSkills.includes(s)) score += 3;
  }

  for (const skill of skills.side) {
    const s = normalize(skill.name);
    if (reqSkills.includes(s)) score += 2;
    else if (recSkills.includes(s)) score += 1;
  }

  return Math.min(score, 20);
}

/**
 * Original static scoring function (preserved for backward compatibility).
 * Total max is 110 when skills are present, 90 when not.
 */
export function scoreOpportunity(
  profile: UserProfile,
  user: Pick<User, 'gpa' | 'englishLevel' | 'willingToRelocate' | 'yearOfStudy'>,
  opportunity: Opportunity,
  skills?: UserSkills | null,
): number {
  let score = 0;

  // 1. Primary interest → opportunity type (25 pts)
  const interest = profile.primaryInterest || 'general';
  const preferredTypes = INTEREST_TYPE_MAP[interest] || INTEREST_TYPE_MAP.general;
  if (preferredTypes[0] === opportunity.type) {
    score += 25;
  } else if (preferredTypes.includes(opportunity.type)) {
    score += 17;
  } else {
    score += 4;
  }

  // 2. Cluster tag → opportunity type (20 pts)
  const cluster = profile.clusterTag || 'Explorer';
  const clusterTypes = CLUSTER_TYPE_MAP[cluster] || CLUSTER_TYPE_MAP.Explorer;
  if (clusterTypes[0] === opportunity.type) {
    score += 20;
  } else if (clusterTypes.includes(opportunity.type)) {
    score += 12;
  } else {
    score += 4;
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

  // 7. Skill match (20 pts)
  score += computeSkillMatchScore(skills || null, opportunity);

  return Math.min(score, 110);
}

// ─── Feedback-Aware Scoring ─────────────────────────────────────────

/**
 * Computes a time-decay factor: interactions within 7 days get full weight,
 * then linearly decays to 0.3 at 30+ days.
 */
function timeDecay(interactionDate: Date): number {
  const daysSince = (Date.now() - interactionDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 7) return 1.0;
  if (daysSince >= 30) return 0.3;
  // Linear decay from 1.0 at 7 days to 0.3 at 30 days
  return 1.0 - (0.7 * (daysSince - 7)) / 23;
}

/**
 * Computes a feedback-based adjustment from user interactions.
 * Returns a value in range [-10, +15].
 */
function computeFeedbackBoost(
  interactions: UserInteraction[],
  opportunity: Opportunity,
): number {
  let boost = 0;

  // Aggregate weighted interactions by opportunity type
  const typeInteractions = interactions.filter(
    (i) => i.targetType === 'opportunity',
  );

  if (typeInteractions.length === 0) return 0;

  // Positive signals: user saved/applied/clicked similar opportunity types
  let positiveSignal = 0;
  let negativeSignal = 0;
  let hasRecentTypeInteraction = false;

  for (const interaction of typeInteractions) {
    const decay = timeDecay(interaction.createdAt);

    // We need to check if this interaction was for the same opportunity type.
    // Since we don't have the type in the interaction, we use saved opportunity types
    // from a pre-computed map passed externally, or approximate via targetId.
    // For simplicity, count all opportunity interactions weighted by decay.
    if (interaction.action === 'save' || interaction.action === 'apply' || interaction.action === 'click') {
      positiveSignal += interaction.weight * decay;
    }
    if (interaction.action === 'unsave') {
      negativeSignal += Math.abs(interaction.weight) * decay;
    }
    if (interaction.action === 'view') {
      hasRecentTypeInteraction = true;
    }
  }

  // Normalize: positive boost up to +15
  boost += Math.min(positiveSignal * 1.5, 15);

  // Negative penalty up to -10
  boost -= Math.min(negativeSignal * 2, 10);

  // Diversity bonus: if user hasn't interacted with this type recently, +5
  if (!hasRecentTypeInteraction) {
    boost += 5;
  }

  return Math.max(-10, Math.min(boost, 15));
}

/**
 * Enhanced scoring that incorporates user behavior feedback.
 * Base score (0-110) + feedback adjustment (-10 to +15), clamped to 0-110.
 */
export function scoreOpportunityWithFeedback(
  profile: UserProfile,
  user: Pick<User, 'gpa' | 'englishLevel' | 'willingToRelocate' | 'yearOfStudy'>,
  opportunity: Opportunity,
  interactions: UserInteraction[],
  skills?: UserSkills | null,
): number {
  const baseScore = scoreOpportunity(profile, user, opportunity, skills);
  const feedbackBoost = computeFeedbackBoost(interactions, opportunity);
  return Math.max(0, Math.min(110, baseScore + feedbackBoost));
}

// ─── Hybrid Scoring (Phase 2: pgvector) ─────────────────────────────

/**
 * Two-stage hybrid scoring for opportunities.
 * Stage 1: Candidate retrieval via pgvector (top 50 by vector similarity).
 * Stage 2: Re-rank candidates with weighted + feedback scoring.
 */
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
    // Fallback: return opportunities by date if no profile
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

  // Check if user has an embedding for vector search
  const hasEmbedding = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM "User" WHERE id = $1 AND embedding IS NOT NULL`,
    userId,
  );
  const userHasEmbedding = hasEmbedding[0]?.count > 0n;

  let candidates: any[];

  if (userHasEmbedding) {
    // Stage 1: Candidate retrieval via pgvector (top 50)
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
    // Fallback: get all opportunities (Phase 1 behavior)
    candidates = await prisma.opportunity.findMany({
      include: { university: true },
      orderBy: { postedAt: 'desc' },
    });
  }

  // Get user interactions for feedback scoring (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const interactions = await prisma.userInteraction.findMany({
    where: {
      userId,
      targetType: 'opportunity',
      createdAt: { gte: ninetyDaysAgo },
    },
  });

  // Parse user skills from JSON field
  const userSkills = parseUserSkills(user.skills);

  // Stage 2: Re-rank with hybrid scoring
  const scored = candidates.map((opp) => {
    const baseScore = scoreOpportunity(user.profile!, user, opp, userSkills);
    const feedbackBoost = computeFeedbackBoost(interactions, opp);
    const vectorSim = opp.vectorSimilarity ?? 0;

    let hybridScore: number;
    if (userHasEmbedding && vectorSim > 0) {
      // Hybrid: 50% weighted + 30% vector + 20% feedback
      hybridScore = baseScore * 0.5 + (vectorSim * 100) * 0.3 + (feedbackBoost + 10) * (100 / 25) * 0.2;
    } else {
      // No embedding: 80% weighted + 20% feedback
      hybridScore = baseScore * 0.8 + (feedbackBoost + 10) * (100 / 25) * 0.2;
    }

    // Restructure university data for consistency
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
      matchReason: getMatchReason(user.profile!, user, opp, userSkills),
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);

  return {
    data: scored.slice(offset, offset + limit),
    total: scored.length,
  };
}

function getMatchReason(profile: any, user: any, opp: any, skills?: UserSkills | null): string {
  const reasons: { priority: number; text: string }[] = [];

  // Skill-based reasons (highest priority)
  if (skills?.core) {
    const matchedCore = skills.core.filter((skill: SkillEntry) =>
      opp.requiredSkills?.toLowerCase().includes(skill.name.toLowerCase()),
    );

    const matchedSide = skills.side.filter((skill: SkillEntry) =>
      opp.requiredSkills?.toLowerCase().includes(skill.name.toLowerCase()),
    );

    if (matchedCore.length >= 2) {
      reasons.push({
        priority: 1,
        text: `Le tue skills ${matchedCore.slice(0, 2).map((s: SkillEntry) => s.name).join(' e ')} sono richieste`,
      });
    } else if (matchedCore.length === 1) {
      reasons.push({
        priority: 1,
        text: `La tua skill ${matchedCore[0].name} è richiesta`,
      });
    } else if (matchedSide.length >= 1) {
      reasons.push({
        priority: 2,
        text: `La tua skill ${matchedSide[0].name} è un plus`,
      });
    }
  }

  // Existing reasons (lower priority)
  if (profile.primaryInterest === 'tech' && (opp.type === 'INTERNSHIP' || opp.type === 'STAGE')) {
    reasons.push({ priority: 3, text: 'In linea con i tuoi interessi tech' });
  }
  if (profile.primaryInterest === 'business' && opp.type === 'FELLOWSHIP') {
    reasons.push({ priority: 3, text: 'Perfetto per il tuo percorso imprenditoriale' });
  }
  if (profile.clusterTag === 'Creativo' && opp.type === 'EXTRACURRICULAR') {
    reasons.push({ priority: 4, text: 'Adatto al tuo profilo creativo' });
  }
  if (opp.isRemote && user.willingToRelocate === 'NO') {
    reasons.push({ priority: 5, text: 'Disponibile in remoto' });
  }

  if (reasons.length === 0) return 'Opportunità consigliata per te';

  return reasons
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 2)
    .map((r) => r.text)
    .join(' · ');
}
