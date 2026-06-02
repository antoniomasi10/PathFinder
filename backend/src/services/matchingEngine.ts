import { UserProfile, User, Opportunity, GpaRange, EnglishLevel, UserInteraction, OpportunityType, FieldOfStudy } from '@prisma/client';
import prisma from '../lib/prisma';
import type { UserSkills, SkillEntry } from './skills.service';
import { normalizeFieldToEnum } from './import/utils';
import { resolveLocationTokens } from './locationFilter';
import { logger } from '../utils/logger';

export interface OppFilters {
  search?: string;
  company?: string;
  location?: string;
  isRemote?: boolean;
  isAbroad?: boolean;
  englishLevels?: string[];
  deadline?: string;
  types?: string[];
  formats?: string[];
}

function applyOppFilters(items: any[], f: OppFilters): any[] {
  return items.filter((opp) => {
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!(opp.title || '').toLowerCase().includes(q) && !(opp.company || '').toLowerCase().includes(q)) return false;
    }
    if (f.company && !(opp.company || '').toLowerCase().includes(f.company.toLowerCase())) return false;
    if (f.location) {
      const tokens = resolveLocationTokens(f.location);
      const anyMatch = tokens.some(({ iso, term, aliases, region }) => {
        const allTerms = [term, ...aliases];
        // Word-boundary regex: \b(roma|rome)\b prevents "Roma" from matching "Romania"
        const escaped = allTerms.map(t => t.replace(/[$()*+.[\]?\\^{}|]/g, '\\$&'));
        const regex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
        const matchesLocation = regex.test(opp.location || '');
        const matchesCity = regex.test(opp.city || '');
        // City search: fall back to region (not country) so "Roma" never surfaces Milan results
        const matchesRegion = region ? (opp.region || '').toLowerCase() === region.toLowerCase() : false;
        const matchesCountry = (!region && iso) ? (opp.country || '').toUpperCase() === iso : false;
        return matchesLocation || matchesCity || matchesRegion || matchesCountry;
      });
      if (!anyMatch) return false;
    }
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
    if (f.types?.length && !f.types.includes(opp.type)) return false;
    if (f.formats?.length && !f.formats.includes(opp.format || '')) return false;
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
  business:           ['FELLOWSHIP', 'INTERNSHIP', 'SUMMER_PROGRAM', 'COMPETITION', 'EVENT'],
  creative:           ['EXTRACURRICULAR', 'EVENT', 'BOOTCAMP'],
  sport:              ['EXTRACURRICULAR', 'EVENT', 'COMPETITION'],
  general:            ['STAGE', 'EVENT', 'EXTRACURRICULAR'],
  // onboarding InterestSelection values
  ai_ml:              ['RESEARCH', 'HACKATHON', 'INTERNSHIP', 'BOOTCAMP'],
  web_development:    ['INTERNSHIP', 'STAGE', 'HACKATHON', 'BOOTCAMP'],
  data_science:       ['RESEARCH', 'HACKATHON', 'INTERNSHIP', 'COMPETITION'],
  mobile_dev:         ['INTERNSHIP', 'STAGE', 'HACKATHON', 'BOOTCAMP'],
  ricerca_scientifica:['RESEARCH', 'FELLOWSHIP', 'EXCHANGE', 'SUMMER_PROGRAM'],
  business_strategy:  ['FELLOWSHIP', 'COMPETITION', 'SUMMER_PROGRAM', 'EVENT'],
  finance:            ['INTERNSHIP', 'FELLOWSHIP', 'COMPETITION'],
  sustainability:     ['VOLUNTEERING', 'RESEARCH', 'EXCHANGE', 'FELLOWSHIP'],
  marketing:          ['INTERNSHIP', 'STAGE', 'EVENT'],
  law_policy:         ['FELLOWSHIP', 'COMPETITION', 'EVENT', 'EXCHANGE'],
  healthcare:         ['RESEARCH', 'VOLUNTEERING', 'EXCHANGE', 'INTERNSHIP'],
};

// Cluster tag → preferred opportunity types (ordered: first = top match)
const CLUSTER_TYPE_MAP: Record<string, OpportunityType[]> = {
  Analista:     ['INTERNSHIP', 'STAGE', 'RESEARCH', 'HACKATHON', 'COMPETITION'],
  Creativo:     ['EXTRACURRICULAR', 'EVENT', 'BOOTCAMP'],
  Leader:       ['FELLOWSHIP', 'INTERNSHIP', 'COMPETITION', 'EVENT', 'SUMMER_PROGRAM'],
  Imprenditore: ['FELLOWSHIP', 'STAGE', 'SUMMER_PROGRAM', 'COMPETITION', 'EVENT'],
  Sociale:      ['EXTRACURRICULAR', 'EVENT', 'VOLUNTEERING', 'EXCHANGE'],
  Explorer:     ['EXCHANGE', 'SUMMER_PROGRAM', 'EVENT', 'RESEARCH', 'FELLOWSHIP'],
};

