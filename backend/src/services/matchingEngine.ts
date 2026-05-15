import { UserProfile, User, Opportunity, GpaRange, EnglishLevel, UserInteraction, OpportunityType, FieldOfStudy, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import type { UserSkills, SkillEntry } from './skills.service';
import { normalizeFieldToEnum, isSeniorRole } from './import/utils';

export interface OppFilters {
  search?: string;
  company?: string;
  location?: string;
  isRemote?: boolean;
  isAbroad?: boolean;
  englishLevels?: string[];
  deadline?: string;
}

function applyOppFilters(items: any[], f: OppFilters): any[] {
  return items.filter((opp) => {
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!(opp.title || '').toLowerCase().includes(q) && !(opp.company || '').toLowerCase().includes(q)) return false;
    }
    if (f.company && !(opp.company || '').toLowerCase().includes(f.company.toLowerCase())) return false;
    if (f.location && !(opp.location || '').toLowerCase().includes(f.location.toLowerCase())) return false;
    if (f.isRemote !== undefined && Boolean(opp.isRemote) !== f.isRemote) return false;
    if (f.isAbroad !== undefined && Boolean(opp.isAbroad) !== f.isAbroad) return false;
    if (f.englishLevels?.length && (!opp.requiredEnglishLevel || !f.englishLevels.includes(opp.requiredEnglishLevel))) return false;
    if (f.deadline && opp.deadline) {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const d = new Date(opp.deadline); d.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86400000);
      if (f.deadline === '7' && daysLeft > 7) return false;
      if (f.deadline === '30' && daysLeft > 30) return false;
      if (f.deadline === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
    }
    return true;
  });
}

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

// Passion value → opportunity tags (used for tag-content matching, max 20 pts)
const PASSION_TAG_MAP: Record<string, string[]> = {
  // Legacy seed values
  computer_science:    ['tech', 'react', 'nodejs', 'typescript', 'frontend', 'python', 'ml', 'data', 'cloud', 'ai', 'iot', 'security', 'cybersecurity'],
  entrepreneurship:    ['startup', 'entrepreneurship', 'innovation', 'pitching', 'strategy', 'business'],
  design:              ['design', 'ux', 'figma', 'fashion', 'communication'],
  literature:          ['culture', 'literature', 'education', 'research', 'debate'],
  engineering:         ['engineering', 'r&d', 'automotive', 'iot', 'science', 'physics'],
  languages:           ['international', 'erasmus', 'culture'],
  management:          ['consulting', 'strategy', 'business', 'management', 'finance', 'banking', 'graduate'],
  music:               ['music', 'culture', 'performance'],
  // InterestSelection values
  ai_ml:               ['ai', 'ml', 'python', 'data', 'tech', 'research', 'cloud'],
  web_development:     ['tech', 'react', 'nodejs', 'frontend', 'typescript', 'startup'],
  data_science:        ['data', 'python', 'ml', 'ai', 'research', 'tech'],
  mobile_dev:          ['tech', 'react', 'nodejs', 'frontend', 'startup'],
  ricerca_scientifica: ['research', 'science', 'physics', 'r&d', 'education'],
  business_strategy:   ['consulting', 'strategy', 'business', 'entrepreneurship', 'startup', 'pitching'],
  finance:             ['finance', 'banking', 'audit', 'consulting', 'graduate'],
  sustainability:      ['sustainability', 'environment', 'energy', 'social', 'volunteering'],
  marketing:           ['marketing', 'social', 'digital', 'communication', 'pr', 'events'],
  law_policy:          ['consulting', 'strategy', 'social', 'debate'],
  healthcare:          ['healthcare', 'science', 'research', 'social', 'volunteering'],
};

