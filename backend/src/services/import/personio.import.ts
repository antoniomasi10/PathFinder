/**
 * Personio ATS — Public XML Job Feed Import
 * Source: https://developer.personio.de/docs/retrieving-open-job-positions
 *
 * Personio is an HR platform popular with European companies. Their XML job
 * feed is public (no auth). We query multiple company career pages and filter
 * for intern/stage/trainee/werkstudent roles relevant to university students.
 *
 * API: GET https://{company}.jobs.personio.com/xml?language=en
 *
 * Runs weekly on Sunday at 03:30 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FETCH_DELAY_MS = 500;

const STUDENT_RE = /\b(intern(?:ship)?|stage|stagiaire|trainee|graduate.program|apprenti(?:ce)?|werkstudent|alternance|co-op|tirocinio)\b/i;

/**
 * Company boards to scrape (slug → display name).
 * Personio feed URL: https://{slug}.jobs.personio.com/xml?language=en
 */
const BOARDS: Record<string, string> = {
  'westwing': 'Westwing',
  'auxmoney-gmbh': 'Auxmoney',
  'tonies': 'Tonies',
  'personio-gmbh': 'Personio',
  'check24': 'CHECK24',
  'homeday': 'Homeday',
  'prima-assicurazioni': 'Prima Assicurazioni',
  'chrono24': 'Chrono24',
  'payhawk': 'Payhawk',
  'userlane': 'Userlane',
  // New EU companies
  '1komma5grad': '1KOMMA5°',
  'thermondo': 'Thermondo',
  'r2p-group': 'r2p Group',
  'em-ag': 'em engineering methods',
  'cosine': 'Cosine',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|ul|ol|h[1-6]|span|strong|em|b|i)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function mapType(title: string): OpportunityType {
  const t = title.toLowerCase();
  if (t.includes('intern')) return 'INTERNSHIP';
  if (t.includes('stage') || t.includes('stagiaire') || t.includes('trainee')) return 'STAGE';
  if (t.includes('graduate')) return 'FELLOWSHIP';
  if (t.includes('apprenti') || t.includes('alternance') || t.includes('werkstudent') || t.includes('co-op')) return 'STAGE';
  return 'INTERNSHIP';
}

function extractCountryFromOffice(office: string, subcompany: string): string {
  const text = `${office} ${subcompany}`.toLowerCase();
  if (text.includes('italy') || text.includes('milan') || text.includes('rome') || text.includes('roma') || text.includes('italia')) return 'IT';
  if (text.includes('munich') || text.includes('berlin') || text.includes('hamburg') || text.includes('germany') || text.includes('deutschland') || text.includes('düsseldorf') || text.includes('frankfurt') || text.includes('cologne') || text.includes('köln')) return 'DE';
  if (text.includes('london') || text.includes('uk') || text.includes('united kingdom')) return 'GB';
  if (text.includes('paris') || text.includes('france')) return 'FR';
  if (text.includes('amsterdam') || text.includes('netherlands')) return 'NL';
  if (text.includes('madrid') || text.includes('barcelona') || text.includes('spain')) return 'ES';
  if (text.includes('dublin') || text.includes('ireland')) return 'IE';
  if (text.includes('remote')) return '';
  return '';
}

// ---------------------------------------------------------------------------
// XML parsing (lightweight, no dependency)
// ---------------------------------------------------------------------------

interface PersonioPosition {
  id: string;
  name: string;
  subcompany: string;
  office: string;
  department: string;
  recruitingCategory: string;
  employmentType: string;
  seniority: string;
  schedule: string;
  descriptions: { name: string; value: string }[];
  createdAt: string;
}