// Tags that signal obvious field incompatibility when eligibleFields is not set.
// Used by step 16 to catch mismatches that AI classification missed (e.g. an aerospace
// engineering student getting 100% on a frontend intern with no eligibleFields).
// Partial: only fields where the mismatch is clear-cut; ANY/HUMANITIES/SOCIAL_SCIENCE omitted.
const FIELD_INCOMPATIBLE_TAGS: Partial<Record<FieldOfStudy, string[]>> = {
  ENGINEERING:      ['react', 'frontend', 'ui', 'ux', 'design', 'figma', 'css', 'html',
                     'marketing', 'fashion', 'pr', 'events', 'social media', 'copywriting'],
  COMPUTER_SCIENCE: ['fashion', 'textile', 'nursing', 'clinical', 'surgery', 'law', 'legal',
                     'accounting', 'audit', 'tax'],
  MEDICINE:         ['react', 'frontend', 'typescript', 'nodejs', 'devops', 'blockchain',
                     'marketing', 'fashion', 'finance', 'banking'],
  LAW:              ['react', 'frontend', 'engineering', 'manufacturing', 'clinical',
                     'nursing', 'fashion'],
  ECONOMICS:        ['react', 'frontend', 'typescript', 'nodejs', 'clinical', 'nursing',
                     'surgery', 'aerospace', 'mechanical'],
  BUSINESS:         ['react', 'frontend', 'typescript', 'nodejs', 'clinical', 'nursing',
                     'aerospace', 'mechanical'],
  DESIGN:           ['react', 'frontend', 'typescript', 'nodejs', 'clinical', 'nursing',
                     'banking', 'audit', 'aerospace', 'mechanical'],
  HUMANITIES:       ['react', 'frontend', 'typescript', 'nodejs', 'engineering',
                     'clinical', 'banking', 'audit'],
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
// All base weights scaled ×0.8 (sum = 80) so that tag-passion (+20 max) and skill (+10 max)
// bonuses are the true differentiators for reaching 90-100%. Previously weights summed to 100
// causing too many opportunities to be clamped at 100% with any tag overlap.
const SCORING_PROFILES: Record<OpportunityType, ScoringProfile> = {
  //                        interest cluster gpa english relocate year | field cost  dead  loc
  STAGE:          { interest:24, cluster:20, gpa:12, english:12, relocate:8,  year:4,  fieldMatchBonus:0,  costBonus:0,  deadlineUrgencyBonus:0,  locationMatchBonus:0  },
  INTERNSHIP:     { interest:24, cluster:20, gpa:12, english:12, relocate:8,  year:4,  fieldMatchBonus:0,  costBonus:0,  deadlineUrgencyBonus:0,  locationMatchBonus:0  },
  EXTRACURRICULAR:{ interest:20, cluster:20, gpa:4,  english:8,  relocate:8,  year:4,  fieldMatchBonus:4,  costBonus:4,  deadlineUrgencyBonus:0,  locationMatchBonus:8  },
  EVENT:          { interest:16, cluster:8,  gpa:0,  english:4,  relocate:8,  year:0,  fieldMatchBonus:8,  costBonus:12, deadlineUrgencyBonus:8,  locationMatchBonus:16 },
  FELLOWSHIP:     { interest:16, cluster:16, gpa:16, english:16, relocate:8,  year:4,  fieldMatchBonus:0,  costBonus:0,  deadlineUrgencyBonus:4,  locationMatchBonus:0  },
  SUMMER_PROGRAM: { interest:12, cluster:12, gpa:4,  english:12, relocate:8,  year:4,  fieldMatchBonus:12, costBonus:12, deadlineUrgencyBonus:0,  locationMatchBonus:4  },
  HACKATHON:      { interest:12, cluster:8,  gpa:0,  english:8,  relocate:4,  year:0,  fieldMatchBonus:16, costBonus:12, deadlineUrgencyBonus:12, locationMatchBonus:8  },
  COMPETITION:    { interest:12, cluster:12, gpa:4,  english:12, relocate:8,  year:4,  fieldMatchBonus:12, costBonus:4,  deadlineUrgencyBonus:8,  locationMatchBonus:4  },
  EXCHANGE:       { interest:8,  cluster:12, gpa:8,  english:20, relocate:12, year:8,  fieldMatchBonus:4,  costBonus:0,  deadlineUrgencyBonus:8,  locationMatchBonus:0  },
  VOLUNTEERING:   { interest:8,  cluster:16, gpa:0,  english:12, relocate:12, year:4,  fieldMatchBonus:8,  costBonus:4,  deadlineUrgencyBonus:4,  locationMatchBonus:12 },
  BOOTCAMP:       { interest:16, cluster:8,  gpa:4,  english:8,  relocate:8,  year:4,  fieldMatchBonus:12, costBonus:12, deadlineUrgencyBonus:0,  locationMatchBonus:8  },
  RESEARCH:       { interest:12, cluster:8,  gpa:20, english:16, relocate:8,  year:0,  fieldMatchBonus:12, costBonus:0,  deadlineUrgencyBonus:4,  locationMatchBonus:0  },
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
  // All types in the interest's preferred list score full points — no positional penalty.
  // Users may not choose their best-fit interest on first onboarding.
  const interest = profile.primaryInterest || 'general';
  const preferredTypes = INTEREST_TYPE_MAP[interest] ?? INTEREST_TYPE_MAP.general;
  if (preferredTypes.includes(opportunity.type)) {
    score += p.interest;
  }
  // Not in list → no points

  // 2. Cluster tag → Schwartz cluster scores on the opportunity (preferred)
  //    Fallback to OpportunityType map for legacy opps not yet classified.
  const cluster = profile.clusterTag || 'Explorer';
  const oppClusterScores = (opportunity as any).clusterScores as Record<string, number> | null | undefined;
  if (oppClusterScores && typeof oppClusterScores === 'object' && oppClusterScores[cluster] !== undefined) {
    const rawW = Math.max(0, Math.min(1, oppClusterScores[cluster] ?? 0));
    // Floor of 0.3 so non-primary clusters receive meaningful partial credit (~9 pts min)
    // instead of near-zero when the AI assigns a low but non-zero score.
    const w = 0.3 + rawW * 0.7;
    score += Math.round(p.cluster * w);
  } else {
    // Legacy path: all types in the cluster's preferred list score full points.
    const clusterTypes = CLUSTER_TYPE_MAP[cluster] ?? CLUSTER_TYPE_MAP.Explorer;
    if (clusterTypes.includes(opportunity.type)) {
      score += p.cluster;
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

  // 13. Field mismatch penalty: if eligibleFields is set and user's field not in it,
  // apply a soft penalty rather than a hard exclusion. Hard exclusion at SQL level
  // causes too many opportunities to disappear when AI-inferred fields don't perfectly
  // match the user's normalised field enum (e.g. ENGINEERING vs COMPUTER_SCIENCE).
  const eligFields: FieldOfStudy[] = (opportunity as any).eligibleFields ?? [];
  let fieldMismatchApplied = false;
  if (eligFields.length > 0 && !eligFields.includes('ANY' as FieldOfStudy)) {
    const userField = user.courseOfStudy ? normalizeFieldToEnum(user.courseOfStudy) : ('ANY' as FieldOfStudy);
    if (userField !== 'ANY' && !eligFields.includes(userField)) {
      score = Math.round(score * 0.15);
      fieldMismatchApplied = true;
    }
    // User field unknown but opportunity is restricted: mild penalty since we can't verify eligibility.
    if (userField === 'ANY') {
      score = Math.round(score * 0.5);
      fieldMismatchApplied = true;
    }
  }

  // 14. Tag-incoherence penalty: opportunity has domain-specific tags with zero overlap with user.
  // Skipped if field mismatch already fired — both measure the same thematic misalignment and
  // stacking them (×0.15 × ×0.40 = ×0.06) would bury conceptually relevant opportunities.
  const oppTags = opportunity.tags || [];
  if (!fieldMismatchApplied && tagScore === 0 && oppTags.length >= 2) {
    const interest = profile.primaryInterest || 'general';
    const hasDefinedInterest = PASSION_TAG_MAP[interest] || INTEREST_TAG_MAP[interest];
    if (hasDefinedInterest) {
      score = Math.round(score * 0.4);
    }
  }

  // 16. Field-tag implicit mismatch: detect domain incompatibility via tags even when the
  // user IS in eligibleFields (e.g. ENGINEERING includes aerospace, but the opportunity
  // has frontend/react/css tags — clearly a CS domain, not aerospace).
  // Skipped only if step 13 already fired a hard penalty (more severe, no need to stack).
  if (!fieldMismatchApplied) {
    const userFieldImplicit = user.courseOfStudy
      ? normalizeFieldToEnum(user.courseOfStudy)
      : ('ANY' as FieldOfStudy);
    if (userFieldImplicit !== 'ANY') {
      const incompatibleTags = FIELD_INCOMPATIBLE_TAGS[userFieldImplicit] ?? [];
      if (incompatibleTags.length > 0) {
        const oppTagsLower = (opportunity.tags || []).map((t) => t.toLowerCase());
        const incompatibleMatches = oppTagsLower.filter((t) =>
          incompatibleTags.some((it) => t.includes(it)),
        ).length;
        if (incompatibleMatches >= 2) {
          score = Math.round(score * 0.70);
        }
      }
    }
  }

  // 15. Implicit abroad language barrier.
  // Applied only when requiredEnglishLevel is null — step 4 already handles explicit requirements.
  // Remote/online opps are exempt: language barrier is lower in async remote contexts.
  const oppAny = opportunity as any;
  const isInPersonAbroad =
    !opportunity.isRemote &&
    oppAny.format !== 'ONLINE' &&
    ((oppAny.country !== null && oppAny.country !== undefined && oppAny.country !== 'IT') || opportunity.isAbroad);

  if (isInPersonAbroad && !opportunity.requiredEnglishLevel) {
    if (user.englishLevel === 'A2') {
      score = Math.round(score * 0.60);
    } else if (user.englishLevel === 'B1_B2') {
      score = Math.round(score * 0.85);
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
 *
 * When oppTypeMap is provided, only interactions on opportunities of the same type
 * as the candidate are counted — this makes the boost type-aware instead of
 * rewarding general app engagement regardless of what was interacted with.
 */
function computeFeedbackBoost(
  interactions: UserInteraction[],
  opportunity: Opportunity,
  oppTypeMap?: Map<string, string>,
): number {
  let boost = 0;

  // Filter to opportunity interactions of the same type as the current candidate.
  // If the map is not available, fall back to all opportunity interactions.
  const typeInteractions = interactions.filter((i) => {
    if (i.targetType !== 'opportunity') return false;
    if (oppTypeMap && oppTypeMap.size > 0) {
      return oppTypeMap.get(i.targetId) === opportunity.type;
    }
    return true;
  });

  if (typeInteractions.length === 0) return 0;

  let positiveSignal = 0;
  let negativeSignal = 0;
  let hasRecentTypeInteraction = false;

  for (const interaction of typeInteractions) {
    const decay = timeDecay(interaction.createdAt);

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

  // Diversity bonus: user hasn't viewed this opportunity type recently → +5
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
  oppTypeMap?: Map<string, string>,
): number {
  const baseScore = scoreOpportunity(profile, user, opportunity, skills);
  const feedbackBoost = computeFeedbackBoost(interactions, opportunity, oppTypeMap);
  return Math.max(0, Math.min(100, baseScore + feedbackBoost));
}

/**
 * Applies a soft "freshness" penalty to the display matchScore so that already-seen
 * opportunities slide slightly lower without being banished to the end of the feed.
 *
 *   viewed (not clicked) → -5
 *   external link clicked → -10
 *
 * High-scoring already-seen opps remain visible near their natural position; the
 * underlying score is clamped to [0, 100].
 */
export function applyFreshnessPenalty<T extends { id: string; matchScore: number }>(
  opps: T[],
  viewedIds: Set<string>,
  clickedIds: Set<string>,
): T[] {
  return opps.map((opp) => {
    let penalty = 0;
    if (clickedIds.has(opp.id)) penalty = 10;
    else if (viewedIds.has(opp.id)) penalty = 5;
    if (penalty === 0) return opp;
    return { ...opp, matchScore: Math.max(0, Math.min(100, opp.matchScore - penalty)) };
  });
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
  const full = await getHybridMatchedOpportunitiesFull(userId, filters);
  return { data: full.slice(offset, offset + limit), total: full.length };
}

/**
 * Returns opportunities semantically similar to a given opportunity, re-ranked by user match score.
 *
 * Pipeline:
 *  1. Fetch the reference opportunity's embedding.
 *  2. Find the 30 most similar opportunities via pgvector cosine distance (opp-to-opp).
 *  3. Re-rank with scoreOpportunity + feedback boost.
 *  4. Apply freshness penalty + MMR diversification.
 *  5. Return top `limit` results.
 *
 * Falls back to getHybridMatchedOpportunitiesFull if the reference has no embedding.
 */
export async function getRelatedOpportunities(
  userId: string,
  opportunityId: string,
  limit: number = 5,
): Promise<any[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  // Step 1: fetch the reference embedding
  const refRows = await prisma.$queryRawUnsafe<{ embedding: string | null }[]>(
    `SELECT embedding::text FROM "Opportunity" WHERE id = $1`,
    opportunityId,
  );
  const refEmbedding = refRows[0]?.embedding ?? null;

  // Fallback: no embedding on reference opportunity → return generic top-matches
  if (!refEmbedding) {
    const fallback = await getHybridMatchedOpportunitiesFull(userId, {});
    return fallback.filter((o: any) => String(o.id) !== String(opportunityId)).slice(0, limit);
  }

  // Build hard filters using parameterized values to avoid SQL injection.
  // $1 = embedding, $2 = opportunityId; extra params start at $3.
  const extraParams: string[] = [];
  let relocFilter = '';
  if (user?.cityLock && user.city) {
    extraParams.push(user.city);
    relocFilter = `AND (o."isRemote" = true OR lower(o."city") = lower($${2 + extraParams.length}))`;
  } else if (user?.regionLock && user.region) {
    extraParams.push(user.region);
    relocFilter = `AND (o."isRemote" = true OR lower(o."region") = lower($${2 + extraParams.length}))`;
  } else if (user?.willingToRelocate === 'NO') {
    relocFilter = `AND (o."isRemote" = true OR o."country" = 'IT' OR (o."country" IS NULL AND o."isAbroad" = false))`;
  }

  const seniorLeakFilter = `
    AND NOT (
      lower(o."title") ~ '(^|[^a-z])(senior|sr\\.?|director|head of|vp|vice president|lead|principal|staff|chief|cto|ceo|cmo|coo|cpo|manager|responsabile)([^a-z]|$)'
      AND NOT lower(o."title") ~ '(^|[^a-z])(intern|interns|internship|internships|stage|tirocinio|stagista|trainee|junior|graduate program|werkstudent|apprenti|alternance|stagiaire|praktikant|borsista)([^a-z]|$)'
    )
    AND NOT lower(o."title") ~ '\\d+\\+? *(years?|anni?) +(of +)?(experience|esperienza)'`;

  // Step 2: find top 30 candidates by content similarity (opp-to-opp, not user-to-opp)
  const candidates = await prisma.$queryRawUnsafe<any[]>(
    `SELECT o."id", o."title", o."description", o."titleIt", o."descriptionIt", o."about", o."url", o."type",
            o."universityId", o."company", o."organizer", o."location", o."isRemote", o."isAbroad",
            o."requiredEnglishLevel", o."minGpa", o."tags", o."deadline",
            o."postedAt", o."expiresAt", o."source", o."sourceId", o."lastSyncedAt",
            o."eligibleFields", o."country", o."city", o."region", o."format",
            o."clusterScores", o."clusterPrimary", o."minYearOfStudy", o."maxYearOfStudy",
            o."cost", o."hasScholarship",
            u."name" as "universityName", u."city" as "universityCity",
            u."id" as "uniId", u."logoUrl" as "universityLogoUrl",
            1 - (o.embedding <=> $1::vector) AS "contentSimilarity"
     FROM "Opportunity" o
     LEFT JOIN "University" u ON o."universityId" = u."id"
     WHERE o.id != $2
       AND o.embedding IS NOT NULL
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
       ${seniorLeakFilter}
     ORDER BY o.embedding <=> $1::vector
     LIMIT 30`,
    refEmbedding,
    opportunityId,
    ...extraParams,
  );

  if (candidates.length === 0) {
    const fallback = await getHybridMatchedOpportunitiesFull(userId, {});
    return fallback.filter((o: any) => String(o.id) !== String(opportunityId)).slice(0, limit);
  }

  // Step 3: get user interactions for feedback scoring
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const interactions = user
    ? await prisma.userInteraction.findMany({
        where: { userId, targetType: 'opportunity', createdAt: { gte: ninetyDaysAgo } },
      })
    : [];

  // Build oppId → oppType map for type-aware feedback boost
  const relatedOppTypeMap = new Map<string, string>();
  if (interactions.length > 0) {
    const relatedInteractedIds = [...new Set(interactions.map((i) => i.targetId))];
    const relatedOppTypes = await prisma.opportunity.findMany({
      where: { id: { in: relatedInteractedIds } },
      select: { id: true, type: true },
    });
    relatedOppTypes.forEach((o) => relatedOppTypeMap.set(o.id, o.type));
  }

  const userSkills = user ? parseUserSkills(user.skills) : null;

  // Step 4: re-rank with match score + content similarity
  const scored = candidates.map((opp) => {
    const contentSim = (opp.contentSimilarity as number) ?? 0;
    const university = opp.uniId
      ? { id: opp.uniId, name: opp.universityName, city: opp.universityCity, logoUrl: opp.universityLogoUrl }
      : null;

    let matchScore: number;
    if (user?.profile) {
      const baseScore = scoreOpportunity(user.profile, user, opp, userSkills);
      const feedbackBoost = computeFeedbackBoost(interactions, opp, relatedOppTypeMap);
      // 60% user match, 40% content similarity — content similarity is primary driver here.
      // feedbackBoost is normalized from [-10,+15] to [0,100] range before weighting (×0.1).
      const normalizedFeedback = (feedbackBoost + 10) * (100 / 25);
      matchScore = baseScore * 0.6 + contentSim * 100 * 0.4 + normalizedFeedback * 0.1;
    } else {
      // No profile: rank purely by content similarity
      matchScore = contentSim * 100;
    }

    return {
      id: opp.id,
      title: opp.title,
      description: opp.description,
      titleIt: opp.titleIt,
      descriptionIt: opp.descriptionIt,
      about: opp.about,
      url: opp.url,
      type: opp.type,
      universityId: opp.universityId,
      university,
      company: opp.company,
      organizer: opp.organizer,
      location: opp.location,
      city: opp.city,
      country: opp.country,
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
      matchScore: Math.max(0, Math.min(100, Math.round(matchScore))),
    };
  });

  // Step 5: freshness penalty
  const viewedIds = new Set(interactions.filter((i) => i.action === 'view').map((i) => i.targetId));
  const clickedIds = new Set(interactions.filter((i) => i.action === 'click').map((i) => i.targetId));
  const adjusted = applyFreshnessPenalty(scored, viewedIds, clickedIds);

  adjusted.sort((a, b) => b.matchScore - a.matchScore || a.id.localeCompare(b.id));

  // MMR on the full list (small window since we only return a few items)
  const ranked = diversifyMMR(adjusted, adjusted.length, 0.9, 3);

  return ranked.slice(0, limit);
}

/**
 * Returns the full ranked & diversified list of matched opportunities (no pagination).
 * The route layer caches this snapshot and paginates by slicing — guarantees that
 * page N never contains items already shown on a previous page within the same snapshot.
 */
export async function getHybridMatchedOpportunitiesFull(
  userId: string,
  filters: OppFilters = {},
): Promise<any[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user?.profile) {
    // Fallback: return opportunities by date if no profile
    // Use raw query to avoid Prisma failing on the Unsupported vector column
    const opps = await prisma.$queryRawUnsafe<any[]>(
      `SELECT o."id", o."title", o."description", o."about", o."url", o."type",
              o."universityId", o."company", o."location", o."isRemote", o."isAbroad",
              o."requiredEnglishLevel", o."minGpa", o."tags", o."deadline",
              o."postedAt", o."expiresAt", o."source", o."sourceId", o."lastSyncedAt",
              u."name" as "universityName", u."city" as "universityCity",
              u."id" as "uniId", u."logoUrl" as "universityLogoUrl"
       FROM "Opportunity" o
       LEFT JOIN "University" u ON o."universityId" = u."id"
       WHERE (o."urlStatus" IS NULL OR o."urlStatus" != 'BROKEN' OR o."source" = 'curated')
       ORDER BY o."postedAt" DESC, o."id" ASC`,
    );
    return opps;
  }

  // Check if user has an embedding for vector search
  const hasEmbedding = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM "User" WHERE id = $1 AND embedding IS NOT NULL`,
    userId,
  );
  const userHasEmbedding = hasEmbedding[0]?.count > 0n;

  let candidates: any[];

  // Hard filter: structured location preference (city > region > country).
  // Uses parameterized values to avoid SQL injection — string interpolation was unsafe here.
  // embedExtraParams: used when userId is already $1 (embedding path).
  // noEmbedExtraParams: used when there is no userId param (fallback path).
  const embedExtraParams: string[] = [];
  const noEmbedExtraParams: string[] = [];
  let relocFilterEmbed = '';
  let relocFilterNoEmbed = '';
  if (user.cityLock && user.city) {
    embedExtraParams.push(user.city);
    relocFilterEmbed = `AND (o."isRemote" = true OR lower(o."city") = lower($2))`;
    noEmbedExtraParams.push(user.city);
    relocFilterNoEmbed = `AND (o."isRemote" = true OR lower(o."city") = lower($1))`;
  } else if (user.regionLock && user.region) {
    embedExtraParams.push(user.region);
    relocFilterEmbed = `AND (o."isRemote" = true OR lower(o."region") = lower($2))`;
    noEmbedExtraParams.push(user.region);
    relocFilterNoEmbed = `AND (o."isRemote" = true OR lower(o."region") = lower($1))`;
  } else if (user.willingToRelocate === 'NO') {
    const noRelocClause = `AND (o."isRemote" = true OR o."country" = 'IT' OR (o."country" IS NULL AND o."isAbroad" = false))`;
    relocFilterEmbed = noRelocClause;
    relocFilterNoEmbed = noRelocClause;
  }

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
      `SELECT o."id", o."title", o."description", o."titleIt", o."descriptionIt", o."about", o."url", o."type",
              o."universityId", o."company", o."organizer", o."location", o."isRemote", o."isAbroad",
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
           o."type" IN ('EVENT')
           OR o."deadline" IS NULL
           OR o."deadline" > NOW()
         )
         AND (
           o."type" NOT IN ('EVENT')
           OR o."endDate" IS NULL
           OR o."endDate" >= CURRENT_DATE
         )
         AND (o."urlStatus" IS NULL OR o."urlStatus" != 'BROKEN' OR o."source" = 'curated')
         ${relocFilterEmbed}
         ${seniorLeakFilter}
       ORDER BY o."postedAt" DESC`,
      userId,
      ...embedExtraParams,
    );
  } else {
    // Fallback: get all opportunities (Phase 1 behavior)
    // Use raw query to avoid Prisma failing on the Unsupported vector column
    candidates = await prisma.$queryRawUnsafe<any[]>(
      `SELECT o."id", o."title", o."description", o."titleIt", o."descriptionIt", o."about", o."url", o."type",
              o."universityId", o."company", o."organizer", o."location", o."isRemote", o."isAbroad",
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
           o."type" IN ('EVENT')
           OR o."deadline" IS NULL
           OR o."deadline" > NOW()
         )
         AND (
           o."type" NOT IN ('EVENT')
           OR o."endDate" IS NULL
           OR o."endDate" >= CURRENT_DATE
         )
         AND (o."urlStatus" IS NULL OR o."urlStatus" != 'BROKEN' OR o."source" = 'curated')
         ${relocFilterNoEmbed}
         ${seniorLeakFilter}
       ORDER BY o."postedAt" DESC`,
      ...noEmbedExtraParams,
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

  // Build oppId → oppType map so computeFeedbackBoost can filter by type.
  const interactedOppIds = [...new Set(interactions.map((i) => i.targetId))];
  const oppTypeMap = new Map<string, string>();
  if (interactedOppIds.length > 0) {
    const oppTypes = await prisma.opportunity.findMany({
      where: { id: { in: interactedOppIds } },
      select: { id: true, type: true },
    });
    oppTypes.forEach((o) => oppTypeMap.set(o.id, o.type));
  }

  // Parse user skills from JSON field
  const userSkills = parseUserSkills(user.skills);

  // Stage 2: Re-rank with hybrid scoring
  const scored = candidates.map((opp) => {
    const baseScore = scoreOpportunity(user.profile!, user, opp, userSkills);
    const feedbackBoost = computeFeedbackBoost(interactions, opp, oppTypeMap);
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
      titleIt: opp.titleIt,
      descriptionIt: opp.descriptionIt,
      about: opp.about,
      url: opp.url,
      type: opp.type,
      universityId: opp.universityId,
      university,
      company: opp.company,
      organizer: opp.organizer,
      location: opp.location,
      city: opp.city,
      country: opp.country,
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
      // matchScore is always profile-pure so the displayed % is consistent across all surfaces.
      // hybridScore (with vector + feedback) is kept separately for ranking only.
      matchScore: Math.max(0, Math.min(100, Math.round(baseScore))),
      _hybridScore: hybridScore,
      matchReason: getMatchReason(user.profile!, user, opp, userSkills),
    };
  });

  // Freshness penalty degrades _hybridScore (ranking) only — matchScore stays profile-pure
  // so the displayed % never changes when an opp has been viewed or clicked.
  const viewedIds = new Set(interactions.filter((i) => i.action === 'view').map((i) => i.targetId));
  const clickedIds = new Set(interactions.filter((i) => i.action === 'click').map((i) => i.targetId));
  const penalised = (scored as any[]).map((opp) => {
    let penalty = 0;
    if (clickedIds.has(opp.id)) penalty = 10;
    else if (viewedIds.has(opp.id)) penalty = 5;
    return penalty === 0 ? opp : { ...opp, _hybridScore: opp._hybridScore - penalty };
  });

  // Sort by _hybridScore (ranking quality) — tie-break on id for deterministic pagination.
  penalised.sort((a: any, b: any) => b._hybridScore - a._hybridScore || a.id.localeCompare(b.id));

  // Strip internal field before MMR and return.
  const adjusted = penalised.map(({ _hybridScore, ...rest }: any) => rest);

  // MMR diversification across the WHOLE list (lambda 0.7 keeps score dominant)
  // so type/cluster heterogeneity is preserved on every page, not just the first 40.
  const ranked = diversifyMMR(adjusted, Math.min(adjusted.length, 300), 0.9, 5);

  const filtered = Object.keys(filters).length ? applyOppFilters(ranked, filters) : ranked;
  return filtered;
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
  const full = await getNewOpportunitiesFull(userId, filters);
  return { data: full.slice(offset, offset + limit), total: full.length };
}

/**
 * Full ranked list for the "Nuove" tab (no pagination).
 * Used by the route layer to cache a snapshot and paginate via slicing.
 */
export async function getNewOpportunitiesFull(
  userId: string,
  filters: OppFilters = {},
): Promise<any[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  // Senior/experienced role filter — same regex as the matched feed, applied at SQL level
  // so the entire table is never loaded into memory just to be filtered in JS.
  const seniorLeakFilterNew = `
    AND NOT (
      lower(o."title") ~ '(^|[^a-z])(senior|sr\\.?|director|head of|vp|vice president|lead|principal|staff|chief|cto|ceo|cmo|coo|cpo|manager|responsabile)([^a-z]|$)'
      AND NOT lower(o."title") ~ '(^|[^a-z])(intern|interns|internship|internships|stage|tirocinio|stagista|trainee|junior|graduate program|werkstudent|apprenti|alternance|stagiaire|praktikant|borsista)([^a-z]|$)'
    )
    AND NOT lower(o."title") ~ '\\d+\\+? *(years?|anni?) +(of +)?(experience|esperienza)'`;

  // Build parameterized WHERE conditions — mirrors the matched feed SQL approach.
  const conditions: string[] = [
    `(o."expiresAt" IS NULL OR o."expiresAt" > NOW())`,
    `(o."type" IN ('EVENT') OR o."deadline" IS NULL OR o."deadline" > NOW())`,
    `(o."type" NOT IN ('EVENT') OR o."endDate" IS NULL OR o."endDate" >= CURRENT_DATE)`,
    `(o."urlStatus" IS NULL OR o."urlStatus" != 'BROKEN' OR o."source" = 'curated')`,
  ];
  const sqlParams: any[] = [];
  let pidx = 1;

  if (filters.search) {
    conditions.push(`(o."title" ILIKE $${pidx} OR o."company" ILIKE $${pidx})`);
    sqlParams.push(`%${filters.search}%`); pidx++;
  }
  if (filters.company) {
    conditions.push(`o."company" ILIKE $${pidx}`);
    sqlParams.push(`%${filters.company}%`); pidx++;
  }
  if (filters.location) {
    conditions.push(`o."location" ILIKE $${pidx}`);
    sqlParams.push(`%${filters.location}%`); pidx++;
  }
  if (filters.isRemote !== undefined) {
    conditions.push(`o."isRemote" = $${pidx}`); sqlParams.push(filters.isRemote); pidx++;
  }
  if (filters.isAbroad !== undefined) {
    conditions.push(`o."isAbroad" = $${pidx}`); sqlParams.push(filters.isAbroad); pidx++;
  }
  if (filters.englishLevels?.length) {
    const placeholders = filters.englishLevels.map(() => `$${pidx++}`).join(', ');
    conditions.push(`o."requiredEnglishLevel" IN (${placeholders})`);
    sqlParams.push(...filters.englishLevels);
  }
  if (user?.willingToRelocate === 'NO') {
    conditions.push(`(o."isRemote" = true OR o."isAbroad" = false)`);
  }
  if (filters.types?.length) {
    const placeholders = filters.types.map(() => `$${pidx++}`).join(', ');
    conditions.push(`o."type" IN (${placeholders})`);
    sqlParams.push(...filters.types);
  }
  if (filters.formats?.length) {
    const placeholders = filters.formats.map(() => `$${pidx++}`).join(', ');
    conditions.push(`o."format" IN (${placeholders})`);
    sqlParams.push(...filters.formats);
  }
  if (filters.deadline === '7' || filters.deadline === '30') {
    const dlNow = new Date(); dlNow.setHours(0, 0, 0, 0);
    const dlEnd = new Date(dlNow); dlEnd.setDate(dlEnd.getDate() + parseInt(filters.deadline));
    conditions.push(`(o."deadline" >= $${pidx} AND o."deadline" <= $${pidx + 1})`);
    sqlParams.push(dlNow, dlEnd); pidx += 2;
  } else if (filters.deadline === 'month') {
    const dlNow = new Date();
    const dlStart = new Date(dlNow.getFullYear(), dlNow.getMonth(), 1);
    const dlEnd = new Date(dlNow.getFullYear(), dlNow.getMonth() + 1, 0, 23, 59, 59);
    conditions.push(`(o."deadline" >= $${pidx} AND o."deadline" <= $${pidx + 1})`);
    sqlParams.push(dlStart, dlEnd); pidx += 2;
  }

  const newWhereClause = `WHERE ${conditions.join(' AND ')} ${seniorLeakFilterNew}`;

  // Fetch opportunities — senior filter applied at SQL level (no full-table in-memory load)
  const allOpps = await prisma.$queryRawUnsafe<any[]>(
    `SELECT o."id", o."title", o."description", o."titleIt", o."descriptionIt", o."about", o."url", o."type",
            o."universityId", o."company", o."organizer", o."location", o."isRemote", o."isAbroad",
            o."requiredEnglishLevel", o."minGpa", o."tags", o."deadline",
            o."postedAt", o."expiresAt", o."source", o."sourceId",
            o."eligibleFields", o."country", o."city", o."region", o."format",
            o."clusterScores", o."clusterPrimary", o."minYearOfStudy", o."maxYearOfStudy",
            o."cost", o."hasScholarship",
            u."name" as "universityName", u."city" as "universityCity",
            u."id" as "uniId", u."logoUrl" as "universityLogoUrl"
     FROM "Opportunity" o
     LEFT JOIN "University" u ON o."universityId" = u."id"
     ${newWhereClause}
     ORDER BY o."postedAt" DESC`,
    ...sqlParams,
  );

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
      titleIt: opp.titleIt,
      descriptionIt: opp.descriptionIt,
      about: opp.about,
      url: opp.url,
      type: opp.type,
      universityId: opp.universityId,
      university: opp.uniId ? { id: opp.uniId, name: opp.universityName, city: opp.universityCity, logoUrl: opp.universityLogoUrl } : null,
      company: opp.company,
      organizer: opp.organizer,
      location: opp.location,
      city: opp.city,
      country: opp.country,
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

  scored.sort((a, b) => b._rankingScore - a._rankingScore || a.id.localeCompare(b.id));

  // Strip internal ranking field before returning
  return scored.map(({ _rankingScore, ...opp }) => opp);
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
