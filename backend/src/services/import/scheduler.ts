/**
 * Import Scheduler
 *
 * Cron schedules:
 * - EU Youth/Eurodesk: weekly Monday 03:30 | SmartRecruiters: weekly Monday 04:00
 * - Arbeitnow: weekly Tuesday 03:30 | RemoteOK: weekly Tuesday 04:00
 * - Stage4eu: weekly Wednesday 03:30
 * - Greenhouse: weekly Thursday 03:30 | Jobicy: weekly Thursday 04:00
 * - Lever: weekly Friday 03:30 | FashionUnited: weekly Friday 04:00
 * - Ashby: weekly Saturday 03:30 | Workable: weekly Saturday 04:00
 * - Personio: weekly Sunday 03:30 | Cleanup: weekly Sunday 05:00
 * - MUR universities: 1st of each month at 02:00
 * - MUR courses: 1st of each month at 02:30
 * - AlmaLaurea stats: quarterly (1st Jan, Apr, Jul, Oct at 04:00)
 * - Developers.events Italian conferences: weekly Tuesday 04:30 (CC BY-NC 4.0)
 * - TechConfit Italian conferences: weekly Thursday 04:30 (CC0)
 * - Mobilizon Italy community events: weekly Friday 04:30 (AGPL-3.0)
 *
 * NOTE: EURES scraper disabled — no public API available.
 * Existing EURES data remains in DB as static cache.
 *
 * REMOVED: Bundesagentur — unofficial reverse-engineered API, BA explicitly opposed automated access.
 * REMOVED: The Muse — ToS Section 3.3 prohibits replicating services. Replaced by Jobicy.
 *
 * EXCLUDED (ToS violations): Eventbrite (§13.1 bans scraping), EventItalia (redistribution banned),
 * Lu.ma (ambiguous "publicly supported interfaces"), Bevy/Startup Grind/GDG (explicit scraping ban).
 */
import cron from 'node-cron';
import { importUniversities, importCourses } from './mur.import';
import { importEUOpportunities } from './eu-youth.import';
import { importStage4euOpportunities } from './stage4eu.import';
import { importGreenhouseOpportunities } from './greenhouse.import';
import { importLeverOpportunities } from './lever.import';
import { importAshbyOpportunities } from './ashby.import';
import { importWorkableOpportunities } from './workable.import';
import { importPersonioOpportunities } from './personio.import';
import { importArbeitnowOpportunities } from './arbeitnow.import';
import { importRemoteOKOpportunities } from './remoteok.import';
import { importJobicyOpportunities } from './jobicy.import';
import { importFashionUnitedOpportunities } from './fashionunited.import';
import { importSmartRecruitersOpportunities } from './smartrecruiters.import';
import { importHackClubOpportunities } from './hackclub.import';
import { importDevpostOpportunities } from './devpost.import';
import { importBestCoursesOpportunities } from './best-courses.import';
import { importConfsTechOpportunities } from './confstech.import';
import { importAlmaLaureaStats } from './almalaurea.import';
import { importOpportunityDeskOpportunities } from './opportunity-desk.import';
import { importDevelopersEventsOpportunities } from './developers-events.import';
import { importTechConfitOpportunities } from './techconfit.import';
import { importMobilizonOpportunities } from './mobilizon.import';
import { importCompanyWatchlistOpportunities } from './company-watchlist.import';
import { importANPALOpportunities } from './anpal.import';
import { runAtsConnector } from './ats/ats-connector';
import { recruiteeAdapter } from './ats/adapters/recruitee';
import { runDiscovery } from './discovery/discovery.orchestrator';
import { enqueueScrapeJobs } from './discovery/queue';
import { runScrapeWorker } from './discovery/scrapeWorker';
// F6S: DISABLED — import will be added here after C0 compliance verification (see f6s.import.ts)
import { runCleanup } from './cleanup.service';
import { runUrlCheckBatch } from './urlChecker';
import { alertImportFailure } from './alerting';
import { resetDedupCache } from './validation';
import { logger } from '../../utils/logger';

async function runWithAlert(name: string, source: string, type: string, fn: () => Promise<any>) {
  // Reset the in-process dedup cache before each import so stale keys from a
  // previous weekly run don't cause legitimate new records to be silently skipped.
  resetDedupCache();
  try {
    const result = await fn();
    logger.info(`[Scheduler] ${name}: ${JSON.stringify(result)}`);
  } catch (err: any) {
    logger.error(`[Scheduler] ${name} failed: ${err}`);
    alertImportFailure(source, type, String(err)).catch(() => {});
  }
}