// PrimaryInterest → tags (fallback when no passions defined)
const INTEREST_TAG_MAP: Record<string, string[]> = {
  tech:     ['tech', 'react', 'nodejs', 'typescript', 'frontend', 'python', 'ml', 'data', 'cloud', 'ai', 'iot', 'security', 'cybersecurity', 'engineering'],
  business: ['consulting', 'strategy', 'business', 'finance', 'banking', 'entrepreneurship', 'management', 'graduate'],
  creative: ['design', 'ux', 'figma', 'music', 'culture', 'communication', 'pr', 'fashion'],
  sport:    ['leadership', 'community', 'teamwork', 'social', 'speaking'],
  general:  ['career', 'networking', 'education', 'innovation'],
};

/**
 * Tag-passion alignment score (max 20 pts, additive bonus).
 * Counts how many opportunity tags overlap with tags derived from user passions.
 * Falls back to primaryInterest-derived tags if no passions are defined.
 * Each matching tag = 7 pts, capped at 20.
 */
function computeTagScore(
  profile: Pick<UserProfile, 'passions' | 'primaryInterest'>,
  opportunity: Pick<Opportunity, 'tags'>,
): number {
  const oppTags = (opportunity.tags || []).map((t) => t.toLowerCase().trim());
  if (oppTags.length === 0) return 0;

  const userTagSet = new Set<string>();
  for (const passion of profile.passions || []) {
    (PASSION_TAG_MAP[passion] || []).forEach((t) => userTagSet.add(t));
  }

  if (userTagSet.size === 0 && profile.primaryInterest) {
    (INTEREST_TAG_MAP[profile.primaryInterest] || []).forEach((t) => userTagSet.add(t));
  }

  if (userTagSet.size === 0) return 0;

  const matches = oppTags.filter((t) => userTagSet.has(t)).length;
  return Math.min(20, matches * 7);
}

/**
 * Compute skill match score (max 10 pts).
 * Core skill in requiredSkills → +4, in recommendedSkills → +2.
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
    if (reqSkills.includes(s)) score += 4;
    else if (recSkills.includes(s)) score += 2;
  }

  for (const skill of skills.side) {
    const s = normalize(skill.name);
    if (reqSkills.includes(s)) score += 2;
    else if (recSkills.includes(s)) score += 1;
  }

  return Math.min(score, 10);
}

/**
 * Profile-aware scoring function. Uses per-OpportunityType weight profiles
 * so that GPA matters for fellowships/research but not hackathons, field
 * match matters for summer schools but not generic internships, etc.
 * Adds a skill-match bonus (max +10, clamped to 100) on top.
 *
 * Score range: 0–100.
 */