function parsePositions(xml: string): PersonioPosition[] {
  const positions: PersonioPosition[] = [];
  const posBlocks = xml.match(/<position>[\s\S]*?<\/position>/g) || [];

  for (const block of posBlocks) {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].trim() : '';
    };

    // Parse job descriptions
    const descriptions: { name: string; value: string }[] = [];
    const descBlocks = block.match(/<jobDescription>[\s\S]*?<\/jobDescription>/g) || [];
    for (const db of descBlocks) {
      const nameMatch = db.match(/<name>([\s\S]*?)<\/name>/);
      const valueMatch = db.match(/<value>([\s\S]*?)<\/value>/);
      if (nameMatch && valueMatch) {
        descriptions.push({
          name: nameMatch[1].trim(),
          value: stripHtml(valueMatch[1]),
        });
      }
    }

    positions.push({
      id: get('id'),
      name: get('name'),
      subcompany: get('subcompany'),
      office: get('office'),
      department: get('department'),
      recruitingCategory: get('recruitingCategory'),
      employmentType: get('employmentType'),
      seniority: get('seniority'),
      schedule: get('schedule'),
      descriptions,
      createdAt: get('createdAt'),
    });
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importPersonioOpportunities(options?: {
  boards?: Record<string, string>;
}): Promise<{ imported: number; skipped: number; source: string }> {
  logger.info('[Personio] Starting opportunity import...');
  const now = new Date();
  const boards = options?.boards || BOARDS;

  const log = await prisma.importLog.create({
    data: { source: 'personio', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let imported = 0;
    let skipped = 0;
    let boardsProcessed = 0;

    for (const [slug, companyName] of Object.entries(boards)) {
      try {
        const url = `https://${slug}.jobs.personio.com/xml?language=en`;
        logger.info(`[Personio] Fetching ${companyName} (${slug})...`);

        const res = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          headers: { 'Accept': 'application/xml' },
        });

        if (!res.ok) {
          logger.warn(`[Personio] ${companyName} returned ${res.status}`);
          continue;
        }

        const xml = await res.text();
        if (!xml.includes('workzag-jobs')) {
          logger.warn(`[Personio] ${companyName}: unexpected response`);
          continue;
        }

        const positions = parsePositions(xml);

        // Filter for student/intern roles
        const studentPositions = positions.filter(p => STUDENT_RE.test(p.name));

        for (const pos of studentPositions) {
          const sid = `personio-${slug}-${pos.id}`;
          const location = pos.office || '';
          const countryCode = extractCountryFromOffice(location, pos.subcompany);
          const isAbroad = countryCode !== 'IT';
          const isRemote = location.toLowerCase().includes('remote');

          // Build description from job description sections
          const descParts = pos.descriptions.map(d => `${d.name}:\n${d.value}`);
          if (pos.schedule) descParts.push(`Schedule: ${pos.schedule}`);
          if (pos.seniority) descParts.push(`Seniority: ${pos.seniority}`);
          const description = descParts.join('\n\n').slice(0, 10000) || `${pos.name} at ${companyName}`;

          const tags = [pos.department, pos.recruitingCategory, pos.employmentType].filter(Boolean).slice(0, 5) as string[];

          // Career page URL
          const jobUrl = `https://${slug}.jobs.personio.com/job/${pos.id}?language=en`;

          const validated = validateOpportunity({
            title: `${pos.name} — ${companyName}`,
            description,
            company: pos.subcompany || companyName,
            url: jobUrl,
            location,
            isAbroad,
            isRemote,
            expiresAt: null,
          }, 'personio');

          if (!validated) { skipped++; continue; }

          await prisma.opportunity.upsert({
            where: { id: sid },
            update: {
              title: validated.title,
              description: validated.description,
              company: validated.company,
              url: validated.url,
              location: validated.location,
              isAbroad: validated.isAbroad,
              isRemote: validated.isRemote,
              type: mapType(pos.name),
              tags,
              source: 'Personio',
              sourceId: sid,
              lastSyncedAt: now,
            },
            create: {
              id: sid,
              title: validated.title,
              description: validated.description,
              company: validated.company,
              url: validated.url,
              location: validated.location,
              isAbroad: validated.isAbroad,
              isRemote: validated.isRemote,
              type: mapType(pos.name),
              tags,
              postedAt: pos.createdAt ? new Date(pos.createdAt) : now,
              source: 'Personio',
              sourceId: sid,
              lastSyncedAt: now,
            },
          });
          imported++;
        }

        boardsProcessed++;
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
      } catch (err) {
        logger.warn(`[Personio] ${companyName} failed: ${err}`);
      }
    }

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: imported,
        finishedAt: new Date(),
        metadata: { skipped, boardsProcessed, totalBoards: Object.keys(boards).length },
      },
    });

    logger.info(`[Personio] Imported ${imported}, skipped ${skipped} from ${boardsProcessed} boards`);
    return { imported, skipped, source: 'personio' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Personio] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
