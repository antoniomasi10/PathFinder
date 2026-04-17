/**
 * RemoteOK Job Aggregator Import
 * Source: https://remoteok.com/api
 *
 * Free API, no key required. Remote-first job listings.
 * Legal: allowed with attribution (follow-link back to remoteok.com).
 * Required: link to source URL for each opportunity.
 *
 * Runs weekly Tuesday at 04:00 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { stripHtml, mapOpportunityType, fetchWithRetry } from './utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_URL = 'https://remoteok.com/api';

const STUDENT_KEYWORDS = [
  'intern', 'internship', 'stage', 'stagiaire', 'tirocinio',
  'trainee', 'traineeship', 'graduate', 'apprenti', 'apprentice',
  'student', 'werkstudent', 'alternance', 'junior', 'entry level',
  'entry-level', 'co-op',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStudentRole(title: string, tags: string[]): boolean {
  const t = title.toLowerCase();
  if (t.includes('internal')) return false;
  if (STUDENT_KEYWORDS.some(kw => t.includes(kw))) return true;
  // Also check tags for internship-related labels
  return tags.some(tag => STUDENT_KEYWORDS.some(kw => tag.toLowerCase().includes(kw)));
}

const mapType = mapOpportunityType;

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface RemoteOKJob {
  slug: string;
  id: string;
  epoch: string;
  date: string;
  company: string;
  position: string;
  tags: string[];
  description: string;
  location: string;
  apply_url: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importRemoteOKOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[RemoteOK] Starting opportunity import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: 'remoteok', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let skipped = 0;
    const records: OpportunityRecord[] = [];
    const seenIds: string[] = [];

    logger.info('[RemoteOK] Fetching API...');
    const res = await fetchWithRetry(API_URL, {
      timeoutMs: 30000,
      headers: { 'Accept': 'application/json' },
      logTag: '[RemoteOK]',
    });

    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }

    const data = await res.json() as any[];

    // First element is the legal/ToS notice, skip it
    const jobs = data.filter((item: any) => item.position && item.id) as RemoteOKJob[];

    logger.info(`[RemoteOK] Got ${jobs.length} total listings, filtering for student roles...`);

    for (const job of jobs) {
      const tags = job.tags || [];

      // Filter: only student-relevant roles
      if (!isStudentRole(job.position, tags)) { skipped++; continue; }

      const description = stripHtml(job.description).slice(0, 10000)
        || `${job.position} at ${job.company}`;
      const location = job.location || 'Remote';
      const sid = `remoteok-${job.id}`;

      const validated = validateOpportunity({
        title: `${job.position} — ${job.company}`,
        description,
        company: job.company || '',
        url: job.url || job.apply_url || null,
        location,
        isAbroad: true,
        isRemote: true,
        expiresAt: null,
      }, 'remoteok');

      if (!validated) { skipped++; continue; }

      seenIds.push(sid);
      records.push({
        id: sid,
        title: validated.title,
        description: validated.description,
        company: validated.company || null,
        url: validated.url ?? null,
        location: validated.location || null,
        isAbroad: validated.isAbroad,
        isRemote: validated.isRemote,
        type: mapType(job.position),
        tags: tags.slice(0, 5),
        postedAt: job.date ? new Date(job.date) : now,
        source: 'RemoteOK',
        sourceId: sid,
        lastSyncedAt: now,
      });
    }

    await batchUpsertOpportunities(records);
    const imported = records.length;

    const staleCount = await markStaleOpportunities('RemoteOK', seenIds, { minSeenForStale: 5 });

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: imported,
        finishedAt: new Date(),
        metadata: { skipped, staleCount },
      },
    });

    logger.info(`[RemoteOK] Imported ${imported}, skipped ${skipped}, expired ${staleCount}`);
    return { imported, skipped, source: 'remoteok' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[RemoteOK] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
