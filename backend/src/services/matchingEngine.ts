import { UserProfile, User, Opportunity, GpaRange, EnglishLevel, UserInteraction, OpportunityType, FieldOfStudy } from '@prisma/client';
import prisma from '../lib/prisma';
import { normalizeFieldToEnum } from './import/utils';

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

// Interest → preferred opportunity types (ordered: first = top match)
const INTEREST_TYPE_MAP: Record<string, OpportunityType[]> = {
  tech:               ['INTERNSHIP', 'STAGE', 'HACKATHON', 'BOOTCAMP', 'RESEARCH'],
  business:           ['FELLOWSHIP', 'INTERNSHIP', 'SUMMER_PROGRAM', 'COMPETITION', 'CONFERENCE'],
  creative:           ['EXTRACURRICULAR', 'EVENT', 'CONFERENCE', 'BOOTCAMP'],
  sport:              ['EXTRACURRICULAR', 'EVENT', 'COMPETITION'],
  general:            ['STAGE', 'EVENT', 'EXTRACURRICULAR'],
  // onboarding InterestSelection values
  ai_ml:              ['RESEARCH', 'HACKATHON', 'INTERNSHIP', 'BOOTCAMP'],
  web_development:    ['INTERNSHIP', 'STAGE', 'HACKATHON', 'BOOTCAMP'],
  data_science:       ['RESEARCH', 'HACKATHON', 'INTERNSHIP', 'COMPETITION'],
  mobile_dev:         ['INTERNSHIP', 'STAGE', 'HACKATHON', 'BOOTCAMP'],
  ricerca_scientifica:['RESEARCH', 'FELLOWSHIP', 'EXCHANGE', 'SUMMER_PROGRAM'],
  business_strategy:  ['FELLOWSHIP', 'COMPETITION', 'SUMMER_PROGRAM', 'CONFERENCE'],
  finance:            ['INTERNSHIP', 'FELLOWSHIP', 'COMPETITION'],
  sustainability:     ['VOLUNTEERING', 'RESEARCH', 'EXCHANGE', 'FELLOWSHIP'],
  marketing:          ['INTERNSHIP', 'STAGE', 'EVENT', 'CONFERENCE'],
  law_policy:         ['FELLOWSHIP', 'COMPETITION', 'CONFERENCE', 'EXCHANGE'],
  healthcare:         ['RESEARCH', 'VOLUNTEERING', 'EXCHANGE', 'INTERNSHIP'],
};

// Cluster tag → preferred opportunity types (ordered: first = top match)
const CLUSTER_TYPE_MAP: Record<string, OpportunityType[]> = {
  Analista:     ['INTERNSHIP', 'STAGE', 'RESEARCH', 'HACKATHON', 'COMPETITION'],
  Creativo:     ['EXTRACURRICULAR', 'EVENT', 'CONFERENCE', 'BOOTCAMP'],
  Leader:       ['FELLOWSHIP', 'INTERNSHIP', 'COMPETITION', 'CONFERENCE', 'SUMMER_PROGRAM'],
  Imprenditore: ['FELLOWSHIP', 'STAGE', 'SUMMER_PROGRAM', 'COMPETITION', 'CONFERENCE'],
  Sociale:      ['EXTRACURRICULAR', 'EVENT', 'VOLUNTEERING', 'EXCHANGE', 'CONFERENCE'],
  Explorer:     ['EXCHANGE', 'SUMMER_PROGRAM', 'CONFERENCE', 'EVENT', 'RESEARCH', 'FELLOWSHIP'],
};

// ---------------------------------------------------------------------------
// Per-type scoring profiles
// ---------------------------------------------------------------------------

interface ScoringProfile {
  // Base dimension weights — their sum + bonus sum = 100 for a perfect match
  interest: number;
  cluster: number;
  gpa: number;
  english: number;
  relocate: number;
  year: number;
  // Adjustment bonuses (awarded if criteria met; 0 otherwise)
  fieldMatchBonus: number;      // user field of study ∈ eligibleFields
  costBonus: number;            // cost == 0 || hasScholarship
  deadlineUrgencyBonus: number; // deadline within 14 days (don't miss it)
  locationMatchBonus: number;   // reserved V2 — always 0 until user.country available
}