export function startImportScheduler() {
  // EURES: disabled — no public API, data kept as static cache in DB
  // Bundesagentur: REMOVED — unofficial reverse-engineered API, BA explicitly opposed automated access
  // The Muse: REMOVED — ToS Section 3.3 prohibits replicating services

  // Mon/Wed/Fri: Opportunity Desk RSS (02:00) — fellowship, competition, research, volunteering
  cron.schedule('0 2 * * 1,3,5', () => {
    runWithAlert('Opportunity Desk', 'opportunity-desk', 'opportunities', importOpportunityDeskOpportunities);
  });

  // Weekly Monday: EU Youth + Eurodesk (03:30)
  cron.schedule('30 3 * * 1', () => {
    runWithAlert('EU Youth', 'eu-youth', 'opportunities', importEUOpportunities);
  });

  // Weekly Monday: SmartRecruiters enterprise/German industrial (04:00)
  cron.schedule('0 4 * * 1', () => {
    runWithAlert('SmartRecruiters', 'smartrecruiters', 'opportunities', importSmartRecruitersOpportunities);
  });

  // Weekly Monday: HackClub hackathons (04:30)
  cron.schedule('30 4 * * 1', () => {
    runWithAlert('HackClub', 'hackclub', 'opportunities', importHackClubOpportunities);
  });

  // Weekly Wednesday: Confs.tech tech conferences (03:00) — MIT license open data
  cron.schedule('0 3 * * 3', () => {
    runWithAlert('ConfsTech', 'confstech', 'opportunities', importConfsTechOpportunities);
  });

  // Weekly Wednesday: Stage4eu (03:30)
  cron.schedule('30 3 * * 3', () => {
    runWithAlert('Stage4eu', 'stage4eu', 'opportunities', importStage4euOpportunities);
  });

  // Weekly Wednesday: Company Watchlist LLM-assisted scraping (05:30)
  cron.schedule('30 5 * * 3', () => {
    runWithAlert('CompanyWatchlist', 'company-watchlist', 'opportunities', importCompanyWatchlistOpportunities);
  });

  // Weekly Thursday: Greenhouse internships (03:30)
  cron.schedule('30 3 * * 4', () => {
    runWithAlert('Greenhouse', 'greenhouse', 'opportunities', importGreenhouseOpportunities);
  });

  // Weekly Thursday: Jobicy remote internships (04:00)
  cron.schedule('0 4 * * 4', () => {
    runWithAlert('Jobicy', 'jobicy', 'opportunities', importJobicyOpportunities);
  });

  // Weekly Thursday: TechConfit Italian tech conferences (04:30) — CC0 Public Domain
  cron.schedule('30 4 * * 4', () => {
    runWithAlert('TechConfit', 'techconfit', 'opportunities', importTechConfitOpportunities);
  });

  // Devpost: DISABLED — ToS prohibits automated access (support@devpost.com for API access)

  // Weekly Friday: Lever internships (03:30)
  cron.schedule('30 3 * * 5', () => {
    runWithAlert('Lever', 'lever', 'opportunities', importLeverOpportunities);
  });

  // Weekly Friday: FashionUnited fashion internships (04:00)
  cron.schedule('0 4 * * 5', () => {
    runWithAlert('FashionUnited', 'fashionunited', 'opportunities', importFashionUnitedOpportunities);
  });

  // Weekly Friday: Mobilizon Italy community events (04:30) — AGPL-3.0 public API
  cron.schedule('30 4 * * 5', () => {
    runWithAlert('Mobilizon', 'mobilizon-it', 'opportunities', importMobilizonOpportunities);
  });

  // Weekly Saturday: Ashby internships (03:30)
  cron.schedule('30 3 * * 6', () => {
    runWithAlert('Ashby', 'ashby', 'opportunities', importAshbyOpportunities);
  });

  // Weekly Saturday: Workable internships (04:00)
  cron.schedule('0 4 * * 6', () => {
    runWithAlert('Workable', 'workable', 'opportunities', importWorkableOpportunities);
  });

  // Weekly Saturday: Recruitee internships (04:30) — factory ATS, DB-driven tokens
  cron.schedule('30 4 * * 6', () => {
    runWithAlert('Recruitee', 'recruitee', 'opportunities', () => runAtsConnector(recruiteeAdapter));
  });

  // Weekly Sunday: Personio internships (03:30)
  cron.schedule('30 3 * * 0', () => {
    runWithAlert('Personio', 'personio', 'opportunities', importPersonioOpportunities);
  });

  // Weekly Tuesday: Arbeitnow aggregator (03:30)
  cron.schedule('30 3 * * 2', () => {
    runWithAlert('Arbeitnow', 'arbeitnow', 'opportunities', importArbeitnowOpportunities);
  });

  // Weekly Tuesday: RemoteOK (04:00)
  cron.schedule('0 4 * * 2', () => {
    runWithAlert('RemoteOK', 'remoteok', 'opportunities', importRemoteOKOpportunities);
  });

  // Weekly Tuesday: Developers.events Italian conferences (04:30) — CC BY-NC 4.0
  cron.schedule('30 4 * * 2', () => {
    runWithAlert('DevelopersEvents', 'developers-events', 'opportunities', importDevelopersEventsOpportunities);
  });

  // BEST Courses: DISABLED — ToS unclear (403 on legal pages). Contact info@best.eu.org before re-enabling.

  // Monthly 1st: MUR universities (02:00) + courses (02:30)
  cron.schedule('0 2 1 * *', () => {
    runWithAlert('MUR Universities', 'mur', 'universities', importUniversities);
  });

  cron.schedule('30 2 1 * *', () => {
    runWithAlert('MUR Courses', 'mur', 'courses', importCourses);
  });

  // Monthly 1st: ANPAL — Garanzia Giovani + Servizio Civile Universale (03:00)
  cron.schedule('0 3 1 * *', () => {
    runWithAlert('ANPAL', 'anpal', 'opportunities', importANPALOpportunities);
  });

  // Quarterly: AlmaLaurea stats (1st Jan/Apr/Jul/Oct at 04:00)
  cron.schedule('0 4 1 1,4,7,10 *', () => {
    runWithAlert('AlmaLaurea', 'almalaurea', 'stats', importAlmaLaureaStats);
  });

  // F6S: DISABLED — pending C0 compliance verification (robots.txt + ToS)
  // After C0: add import at top, then uncomment:
  // cron.schedule('0 5 * * 2', () => {
  //   runWithAlert('F6S', 'f6s', 'opportunities', importF6sOpportunities);
  // });

  // --- Import expansion: discovery → registry → scrape queue ---

  // Weekly Monday: company discovery (02:30) — validates + registers ATS boards
  cron.schedule('30 2 * * 1', () => {
    runWithAlert('Discovery', 'discovery', 'companies', () => runDiscovery());
  });

  // Daily: enqueue tier B/C scrape jobs for due companies (01:00)
  cron.schedule('0 1 * * *', () => {
    runWithAlert('ScrapeEnqueue', 'scrape-queue', 'companies', () => enqueueScrapeJobs());
  });

  // Every 2 hours: drain the scrape queue (tier B/C, change-detected)
  cron.schedule('0 */2 * * *', () => {
    runWithAlert('ScrapeWorker', 'scrape-queue', 'opportunities', () => runScrapeWorker());
  });

  // Weekly Sunday: cleanup (05:00)
  cron.schedule('0 5 * * 0', async () => {
    logger.info('[Scheduler] Cleanup...');
    try {
      const r = await runCleanup();
      logger.info('[Scheduler] Cleanup done', { ...r });
    } catch (err) { logger.error(`[Scheduler] Cleanup failed: ${err}`); }
  });

  // Weekly Sunday: URL health check (06:00) — after cleanup
  cron.schedule('0 6 * * 0', async () => {
    logger.info('[Scheduler] URL check batch...');
    try {
      const r = await runUrlCheckBatch(300);
      logger.info('[Scheduler] URL check done', { ...r });
    } catch (err) { logger.error(`[Scheduler] URL check failed: ${err}`); }
  });

  logger.info('[Scheduler] Import scheduler started:');
  logger.info('  EURES: disabled (static cache) | F6S: disabled (pending C0 verification)');
  logger.info('  EU Youth: Mon 03:30 | SmartRecruiters: Mon 04:00 | HackClub: Mon 04:30');
  logger.info('  Arbeitnow: Tue 03:30 | RemoteOK: Tue 04:00 | DevelopersEvents: Tue 04:30');
  logger.info('  ConfsTech: Wed 03:00 | Stage4eu: Wed 03:30 | CompanyWatchlist: Wed 05:30');
  logger.info('  Greenhouse: Thu 03:30 | Jobicy: Thu 04:00 | TechConfit: Thu 04:30');
  logger.info('  Lever: Fri 03:30 | FashionUnited: Fri 04:00 | Mobilizon: Fri 04:30');
  logger.info('  Ashby: Sat 03:30 | Workable: Sat 04:00 | Recruitee: Sat 04:30');
  logger.info('  Personio: Sun 03:30 | Cleanup: Sun 05:00 | URL check: Sun 06:00');
  logger.info('  Discovery: Mon 02:30 | ScrapeEnqueue: daily 01:00 | ScrapeWorker: every 2h');
  logger.info('  MUR: monthly 1st 02:00/02:30 | ANPAL (GG+SCU): monthly 1st 03:00 | AlmaLaurea: quarterly');
}
