/**
 * Manual / curated opportunity upsert.
 *
 * Used by POST /api/import/manual (admin only) and by the seed script.
 * All manually inserted opportunities are marked verified=true and
 * source='curated'. They are never auto-expired by markStaleOpportunities.
 */
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../lib/prisma';
import { FieldOfStudy, OpportunityFormat, OpportunityType } from '@prisma/client';

const opportunityTypeValues = Object.values(OpportunityType) as [OpportunityType, ...OpportunityType[]];
const opportunityFormatValues = Object.values(OpportunityFormat) as [OpportunityFormat, ...OpportunityFormat[]];
const fieldOfStudyValues = Object.values(FieldOfStudy) as [FieldOfStudy, ...FieldOfStudy[]];

const manualOpportunitySchema = z.object({
  title: z.string().min(3).max(300),
  description: z.string().min(10).max(10000),
  type: z.enum(opportunityTypeValues),
  url: z.string().url().max(2000).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  organizer: z.string().max(200).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  country: z.string().max(2).nullable().optional(),
  isAbroad: z.boolean().default(false),
  isRemote: z.boolean().default(false),
  format: z.enum(opportunityFormatValues).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  durationDays: z.number().int().positive().nullable().optional(),
  deadline: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  cost: z.number().int().min(0).nullable().optional(),
  hasScholarship: z.boolean().default(false),
  scholarshipDetails: z.string().max(500).nullable().optional(),
  stipend: z.number().int().min(0).nullable().optional(),
  eligibleFields: z.array(z.enum(fieldOfStudyValues)).default([]),
  minYearOfStudy: z.number().int().min(1).max(6).nullable().optional(),
  maxYearOfStudy: z.number().int().min(1).max(8).nullable().optional(),
  tags: z.array(z.string()).default([]),
  sourceId: z.string().max(200).optional(),
});

export type ManualOpportunityInput = z.infer<typeof manualOpportunitySchema>;

export async function upsertManualOpportunity(raw: Record<string, any>): Promise<{ id: string; action: 'created' | 'updated' }> {
  const data = manualOpportunitySchema.parse(raw);

  const sourceId = data.sourceId ?? `curated-${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`;
  const source = 'curated';
  const now = new Date();

  // Check if this curated item already exists by sourceId
  const existing = await prisma.opportunity.findFirst({
    where: { source, sourceId },
    select: { id: true },
  });

  if (existing) {
    await prisma.opportunity.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        url: data.url ?? null,
        company: data.company ?? null,
        organizer: data.organizer ?? null,
        location: data.location ?? null,
        city: data.city ?? null,
        country: data.country ?? null,
        isAbroad: data.isAbroad,
        isRemote: data.isRemote,
        format: data.format ?? null,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        durationDays: data.durationDays ?? null,
        deadline: data.deadline ?? null,
        expiresAt: data.expiresAt ?? null,
        cost: data.cost ?? null,
        hasScholarship: data.hasScholarship,
        scholarshipDetails: data.scholarshipDetails ?? null,
        stipend: data.stipend ?? null,
        eligibleFields: data.eligibleFields,
        minYearOfStudy: data.minYearOfStudy ?? null,
        maxYearOfStudy: data.maxYearOfStudy ?? null,
        tags: data.tags,
        verified: true,
        lastSyncedAt: now,
      },
    });
    return { id: existing.id, action: 'updated' };
  }

  const created = await prisma.opportunity.create({
    data: {
      id: uuidv4(),
      title: data.title,
      description: data.description,
      type: data.type,
      url: data.url ?? null,
      company: data.company ?? null,
      organizer: data.organizer ?? null,
      location: data.location ?? null,
      city: data.city ?? null,
      country: data.country ?? null,
      isAbroad: data.isAbroad,
      isRemote: data.isRemote,
      format: data.format ?? null,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      durationDays: data.durationDays ?? null,
      deadline: data.deadline ?? null,
      expiresAt: data.expiresAt ?? null,
      cost: data.cost ?? null,
      hasScholarship: data.hasScholarship,
      scholarshipDetails: data.scholarshipDetails ?? null,
      stipend: data.stipend ?? null,
      eligibleFields: data.eligibleFields,
      minYearOfStudy: data.minYearOfStudy ?? null,
      maxYearOfStudy: data.maxYearOfStudy ?? null,
      tags: data.tags,
      source,
      sourceId,
      postedAt: now,
      lastSyncedAt: now,
      verified: true,
    },
    select: { id: true },
  });

  return { id: created.id, action: 'created' };
}
