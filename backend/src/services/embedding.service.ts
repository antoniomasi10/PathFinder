import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

// Lazy-loaded pipeline instance
let embedder: any = null;
let loadingPromise: Promise<any> | null = null;

async function getEmbedder() {
  if (embedder) return embedder;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const { pipeline } = await import('@xenova/transformers');
      embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      logger.info('Embedding model loaded successfully');
      return embedder;
    } catch (err: any) {
      loadingPromise = null;
      logger.error('Failed to load embedding model:', err);
      throw err;
    }
  })();

  return loadingPromise;
}

/**
 * Generate a 384-dimensional embedding vector from text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const result = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data as Float32Array);
}

// ─── Text Conversion Functions ──────────────────────────────────────

export function userToText(
  user: { courseOfStudy?: string | null; yearOfStudy?: number | null; gpa?: string | null; englishLevel?: string | null; willingToRelocate?: string | null },
  profile: { primaryInterest?: string | null; clusterTag?: string | null; passions?: string[]; careerVision?: string | null; professionalGoal?: string | null },
  universityName?: string | null,
  skills?: { core?: { name: string }[] | null; side?: { name: string }[] } | null,
): string {
  const parts: string[] = [];

  if (universityName) parts.push(`Studente presso ${universityName}`);
  if (user.courseOfStudy) parts.push(`Corso: ${user.courseOfStudy}`);
  if (user.yearOfStudy) parts.push(`Anno ${user.yearOfStudy}`);
  if (profile.primaryInterest) parts.push(`Interesse principale: ${profile.primaryInterest}`);
  if (profile.clusterTag) parts.push(`Profilo: ${profile.clusterTag}`);
  if (profile.careerVision) parts.push(`Visione: ${profile.careerVision}`);
  if (profile.professionalGoal) parts.push(`Obiettivo: ${profile.professionalGoal}`);
  if (profile.passions?.length) parts.push(`Passioni: ${profile.passions.join(', ')}`);
  if (user.gpa) parts.push(`GPA: ${user.gpa.replace('_', ' ')}`);
  if (user.englishLevel) parts.push(`Inglese: ${user.englishLevel.replace('_', ' ')}`);
  if (user.willingToRelocate) parts.push(`Trasferimento: ${user.willingToRelocate}`);

  // Append skills to embedding text
  if (skills?.core && skills.core.length > 0) {
    parts.push(`Competenze principali: ${skills.core.map((s) => s.name).join(', ')}`);
  }
  if (skills?.side && skills.side.length > 0) {
    parts.push(`Competenze secondarie: ${skills.side.map((s) => s.name).join(', ')}`);
  }

  return parts.join('. ') || 'Studente universitario';
}

export function opportunityToText(opp: {
  title: string;
  description: string;
  type: string;
  company?: string | null;
  location?: string | null;
  isRemote?: boolean;
  tags?: string[];
  minGpa?: string | null;
  requiredEnglishLevel?: string | null;
}): string {
  const parts: string[] = [];

  parts.push(opp.title);
  if (opp.company) parts.push(`Azienda: ${opp.company}`);
  parts.push(`Tipo: ${opp.type}`);
  if (opp.description) parts.push(opp.description.substring(0, 300));
  if (opp.location) parts.push(`Luogo: ${opp.location}`);
  if (opp.isRemote) parts.push('Remoto');
  if (opp.tags?.length) parts.push(`Tag: ${opp.tags.join(', ')}`);
  if (opp.minGpa) parts.push(`GPA minimo: ${opp.minGpa.replace('_', ' ')}`);
  if (opp.requiredEnglishLevel) parts.push(`Inglese richiesto: ${opp.requiredEnglishLevel.replace('_', ' ')}`);

  return parts.join('. ');
}

export function courseToText(course: {
  name: string;
  type: string;
  field?: string | null;
  tags?: string[];
  languageOfInstruction?: string | null;
}, universityName?: string, city?: string): string {
  const parts: string[] = [];

  parts.push(course.name);
  parts.push(`Tipo: ${course.type}`);
  if (course.field) parts.push(`Campo: ${course.field}`);
  if (universityName) parts.push(`Università: ${universityName}`);
  if (city) parts.push(`Città: ${city}`);
  if (course.tags?.length) parts.push(`Tag: ${course.tags.join(', ')}`);
  if (course.languageOfInstruction) parts.push(`Lingua: ${course.languageOfInstruction}`);

  return parts.join('. ');
}

// ─── Embedding Update Functions ─────────────────────────────────────

export async function updateUserEmbedding(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, university: { select: { name: true } } },
    });

    if (!user?.profile) return;

    // Parse skills JSON for embedding text enrichment
    const rawSkills = user.skills as Record<string, unknown> | null;
    const skills = rawSkills ? {
      core: Array.isArray(rawSkills.core) ? rawSkills.core as { name: string }[] : null,
      side: Array.isArray(rawSkills.side) ? rawSkills.side as { name: string }[] : [],
    } : null;

    const text = userToText(user, user.profile, user.university?.name, skills);
    const embedding = await generateEmbedding(text);
    const vectorStr = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET embedding = $1::vector WHERE id = $2`,
      vectorStr,
      userId,
    );
  } catch (err: any) {
    logger.error(`Failed to update embedding for user ${userId}:`, err);
  }
}

export async function updateOpportunityEmbedding(opportunityId: string): Promise<void> {
  try {
    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opp) return;

    const text = opportunityToText(opp);
    const embedding = await generateEmbedding(text);
    const vectorStr = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `UPDATE "Opportunity" SET embedding = $1::vector WHERE id = $2`,
      vectorStr,
      opportunityId,
    );
  } catch (err: any) {
    logger.error(`Failed to update embedding for opportunity ${opportunityId}:`, err);
  }
}

export async function updateCourseEmbedding(courseId: string): Promise<void> {
  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { university: { select: { name: true, city: true } } },
    });

    if (!course) return;

    const text = courseToText(course, course.university.name, course.university.city);
    const embedding = await generateEmbedding(text);
    const vectorStr = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `UPDATE "Course" SET embedding = $1::vector WHERE id = $2`,
      vectorStr,
      courseId,
    );
  } catch (err: any) {
    logger.error(`Failed to update embedding for course ${courseId}:`, err);
  }
}

// ─── Bulk Backfill ──────────────────────────────────────────────────

/**
 * Backfill embeddings for all records that don't have one yet.
 * Runs in background, logs progress.
 */
export async function bulkGenerateEmbeddings(): Promise<void> {
  logger.info('Starting embedding backfill...');

  // Backfill users
  const usersWithoutEmbedding = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "User" WHERE embedding IS NULL AND "profileCompleted" = true`,
  );
  logger.info(`Backfilling ${usersWithoutEmbedding.length} user embeddings...`);
  for (const { id } of usersWithoutEmbedding) {
    await updateUserEmbedding(id);
  }

  // Backfill opportunities
  const oppsWithoutEmbedding = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Opportunity" WHERE embedding IS NULL`,
  );
  logger.info(`Backfilling ${oppsWithoutEmbedding.length} opportunity embeddings...`);
  for (const { id } of oppsWithoutEmbedding) {
    await updateOpportunityEmbedding(id);
  }

  // Backfill courses
  const coursesWithoutEmbedding = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Course" WHERE embedding IS NULL`,
  );
  logger.info(`Backfilling ${coursesWithoutEmbedding.length} course embeddings...`);
  for (const { id } of coursesWithoutEmbedding) {
    await updateCourseEmbedding(id);
  }

  logger.info('Embedding backfill completed.');
}
