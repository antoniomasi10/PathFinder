/**
 * Import Data Validation
 *
 * Validates and sanitizes data before DB upsert.
 * Returns null if the record is invalid and should be skipped.
 */
import { z } from 'zod';
import { FieldOfStudy, OpportunityFormat } from '@prisma/client';
import { logger } from '../../utils/logger';

const opportunityFormatValues = Object.values(OpportunityFormat) as [OpportunityFormat, ...OpportunityFormat[]];
const fieldOfStudyValues = Object.values(FieldOfStudy) as [FieldOfStudy, ...FieldOfStudy[]];

// --- Opportunity validation ---

const opportunitySchema = z.object({
  title: z.string().min(3).max(300),
  description: z.string().min(10).max(10000),
  company: z.string().max(200).nullable().optional().default(''),
  url: z.string().url().max(2000).nullable().optional(),
  location: z.string().max(200).nullable().optional().default(''),
  isAbroad: z.boolean().default(false),
  isRemote: z.boolean().default(false),
  expiresAt: z.date().nullable().optional(),
  // event / experience fields
  organizer: z.string().max(200).nullable().optional(),
  startDate: z.date().nullable().optional(),
  endDate: z.date().nullable().optional(),
  durationDays: z.number().int().positive().nullable().optional(),
  format: z.enum(opportunityFormatValues).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  country: z.string().max(2).nullable().optional(),
  cost: z.number().int().min(0).nullable().optional(),
  hasScholarship: z.boolean().default(false),
  scholarshipDetails: z.string().max(500).nullable().optional(),
  stipend: z.number().int().min(0).nullable().optional(),
  eligibleFields: z.array(z.enum(fieldOfStudyValues)).default([]),
  minYearOfStudy: z.number().int().min(1).max(6).nullable().optional(),
  maxYearOfStudy: z.number().int().min(1).max(8).nullable().optional(),
  requiredLanguages: z.array(z.object({ lang: z.string(), level: z.string() })).default([]),
  verified: z.boolean().default(false),
});

export type ValidatedOpportunity = z.infer<typeof opportunitySchema>;

export function validateOpportunity(data: Record<string, any>, source: string): ValidatedOpportunity | null {
  try {
    // Pre-process
    if (data.url && typeof data.url === 'string') {
      if (!data.url.startsWith('http://') && !data.url.startsWith('https://')) {
        data.url = null;
      }
    }
    for (const dateField of ['expiresAt', 'startDate', 'endDate'] as const) {
      if (data[dateField] && !(data[dateField] instanceof Date)) {
        const d = new Date(data[dateField]);
        data[dateField] = isNaN(d.getTime()) ? null : d;
      }
    }
    if (data.country && typeof data.country === 'string') {
      data.country = data.country.toUpperCase().slice(0, 2);
    }

    const parsed = opportunitySchema.parse(data);

    // Dedup: skip if same title+company already seen in this run
    if (isDuplicateOpportunity(parsed.title, parsed.company || '')) {
      logger.debug(`[Validation] Skipped duplicate ${source}: ${parsed.title.slice(0, 50)}`);
      return null;
    }

    return parsed;
  } catch (err) {
    logger.debug(`[Validation] Skipped invalid ${source} opportunity: ${data.title?.slice(0, 50) || 'no-title'}`);
    return null;
  }
}

// --- University validation ---

const universitySchema = z.object({
  name: z.string().min(3).max(300),
  city: z.string().min(1).max(100),
  websiteUrl: z.string().url().max(500).nullable().optional(),
});

export type ValidatedUniversity = z.infer<typeof universitySchema>;

export function validateUniversity(data: Record<string, any>): ValidatedUniversity | null {
  try {
    if (data.websiteUrl && typeof data.websiteUrl === 'string') {
      if (!data.websiteUrl.startsWith('http')) data.websiteUrl = null;
    }
    return universitySchema.parse(data);
  } catch {
    logger.debug(`[Validation] Skipped invalid university: ${data.name?.slice(0, 50) || 'no-name'}`);
    return null;
  }
}

// --- Course validation ---

const courseSchema = z.object({
  name: z.string().min(2).max(300),
  field: z.string().max(200).nullable().optional(),
  languageOfInstruction: z.string().max(50).optional().default('Italiano'),
});

export type ValidatedCourse = z.infer<typeof courseSchema>;

export function validateCourse(data: Record<string, any>): ValidatedCourse | null {
  try {
    return courseSchema.parse(data);
  } catch {
    logger.debug(`[Validation] Skipped invalid course: ${data.name?.slice(0, 50) || 'no-name'}`);
    return null;
  }
}

// --- Runtime duplicate cache (shared across all importers within a single run) ---

const seenTitleCompany = new Set<string>();

function dedupKey(title: string, company: string): string {
  return `${title.toLowerCase().trim()}|||${company.toLowerCase().trim()}`;
}

/**
 * Check if an opportunity with the same title+company has already been
 * seen in this process. Returns true if duplicate (should be skipped).
 */
export function isDuplicateOpportunity(title: string, company: string): boolean {
  const key = dedupKey(title, company);
  if (seenTitleCompany.has(key)) return true;
  seenTitleCompany.add(key);
  return false;
}

/**
 * Reset the dedup cache (call at the start of each import run if needed).
 */
export function resetDedupCache(): void {
  seenTitleCompany.clear();
}

// --- Duplicate detection ---

/**
 * Normalize a title for fuzzy duplicate detection.
 * Strips common noise words, lowercases, removes extra spaces.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9àèéìíòóùú\s]/g, ' ')
    .replace(/\b(the|a|an|di|del|della|dei|delle|il|la|lo|le|un|una|per|con|in|da|su|and|or|for|at|to)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two opportunity titles are likely duplicates.
 * Uses normalized Jaccard similarity on word sets.
 */
export function areLikelyDuplicates(titleA: string, titleB: string): boolean {
  const wordsA = new Set(normalizeTitle(titleA).split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normalizeTitle(titleB).split(' ').filter(w => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  const jaccard = intersection / union;

  return jaccard >= 0.7; // 70% word overlap = likely duplicate
}