// Each profile: base weights + bonus maxima sum to 100
const SCORING_PROFILES: Record<OpportunityType, ScoringProfile> = {
  //                        interest cluster gpa english relocate year | field cost  dead  loc
  STAGE:          { interest:30, cluster:25, gpa:15, english:15, relocate:10, year:5,  fieldMatchBonus:0,  costBonus:0,  deadlineUrgencyBonus:0,  locationMatchBonus:0  },
  INTERNSHIP:     { interest:30, cluster:25, gpa:15, english:15, relocate:10, year:5,  fieldMatchBonus:0,  costBonus:0,  deadlineUrgencyBonus:0,  locationMatchBonus:0  },
  EXTRACURRICULAR:{ interest:25, cluster:25, gpa:5,  english:10, relocate:10, year:5,  fieldMatchBonus:5,  costBonus:5,  deadlineUrgencyBonus:0,  locationMatchBonus:10 },
  EVENT:          { interest:20, cluster:10, gpa:0,  english:5,  relocate:10, year:0,  fieldMatchBonus:10, costBonus:15, deadlineUrgencyBonus:10, locationMatchBonus:20 },
  FELLOWSHIP:     { interest:20, cluster:20, gpa:20, english:20, relocate:10, year:5,  fieldMatchBonus:0,  costBonus:0,  deadlineUrgencyBonus:5,  locationMatchBonus:0  },
  SUMMER_PROGRAM: { interest:15, cluster:15, gpa:5,  english:15, relocate:10, year:5,  fieldMatchBonus:15, costBonus:15, deadlineUrgencyBonus:0,  locationMatchBonus:5  },
  HACKATHON:      { interest:15, cluster:10, gpa:0,  english:10, relocate:5,  year:0,  fieldMatchBonus:20, costBonus:15, deadlineUrgencyBonus:15, locationMatchBonus:10 },
  COMPETITION:    { interest:15, cluster:15, gpa:5,  english:15, relocate:10, year:5,  fieldMatchBonus:15, costBonus:5,  deadlineUrgencyBonus:10, locationMatchBonus:5  },
  EXCHANGE:       { interest:10, cluster:15, gpa:10, english:25, relocate:15, year:10, fieldMatchBonus:5,  costBonus:0,  deadlineUrgencyBonus:10, locationMatchBonus:0  },
  VOLUNTEERING:   { interest:10, cluster:20, gpa:0,  english:15, relocate:15, year:5,  fieldMatchBonus:10, costBonus:5,  deadlineUrgencyBonus:5,  locationMatchBonus:15 },
  CONFERENCE:     { interest:20, cluster:10, gpa:0,  english:10, relocate:10, year:0,  fieldMatchBonus:10, costBonus:15, deadlineUrgencyBonus:5,  locationMatchBonus:20 },
  BOOTCAMP:       { interest:20, cluster:10, gpa:5,  english:10, relocate:10, year:5,  fieldMatchBonus:15, costBonus:15, deadlineUrgencyBonus:0,  locationMatchBonus:10 },
  RESEARCH:       { interest:15, cluster:10, gpa:25, english:20, relocate:10, year:0,  fieldMatchBonus:15, costBonus:0,  deadlineUrgencyBonus:5,  locationMatchBonus:0  },
};

/**
 * Profile-aware scoring function. Uses per-OpportunityType weight profiles
 * so that GPA matters for fellowships/research but not hackathons, field
 * match matters for summer schools but not generic internships, etc.
 *
 * Score range: 0–100.
 */