export function scoreOpportunity(
  profile: UserProfile,
  user: Pick<User, 'gpa' | 'englishLevel' | 'willingToRelocate' | 'yearOfStudy' | 'courseOfStudy' | 'region' | 'city' | 'regionLock' | 'cityLock'>,
  opportunity: Opportunity,
  skills?: UserSkills | null,
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
    // Fully misaligned type → no points
  }

  // 2. Cluster tag → Schwartz cluster scores on the opportunity (preferred)
  //    Fallback to OpportunityType map for legacy opps not yet classified.
  const cluster = profile.clusterTag || 'Explorer';
  const oppClusterScores = (opportunity as any).clusterScores as Record<string, number> | null | undefined;
  if (oppClusterScores && typeof oppClusterScores === 'object' && oppClusterScores[cluster] !== undefined) {
    const w = Math.max(0, Math.min(1, oppClusterScores[cluster] ?? 0));
    score += Math.round(p.cluster * w);
  } else {
    const clusterTypes = CLUSTER_TYPE_MAP[cluster] ?? CLUSTER_TYPE_MAP.Explorer;
    if (clusterTypes[0] === opportunity.type) {
      score += p.cluster;
    } else if (clusterTypes.includes(opportunity.type)) {
      score += Math.round(p.cluster * 0.60);
    }
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

  // 5. Relocation willingness — uses structured country/region/city
  if (p.relocate > 0) {
    const opp = opportunity as any;
    const isRemote = opportunity.isRemote || opp.format === 'ONLINE';
    const oppCountry: string | null = opp.country ?? null;
    const oppRegion: string | null = opp.region ?? null;
    const oppCity: string | null = opp.city ?? null;
    const isItaly = oppCountry === 'IT' || (!oppCountry && !opportunity.isAbroad);

    if (isRemote) {
      score += p.relocate;
    } else if (user.cityLock && user.city) {
      score += oppCity && oppCity.toLowerCase() === user.city.toLowerCase() ? p.relocate : 0;
    } else if (user.regionLock && user.region) {
      score += oppRegion && oppRegion.toLowerCase() === user.region.toLowerCase() ? p.relocate : 0;
    } else if (user.willingToRelocate === 'NO') {
      score += isItaly ? p.relocate : 0;
    } else if (isItaly) {
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

  // 11. Tag-passion alignment bonus (additive, max +20, clamped to 100)
  const tagScore = computeTagScore(profile, opportunity);
  score += tagScore;

  // 12. Skill match bonus (additive, max +10, clamped to 100)
  score += computeSkillMatchScore(skills || null, opportunity);

  // 13. Field ineligibility penalty: if eligibleFields is set and user's field not in it
  const eligFields: FieldOfStudy[] = (opportunity as any).eligibleFields ?? [];
  if (eligFields.length > 0 && !eligFields.includes('ANY' as FieldOfStudy)) {
    const userField = user.courseOfStudy ? normalizeFieldToEnum(user.courseOfStudy) : ('ANY' as FieldOfStudy);
    if (userField !== 'ANY' && !eligFields.includes(userField)) {
      score = Math.round(score * 0.15);
    }
  }

  // 14. Tag-incoherence penalty: opportunity has domain-specific tags with zero overlap with user
  const oppTags = opportunity.tags || [];
  if (tagScore === 0 && oppTags.length >= 2) {
    const interest = profile.primaryInterest || 'general';
    const hasDefinedInterest = PASSION_TAG_MAP[interest] || INTEREST_TAG_MAP[interest];
    if (hasDefinedInterest) {
      score = Math.round(score * 0.4);
    }
  }

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
  user: Pick<User, 'gpa' | 'englishLevel' | 'willingToRelocate' | 'yearOfStudy' | 'courseOfStudy' | 'region' | 'city' | 'regionLock' | 'cityLock'>,
  opportunity: Opportunity,
  interactions: UserInteraction[],
  skills?: UserSkills | null,
): number {
  const baseScore = scoreOpportunity(profile, user, opportunity, skills);
  const feedbackBoost = computeFeedbackBoost(interactions, opportunity);
  return Math.max(0, Math.min(100, baseScore + feedbackBoost));
}

/**
 * Sorts a pre-scored opportunity list by "freshness" using three priority buckets,
 * while preserving matchScore ordering within each bucket.
 *
 * Bucket 0 — never seen:          highest priority
 * Bucket 1 — viewed, not clicked: deprioritized
 * Bucket 2 — external link clicked: lowest priority
 *
 * The matchScore field is NOT modified — this only affects display order.
 */
export function sortOpportunitiesByFreshness<T extends { id: string }>(
  opps: T[],
  viewedIds: Set<string>,
  clickedIds: Set<string>,
): T[] {
  const b0: T[] = [];
  const b1: T[] = [];
  const b2: T[] = [];
  for (const opp of opps) {
    if (clickedIds.has(opp.id)) b2.push(opp);
    else if (viewedIds.has(opp.id)) b1.push(opp);
    else b0.push(opp);
  }
  return [...b0, ...b1, ...b2];
}

// ─── Diversification (MMR) ──────────────────────────────────────────

/**
 * Re-ranks the top `windowSize` items so that adjacent items vary by type and cluster.
 * Uses a Maximal Marginal Relevance scheme: each pick maximizes
 *   lambda * normalizedScore + (1 - lambda) * diversityVsRecent
 * Items past the window are appended unchanged.
 *
 * `recentMemory` controls how many of the most recent picks influence the diversity term.
 */
function diversifyMMR<T extends { type: string; clusterPrimary?: string | null; matchScore: number }>(
  items: T[],
  windowSize: number = 40,
  lambda: number = 0.7,
  recentMemory: number = 5,
): T[] {
  if (items.length <= 1) return items;
  const window = items.slice(0, windowSize);
  const rest = items.slice(windowSize);
  const reranked: T[] = [];
  const remaining = window.slice();
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    const recent = reranked.slice(-recentMemory);
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      let sameType = 0;
      let sameCluster = 0;
      for (const r of recent) {
        if (r.type === c.type) sameType++;
        if (r.clusterPrimary && r.clusterPrimary === c.clusterPrimary) sameCluster++;
      }
      const diversity = Math.max(0, 1 - (sameType * 0.3 + sameCluster * 0.15));
      const mmr = lambda * (c.matchScore / 100) + (1 - lambda) * diversity;
      if (mmr > bestVal) { bestVal = mmr; bestIdx = i; }
    }
    reranked.push(remaining.splice(bestIdx, 1)[0]);
  }
  return [...reranked, ...rest];
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
  filters: OppFilters = {},
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
         WHERE (o."urlStatus" IS NULL OR o."urlStatus" != 'BROKEN')
         ORDER BY o."postedAt" DESC
         LIMIT $1 OFFSET $2`,
        limit, offset,
      ),
      prisma.opportunity.count({
        where: { OR: [{ urlStatus: null }, { urlStatus: { not: 'BROKEN' } }, { source: 'curated' }] },
      }),
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

  // Hard filter: structured location preference (city > region > country)
  // Replaces fragile regex on location string. Remote opps always allowed.
  let relocFilter = '';
  if (user.cityLock && user.city) {
    const safeCity = user.city.replace(/'/g, "''");
    relocFilter = `AND (o."isRemote" = true OR lower(o."city") = lower('${safeCity}'))`;
  } else if (user.regionLock && user.region) {
    const safeRegion = user.region.replace(/'/g, "''");
    relocFilter = `AND (o."isRemote" = true OR lower(o."region") = lower('${safeRegion}'))`;
  } else if (user.willingToRelocate === 'NO') {
    relocFilter = `AND (o."isRemote" = true OR o."country" = 'IT' OR (o."country" IS NULL AND o."isAbroad" = false))`;
  }

  // Hard filter: exclude opportunities outside user's field of study.
  // When user.courseOfStudy doesn't match any known field (userField='ANY'),
  // we still exclude opps that explicitly restrict eligibleFields — only fully open opps pass.
  const userField = user.courseOfStudy ? normalizeFieldToEnum(user.courseOfStudy) : 'ANY';
  const fieldFilter = userField !== 'ANY'
    ? `AND (o."eligibleFields" = '{}' OR 'ANY' = ANY(o."eligibleFields") OR '${userField}' = ANY(o."eligibleFields"))`
    : `AND (o."eligibleFields" = '{}' OR 'ANY' = ANY(o."eligibleFields"))`;

  // Hard filter: senior/experienced roles that leak under INTERNSHIP/STAGE tagging.
  // We mirror isSeniorRole() semantics: senior pattern triggers exclusion UNLESS a safe
  // pattern (intern/junior/trainee/...) is also present. The "years of experience" pattern
  // is always disqualifying.
  const seniorLeakFilter = `
    AND NOT (
      lower(o."title") ~ '(^|[^a-z])(senior|sr\\.?|director|head of|vp|vice president|lead|principal|staff|chief|cto|ceo|cmo|coo|cpo|manager|responsabile)([^a-z]|$)'
      AND NOT lower(o."title") ~ '(^|[^a-z])(intern|interns|internship|internships|stage|tirocinio|stagista|trainee|junior|graduate program|werkstudent|apprenti|alternance|stagiaire|praktikant|borsista)([^a-z]|$)'
    )
    AND NOT lower(o."title") ~ '\\d+\\+? *(years?|anni?) +(of +)?(experience|esperienza)'`;

  if (userHasEmbedding) {
    // Stage 1: Candidate retrieval — all opportunities with vector similarity
    // Explicitly list columns to avoid selecting the Unsupported vector column
    candidates = await prisma.$queryRawUnsafe<any[]>(
      `SELECT o."id", o."title", o."description", o."about", o."url", o."type",
              o."universityId", o."company", o."location", o."isRemote", o."isAbroad",
              o."requiredEnglishLevel", o."minGpa", o."tags", o."deadline",
              o."postedAt", o."expiresAt", o."source", o."sourceId", o."lastSyncedAt",
              o."eligibleFields", o."country", o."city", o."region", o."format",
              o."clusterScores", o."clusterPrimary", o."minYearOfStudy", o."maxYearOfStudy",
              o."cost", o."hasScholarship",
              u."name" as "universityName", u."city" as "universityCity",
              u."id" as "uniId", u."logoUrl" as "universityLogoUrl",
              CASE WHEN o.embedding IS NOT NULL THEN 1 - (o.embedding <=> usr.embedding) ELSE 0 END AS "vectorSimilarity"
       FROM "Opportunity" o
       LEFT JOIN "University" u ON o."universityId" = u."id"
       CROSS JOIN "User" usr
       WHERE usr.id = $1
         AND (o."expiresAt" IS NULL OR o."expiresAt" > NOW())
         AND (
           o."type" IN ('EVENT', 'CONFERENCE')
           OR o."deadline" IS NULL
           OR o."deadline" > NOW()
         )
         AND (
           o."type" NOT IN ('EVENT', 'CONFERENCE')
           OR o."endDate" IS NULL
           OR o."endDate" >= CURRENT_DATE
         )
         AND (o."urlStatus" IS NULL OR o."urlStatus" != 'BROKEN' OR o."source" = 'curated')
         ${relocFilter}
         ${fieldFilter}
         ${seniorLeakFilter}
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
              o."eligibleFields", o."country", o."city", o."region", o."format",
              o."clusterScores", o."clusterPrimary", o."minYearOfStudy", o."maxYearOfStudy",
              o."cost", o."hasScholarship",
              u."name" as "universityName", u."city" as "universityCity",
              u."id" as "uniId", u."logoUrl" as "universityLogoUrl"
       FROM "Opportunity" o
       LEFT JOIN "University" u ON o."universityId" = u."id"
       WHERE (o."expiresAt" IS NULL OR o."expiresAt" > NOW())
         AND (
           o."type" IN ('EVENT', 'CONFERENCE')
           OR o."deadline" IS NULL
           OR o."deadline" > NOW()
         )
         AND (
           o."type" NOT IN ('EVENT', 'CONFERENCE')
           OR o."endDate" IS NULL
           OR o."endDate" >= CURRENT_DATE
         )
         AND (o."urlStatus" IS NULL OR o."urlStatus" != 'BROKEN' OR o."source" = 'curated')
         ${relocFilter}
         ${fieldFilter}
         ${seniorLeakFilter}
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
      source: opp.source,
      sourceId: opp.sourceId,
      clusterPrimary: opp.clusterPrimary ?? null,
      matchScore: Math.max(0, Math.min(100, Math.round(hybridScore))),
      matchReason: getMatchReason(user.profile!, user, opp, userSkills),
    };
  });

  // Sort by matchScore, tie-break on id for deterministic pagination across requests.
  scored.sort((a, b) => b.matchScore - a.matchScore || a.id.localeCompare(b.id));

  // MMR diversification on the top 40 — mix types/clusters at the head of the feed
  // so the first pages aren't monoculture INTERNSHIP.
  const diversified = diversifyMMR(scored, 40, 0.7, 5);

  // Derive view/click sets from the already-fetched interactions (90-day window)
  const viewedIds = new Set(interactions.filter((i) => i.action === 'view').map((i) => i.targetId));
  const clickedIds = new Set(interactions.filter((i) => i.action === 'click').map((i) => i.targetId));
  const ranked = sortOpportunitiesByFreshness(diversified, viewedIds, clickedIds);

  const filtered = Object.keys(filters).length ? applyOppFilters(ranked, filters) : ranked;
  return {
    data: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

/**
 * Scoring algorithm for the "Nuove" tab.
 * Formula: RecencyScore * 0.30 + MatchScore * 0.30 + NoveltyBonus * 0.40
 *
 * RecencyScore: exponential decay based on days since postedAt (100 × e^(-0.07 × days))
 * MatchScore:   base weighted score from scoreOpportunity (0-100)
 * NoveltyBonus: 100 if user has no interaction with this opportunity, 0 otherwise
 */
export async function getNewOpportunities(
  userId: string,
  limit: number = 20,
  offset: number = 0,
  filters: OppFilters = {},
): Promise<{ data: any[]; total: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  // Build Prisma where from filters
  const where: Prisma.OpportunityWhereInput = {};
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { company: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.company) where.company = { contains: filters.company, mode: 'insensitive' };
  if (filters.location) where.location = { contains: filters.location, mode: 'insensitive' };
  if (filters.isRemote !== undefined) where.isRemote = filters.isRemote;
  if (filters.isAbroad !== undefined) where.isAbroad = filters.isAbroad;
  if (filters.englishLevels?.length) where.requiredEnglishLevel = { in: filters.englishLevels as any };

  // Always exclude expired listings, past-deadline, and broken-URL opportunities.
  // EVENT/CONFERENCE types use endDate (not deadline) — they don't have an application deadline.
  // Curated rows are exempt from urlStatus=BROKEN (manually verified; urlChecker false-positives).
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const nowTs = new Date();
  where.AND = [
    { OR: [{ expiresAt: null }, { expiresAt: { gt: nowTs } }] },
    {
      OR: [
        {
          AND: [
            { type: { in: ['EVENT', 'CONFERENCE'] } },
            { OR: [{ endDate: null }, { endDate: { gte: todayStart } }] },
          ],
        },
        {
          AND: [
            { type: { notIn: ['EVENT', 'CONFERENCE'] } },
            { OR: [{ deadline: null }, { deadline: { gt: nowTs } }] },
          ],
        },
      ],
    },
    { OR: [{ urlStatus: null }, { urlStatus: { not: 'BROKEN' } }, { source: 'curated' }] },
  ];

  // Hard filter: users who explicitly don't want to relocate never see in-person abroad opportunities
  if (user?.willingToRelocate === 'NO') {
    (where.AND as Prisma.OpportunityWhereInput[]).push(
      { OR: [{ isAbroad: false }, { isRemote: true }] },
    );
  }

  // Hard filter: exclude opportunities outside user's eligible field of study
  if (user?.courseOfStudy) {
    const userField = normalizeFieldToEnum(user.courseOfStudy);
    if (userField !== 'ANY') {
      (where.AND as Prisma.OpportunityWhereInput[]).push({
        OR: [
          { eligibleFields: { isEmpty: true } },
          { eligibleFields: { has: 'ANY' as FieldOfStudy } },
          { eligibleFields: { has: userField } },
        ],
      });
    }
  }

  if (filters.deadline) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    if (filters.deadline === '7' || filters.deadline === '30') {
      const end = new Date(now); end.setDate(end.getDate() + parseInt(filters.deadline));
      where.deadline = { gte: now, lte: end };
    } else if (filters.deadline === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      where.deadline = { gte: start, lte: end };
    }
  }

  // Fetch opportunities (pre-filtered for efficiency)
  const allOppsRaw = await prisma.opportunity.findMany({
    where: Object.keys(where).length ? where : undefined,
    include: { university: true },
    orderBy: { postedAt: 'desc' },
  });
  // Strip senior/experienced roles that leak under INTERNSHIP/STAGE tagging
  const allOpps = allOppsRaw.filter((o) => !isSeniorRole(o.title));

  // Fetch opportunity IDs the user has saved/applied (novelty = 0)
  const seenInteractions = await prisma.userInteraction.findMany({
    where: { userId, targetType: 'opportunity', action: { in: ['save', 'unsave', 'apply'] } },
    select: { targetId: true },
    distinct: ['targetId'],
  });
  const seenIds = new Set(seenInteractions.map((i) => i.targetId));

  // Fetch opportunity IDs the user has viewed (25% ranking penalty)
  const viewedInteractions = await prisma.userInteraction.findMany({
    where: { userId, targetType: 'opportunity', action: 'view' },
    select: { targetId: true },
    distinct: ['targetId'],
  });
  const viewedIds = new Set(viewedInteractions.map((i) => i.targetId));

  const userSkills = user ? parseUserSkills(user.skills) : null;

  const now = Date.now();

  const scored = allOpps.map((opp) => {
    // RecencyScore: exponential decay (100 × e^(−0.07 × days_old))
    const daysOld = (now - new Date(opp.postedAt).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = 100 * Math.exp(-0.07 * daysOld);

    // Profile match score (0-100) — used for display
    let profileMatchScore = 0;
    if (user?.profile) {
      profileMatchScore = scoreOpportunity(user.profile, user, opp, userSkills);
    }

    // NoveltyBonus: 100 if never saved/applied, 0 otherwise
    const noveltyBonus = seenIds.has(opp.id) ? 0 : 100;

    // View penalty: viewed opportunities score 25% less
    const viewMultiplier = viewedIds.has(opp.id) ? 0.75 : 1.0;

    // Composite score for ranking only (not shown to user)
    const rankingScore = (recencyScore * 0.30 + profileMatchScore * 0.30 + noveltyBonus * 0.40) * viewMultiplier;

    return {
      id: opp.id,
      title: opp.title,
      description: opp.description,
      about: opp.about,
      url: opp.url,
      type: opp.type,
      universityId: opp.universityId,
      university: opp.university,
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
      matchScore: profileMatchScore,      // pure profile match — shown on card
      _rankingScore: rankingScore,        // composite — used only for sort
      isNew: daysOld <= 3,
    };
  });

  scored.sort((a, b) => b._rankingScore - a._rankingScore);

  // Strip internal ranking field before returning
  const data = scored.slice(offset, offset + limit).map(({ _rankingScore, ...opp }) => opp);

  return { data, total: scored.length };
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

  // Field match
  if (opp.eligibleFields?.length > 0 && user.courseOfStudy) {
    const userField = normalizeFieldToEnum(user.courseOfStudy);
    if (opp.eligibleFields.includes(userField)) {
      reasons.push({ priority: 2, text: 'Aperto al tuo percorso di studi' });
    }
  }

  // Free / scholarship
  if (opp.hasScholarship) reasons.push({ priority: 2, text: 'Borsa di studio disponibile' });
  if (opp.cost === 0) reasons.push({ priority: 2, text: 'Partecipazione gratuita' });

  // Deadline urgency
  if (opp.deadline) {
    const daysUntil = (new Date(opp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntil > 0 && daysUntil <= 7) {
      reasons.push({ priority: 2, text: `Scade tra ${Math.ceil(daysUntil)} giorni` });
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
    reasons.push({ priority: 5, text: 'Disponibile in remoto' });
  }

  if (reasons.length === 0) return 'Opportunità consigliata per te';

  return reasons
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 2)
    .map((r) => r.text)
    .join(' · ');
}
