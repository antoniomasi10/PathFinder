/**
 * Ingest one CompanyRegistry source (Fase 5 company-first scale-up).
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/ingestCompanyRegistry.ts --source registro-imprese-startup --file path/to/export.csv
 *   npx ts-node --transpile-only src/scripts/ingestCompanyRegistry.ts --source wikidata
 *   npx ts-node --transpile-only src/scripts/ingestCompanyRegistry.ts --source manual:mediobanca-top --file path/to/list.csv
 *   npx ts-node --transpile-only src/scripts/ingestCompanyRegistry.ts --source commoncrawl-ats --platform greenhouse
 */
import prisma from '../lib/prisma';
import { ingestRegistryEntities } from '../services/import/company-registry/ingest';
import { registroImpreseStartupLoader } from '../services/import/company-registry/loaders/registro-imprese-startup.loader';
import { wikidataLoader } from '../services/import/company-registry/loaders/wikidata.loader';
import { manualListLoader } from '../services/import/company-registry/loaders/manual-list.loader';
import { commonCrawlAtsLoader } from '../services/import/company-registry/loaders/commoncrawl-ats.loader';
import { RegistryLoader } from '../services/import/company-registry/types';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = value;
    }
  }
  return out;
}

function resolveLoader(source: string): RegistryLoader {
  if (source === 'registro-imprese-startup') return registroImpreseStartupLoader;
  if (source === 'wikidata') return wikidataLoader;
  if (source === 'commoncrawl-ats') return commonCrawlAtsLoader;
  if (source.startsWith('manual:')) return manualListLoader(source);
  throw new Error(`Unknown --source "${source}". Supported: registro-imprese-startup, wikidata, commoncrawl-ats, manual:<list-name>`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.source) {
    console.error('Usage: ingestCompanyRegistry.ts --source <name> [--file <path>] [--platform <ats>]');
    process.exit(1);
  }

  const loader = resolveLoader(args.source);
  console.log(`[ingestCompanyRegistry] Loading from "${args.source}"...`);
  const entities = await loader.load({ filePath: args.file, platform: args.platform });
  console.log(`[ingestCompanyRegistry] Loaded ${entities.length} candidate entities`);

  const result = await ingestRegistryEntities(loader.source, entities);
  console.log('[ingestCompanyRegistry] Done:', result);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