export function scoreOpportunity(
  profile: UserProfile,
  user: Pick<User, 'gpa' | 'englishLevel' | 'willingToRelocate' | 'yearOfStudy' | 'courseOfStudy'>,
  opportunity: Opportunity,
): number {
  const p = SCORING_PROFILES[opportunity.type] ?? SCORING_PROFILES.INTERNSHIP;
  let score = 0;

  // 1. Primary interest → opportunity type
  const interest = profile.primaryInterest || 'general';
  const preferredTypes = INTEREST_TYPE_MAP[interest] ?? INTEREST_TYPE_MAP.general;
  if (preferredTypes[0] === opportunity.type) {
    score += p.interest;
  } else if (preferredTypes.includes(opportunity.type)) {
    score += Math.round(p.interest * 0.65);
  } else {
    score += Math.round(p.interest * 0.15);
  }

  // 2. Cluster tag → opportunity type
  const cluster = profile.clusterTag || 'Explorer';
  const clusterTypes = CLUSTER_TYPE_MAP[cluster] ?? CLUSTER_TYPE_MAP.Explorer;
  if (clusterTypes[0] === opportunity.type) {
    score += p.cluster;
  } else if (clusterTypes.includes(opportunity.type)) {
    score += Math.round(p.cluster * 0.60);
  } else {
    score += Math.round(p.cluster * 0.15);
  }

  // 3. GPA sufficient
  if (p.gpa > 0) {
    if (!opportunity.minGpa) {
      score += p.gpa;
    } else if (user.gpa && GPA_ORDER[user.gpa] >= GPA_ORDER[opportunity.minGpa]) {
      score += p.gpa;
    } else if (user.gpa && GPA_ORDER[user.gpa] === GPA_ORDER[opportunity.minGpa] - 1) {
      score += Math.round(p.gpa * 0.5);
    }
  }

  // 4. English level
  if (p.english > 0) {
    if (!opportunity.requiredEnglishLevel) {
      score += p.english;
    } else if (user.englishLevel && ENGLISH_ORDER[user.englishLevel] >= ENGLISH_ORDER[opportunity.requiredEnglishLevel]) {
      score += p.english;
    } else if (user.englishLevel && ENGLISH_ORDER[user.englishLevel] === ENGLISH_ORDER[opportunity.requiredEnglishLevel] - 1) {
      score += Math.round(p.english * 0.5);
    }
  }

  // 5. Relocation willingness
  if (p.relocate > 0) {
    if (!opportunity.isAbroad && !opportunity.location) {
      score += p.relocate;
    } else if (opportunity.isRemote || (opportunity as any).format === 'ONLINE') {
      score += p.relocate;
    } else if (user.willingToRelocate === 'YES') {
      score += p.relocate;
    } else if (user.willingToRelocate === 'MAYBE') {
      score += Math.round(p.relocate * 0.5);
    }
  }

  // 6. Year of study accessibility
  if (p.year > 0) {
    const opp = opportunity as any;
    const yearOk =
      !user.yearOfStudy ||
      (!opp.minYearOfStudy && !opp.maxYearOfStudy) ||
      ((!opp.minYearOfStudy || user.yearOfStudy >= opp.minYearOfStudy) &&
       (!opp.maxYearOfStudy || user.yearOfStudy <= opp.maxYearOfStudy));
    if (yearOk) {
      score += p.year;
    } else {
      score += Math.round(p.year * 0.3);
    }
  }

  // 7. Field of study bonus
  if (p.fieldMatchBonus > 0) {
    const opp = opportunity as any;
    const eligibleFields: FieldOfStudy[] = opp.eligibleFields ?? [];
    if (eligibleFields.length === 0) {
      // No restriction → full bonus
      score += p.fieldMatchBonus;
    } else if (user.courseOfStudy) {
      const userField = normalizeFieldToEnum(user.courseOfStudy);
      if (userField === 'ANY' || eligibleFields.includes(userField) || eligibleFields.includes('ANY')) {
        score += p.fieldMatchBonus;
      }
    }
  }

  // 8. Cost / scholarship bonus (free or covered = good match for students)
  if (p.costBonus > 0) {
    const opp = opportunity as any;
    const isFreeOrCovered = opp.cost == null || opp.cost === 0 || opp.hasScholarship;
    if (isFreeOrCovered) score += p.costBonus;
  }

  // 9. Deadline urgency bonus (closing within 14 days = surface it now)
  if (p.deadlineUrgencyBonus > 0 && opportunity.deadline) {
    const daysUntil = (opportunity.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntil > 0 && daysUntil <= 14) score += p.deadlineUrgencyBonus;
  }

  // 10. Location match bonus — V2 (requires user.country, skipped for now)

  return Math.min(score, 100);
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
 * Base score (0-100) + feedback adjustment (-10 to +15), clamped to 0-100.
 */
export function scoreOpportunityWithFeedback(
  profile: UserProfile,
  user: Pick<User, 'gpa' | 'englishLevel' | 'willingToRelocate' | 'yearOfStudy' | 'courseOfStudy'>,
  opportunity: Opportunity,
  interactions: UserInteraction[],
): number {
  const baseScore = scoreOpportunity(profile, user, opportunity);
  const feedbackBoost = computeFeedbackBoost(interactions, opportunity);
  return Math.max(0, Math.min(100, baseScore + feedbackBoost));
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
    // Use raw query to avoid Prisma failing on the Unsupported vector column
    const [opps, total] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT o."id", o."title", o."description", o."about", o."url", o."type",
                o."universityId", o."company", o."location", o."isRemote", o."isAbroad",
                o."requiredEnglishLevel", o."minGpa", o."tags", o."deadline",
                o."postedAt", o."expiresAt", o."source", o."sourceId", o."lastSyncedAt",
                u."name" as "universityName", u."city" as "universityCity",
                u."id" as "uniId", u."logoUrl" as "universityLogoUrl"
         FROM "Opportunity" o
         LEFT JOIN "University" u ON o."universityId" = u."id"
         ORDER BY o."postedAt" DESC
         LIMIT $1 OFFSET $2`,
        limit, offset,
      ),
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
    // Stage 1: Candidate retrieval — all opportunities with vector similarity
    // Explicitly list columns to avoid selecting the Unsupported vector column
    candidates = await prisma.$queryRawUnsafe<any[]>(
      `SELECT o."id", o."title", o."description", o."about", o."url", o."type",
              o."universityId", o."company", o."location", o."isRemote", o."isAbroad",
              o."requiredEnglishLevel", o."minGpa", o."tags", o."deadline",
              o."postedAt", o."expiresAt", o."source", o."sourceId", o."lastSyncedAt",
              u."name" as "universityName", u."city" as "universityCity",
              u."id" as "uniId", u."logoUrl" as "universityLogoUrl",
              CASE WHEN o.embedding IS NOT NULL THEN 1 - (o.embedding <=> usr.embedding) ELSE 0 END AS "vectorSimilarity"
       FROM "Opportunity" o
       LEFT JOIN "University" u ON o."universityId" = u."id"
       CROSS JOIN "User" usr
       WHERE usr.id = $1
       ORDER BY o."postedAt" DESC`,
      userId,
    );
  } else {
    // Fallback: get all opportunities (Phase 1 behavior)
    // Use raw query to avoid Prisma failing on the Unsupported vector column
    candidates = await prisma.$queryRawUnsafe<any[]>(
      `SELECT o."id", o."title", o."description", o."about", o."url", o."type",
              o."universityId", o."company", o."location", o."isRemote", o."isAbroad",
              o."requiredEnglishLevel", o."minGpa", o."tags", o."deadline",
              o."postedAt", o."expiresAt", o."source", o."sourceId", o."lastSyncedAt",
              u."name" as "universityName", u."city" as "universityCity",
              u."id" as "uniId", u."logoUrl" as "universityLogoUrl"
       FROM "Opportunity" o
       LEFT JOIN "University" u ON o."universityId" = u."id"
       ORDER BY o."postedAt" DESC`,
    );
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

  // Stage 2: Re-rank with hybrid scoring
  const scored = candidates.map((opp) => {
    const baseScore = scoreOpportunity(user.profile!, user, opp);
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
      source: opp.source,
      sourceId: opp.sourceId,
      matchScore: Math.max(0, Math.min(100, Math.round(hybridScore))),
      matchReason: getMatchReason(user.profile!, user, opp),
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);

  return {
    data: scored.slice(offset, offset + limit),
    total: scored.length,
  };
}

function getMatchReason(profile: any, user: any, opp: any): string {
  const reasons: { priority: number; text: string }[] = [];

  // Field match
  if (opp.eligibleFields?.length > 0 && user.courseOfStudy) {
    const userField = normalizeFieldToEnum(user.courseOfStudy);
    if (opp.eligibleFields.includes(userField)) {
      reasons.push({ priority: 1, text: 'Aperto al tuo percorso di studi' });
    }
  }

  // Free / scholarship
  if (opp.hasScholarship) reasons.push({ priority: 2, text: 'Borsa di studio disponibile' });
  if (opp.cost === 0) reasons.push({ priority: 2, text: 'Partecipazione gratuita' });

  // Deadline urgency
  if (opp.deadline) {
    const daysUntil = (new Date(opp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntil > 0 && daysUntil <= 7) {
      reasons.push({ priority: 1, text: `Scade tra ${Math.ceil(daysUntil)} giorni` });
    }
  }

  // Type-specific reasons
  const typeReasons: Partial<Record<string, string>> = {
    HACKATHON:      'Ottimo per il tuo profilo tecnico',
    RESEARCH:       'In linea con i tuoi interessi di ricerca',
    FELLOWSHIP:     'Perfetto per accelerare il tuo percorso',
    EXCHANGE:       'Esperienza internazionale consigliata per te',
    SUMMER_PROGRAM: 'Programma estivo in linea con i tuoi interessi',
    COMPETITION:    'Metti alla prova le tue competenze',
    CONFERENCE:     'Espandi la tua rete professionale',
    VOLUNTEERING:   'In linea con i tuoi valori',
    BOOTCAMP:       'Accelera le tue competenze pratiche',
  };
  if (typeReasons[opp.type]) {
    reasons.push({ priority: 3, text: typeReasons[opp.type]! });
  }

  // Interest/cluster generic reasons (lower priority)
  if (profile.primaryInterest === 'tech' && (opp.type === 'INTERNSHIP' || opp.type === 'STAGE')) {
    reasons.push({ priority: 4, text: 'In linea con i tuoi interessi tech' });
  }
  if (profile.primaryInterest === 'business' && opp.type === 'FELLOWSHIP') {
    reasons.push({ priority: 4, text: 'Perfetto per il tuo percorso imprenditoriale' });
  }
  if (profile.clusterTag === 'Creativo' && opp.type === 'EXTRACURRICULAR') {
    reasons.push({ priority: 4, text: 'Adatto al tuo profilo creativo' });
  }
  if (opp.isRemote && user.willingToRelocate === 'NO') {
    reasons.push({ priority: 3, text: 'Disponibile in remoto' });
  }

  if (reasons.length === 0) return 'Opportunità consigliata per te';

  return reasons
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 2)
    .map(r => r.text)
    .join(' · ');
}
