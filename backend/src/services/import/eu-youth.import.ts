/**
 * EU Youth Portal + European Solidarity Corps + Erasmus+ Import
 *
 * Sources:
 * - European Youth Portal RSS: https://youth.europa.eu/
 * - Eurodesk Opportunity Finder: https://programmes.eurodesk.eu
 * - Erasmus+ project results: https://erasmus-plus.ec.europa.eu
 *
 * These portals have RSS feeds that can be parsed for opportunities.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';

// RSS/Atom feeds from EU portals
const FEEDS = [
  {
    name: 'EU Youth Portal',
    url: 'https://youth.europa.eu/api/feed/rss',
    fallbackUrl: 'https://youth.europa.eu/eu-youth-programmes_en',
    source: 'eu-youth',
  },
  {
    name: 'Eurodesk Opportunities',
    url: 'https://programmes.eurodesk.eu/rss/opportunities',
    fallbackUrl: 'https://programmes.eurodesk.eu/en',
    source: 'eurodesk',
  },
];

// Simple XML tag extractor (no external dep needed)
function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return (match?.[1] || match?.[2] || '').trim();
}

function extractAllItems(xml: string): string[] {
  const items: string[] = [];
  let pos = 0;
  while (true) {
    const start = xml.indexOf('<item', pos);
    if (start === -1) break;
    const end = xml.indexOf('</item>', start);
    if (end === -1) break;
    items.push(xml.slice(start, end + 7));
    pos = end + 7;
  }
  // Also try <entry> for Atom feeds
  pos = 0;
  while (true) {
    const start = xml.indexOf('<entry', pos);
    if (start === -1) break;
    const end = xml.indexOf('</entry>', start);
    if (end === -1) break;
    items.push(xml.slice(start, end + 8));
    pos = end + 8;
  }
  return items;
}

function mapType(title: string, description: string): OpportunityType {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('volontariato') || text.includes('volunteer') || text.includes('solidarity')) return 'EXTRACURRICULAR';
  if (text.includes('tirocinio') || text.includes('traineeship') || text.includes('stage')) return 'STAGE';
  if (text.includes('borsa') || text.includes('scholarship') || text.includes('fellowship')) return 'FELLOWSHIP';
  if (text.includes('evento') || text.includes('event') || text.includes('conference')) return 'EVENT';
  if (text.includes('erasmus') || text.includes('exchange')) return 'EXTRACURRICULAR';
  return 'INTERNSHIP';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

async function logImport(source: string, fn: () => Promise<number>): Promise<number> {
  const log = await prisma.importLog.create({
    data: { source, type: 'opportunities', status: 'running', startedAt: new Date() },
  });
  try {
    const count = await fn();
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: count > 0 ? 'success' : 'partial', count, finishedAt: new Date() },
    });
    return count;
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    throw err;
  }
}

async function fetchFeed(feedUrl: string): Promise<string | null> {
  try {
    const res = await fetch(feedUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml' },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function importEUOpportunities(): Promise<{ imported: number; sources: string[] }> {
  logger.info('[EU Youth] Starting import from EU portals...');
  const now = new Date();
  let totalImported = 0;
  const activeSources: string[] = [];

  for (const feed of FEEDS) {
    try {
      const count = await logImport(feed.source, async () => {
        // Try primary RSS URL
        let xml = await fetchFeed(feed.url);

        // Try fallback
        if (!xml) {
          xml = await fetchFeed(feed.fallbackUrl);
        }

        if (!xml) {
          logger.warn(`[EU Youth] No data from ${feed.name}`);
          return 0;
        }

        const items = extractAllItems(xml);
        let imported = 0;

        for (const item of items) {
          const title = stripHtml(extractTag(item, 'title'));
          if (!title) continue;

          const description = stripHtml(extractTag(item, 'description') || extractTag(item, 'summary') || extractTag(item, 'content'));
          const link = extractTag(item, 'link') || extractTag(item, 'guid');
          const pubDate = extractTag(item, 'pubDate') || extractTag(item, 'published') || extractTag(item, 'updated');

          // Generate stable ID from link or title hash
          const handle = link
            ? Buffer.from(link).toString('base64url').slice(0, 40)
            : Buffer.from(title).toString('base64url').slice(0, 40);

          const sid = `${feed.source}-${handle}`;

          await prisma.opportunity.upsert({
            where: { id: sid },
            update: {
              title: title.slice(0, 200),
              description: description.slice(0, 5000) || title,
              url: link || null,
              isAbroad: true,
              type: mapType(title, description),
              tags: [feed.source, 'eu-programme'],
              sourceId: sid,
              lastSyncedAt: now,
            },
            create: {
              id: sid,
              title: title.slice(0, 200),
              description: description.slice(0, 5000) || title,
              url: link || null,
              location: 'Europa',
              isAbroad: true,
              isRemote: false,
              type: mapType(title, description),
              tags: [feed.source, 'eu-programme'],
              postedAt: pubDate ? new Date(pubDate) : now,
              sourceId: sid,
              lastSyncedAt: now,
            },
          });
          imported++;
        }

        return imported;
      });

      if (count > 0) activeSources.push(feed.name);
      totalImported += count;
      logger.info(`[EU Youth] ${feed.name}: ${count} opportunities`);
    } catch (err) {
      logger.warn(`[EU Youth] ${feed.name} failed: ${err}`);
    }
  }

  logger.info(`[EU Youth] Total imported: ${totalImported} from ${activeSources.length} sources`);
  return { imported: totalImported, sources: activeSources };
}
