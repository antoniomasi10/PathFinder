/**
 * AI-powered opportunity content parser.
 *
 * Extracts structured sections and deadline from raw scraped opportunity text using GPT-4o Mini.
 * Called once per new opportunity at import time — never re-processes existing records.
 *
 * If OPENAI_API_KEY is not set, all functions return null (graceful no-op).
 * On any API error the function returns null, never throws — the import batch must not fail
 * because of an AI call.
 */

import OpenAI from 'openai';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';

export interface StructuredContent {
  opportunityDescription: string | null;
  companyDescription: string | null;
  tasks: string[] | null;
  deadline: string | null;        // ISO 8601 "YYYY-MM-DD", null se non trovata nel testo
  minYearsRequired: number | null; // anni di esperienza lavorativa richiesti; null se entry-level/non specificato
}

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

/** Parsa una stringa ISO date e verifica che sia una data futura valida. */
export function parseAIDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  if (d.getTime() <= Date.now()) return null;
  return d;
}

const SYSTEM_PROMPT = `Sei un assistente che estrae informazioni strutturate da descrizioni di opportunità (stage, fellowship, hackathon, conferenze, ecc.) per studenti universitari italiani.

Data la descrizione grezza di un'opportunità, estrai in JSON:
- "opportunityDescription": 2-4 frasi su cosa prevede l'opportunità (ruolo, programma, obiettivo). Null se non deducibile.
- "companyDescription": 1-3 frasi su chi è l'azienda o l'organizzazione. Null se non c'è informazione sull'azienda.
- "tasks": array di 3-7 frasi brevi (max 15 parole ciascuna) su cosa farà concretamente il partecipante. Null se non deducibile.
- "deadline": data di scadenza per candidarsi in formato "YYYY-MM-DD". Null se non esplicitamente presente nel testo.
- "minYearsRequired": numero intero di anni di esperienza lavorativa richiesti esplicitamente nel testo (es. "3+ years of experience", "minimum 4 anni di esperienza"). Null se il ruolo è entry-level, per studenti, o se non è specificata esperienza pregressa.

Regole:
- Mantieni la lingua dell'input (non tradurre dall'inglese all'italiano).
- Scrivi in modo chiaro e diretto, senza marketing.
- Se un campo non è deducibile dal testo, metti null (non inventare).
- Per "deadline": estrai SOLO se il testo menziona esplicitamente una data di scadenza (es. "Deadline: April 30, 2026", "Apply by May 15", "Closing date: 30/06/2026"). Non inferire.
- Rispondi SOLO con JSON valido, nessun testo aggiuntivo.`;

const DEADLINE_ONLY_PROMPT = `Estrai la data di scadenza per candidarsi (application deadline) dal testo dell'opportunità.
Rispondi SOLO con JSON: { "deadline": "YYYY-MM-DD" } oppure { "deadline": null } se non è esplicitamente presente.
Non inventare date. Estrai solo se il testo le menziona chiaramente.`;

export async function parseOpportunityContent(
  title: string,
  description: string,
  about: string | null,
  company: string | null,
): Promise<StructuredContent | null> {
  const client = getClient();
  if (!client) {
    logger.debug('[OpportunityParser] OPENAI_API_KEY not set — skipping');
    return null;
  }

  const userContent = [
    `Titolo: ${title}`,
    company ? `Azienda/Organizzazione: ${company}` : null,
    `Descrizione:\n${description}`,
    about ? `Info aggiuntive:\n${about}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: 650,
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StructuredContent>;
    return {
      opportunityDescription: typeof parsed.opportunityDescription === 'string' ? parsed.opportunityDescription : null,
      companyDescription: typeof parsed.companyDescription === 'string' ? parsed.companyDescription : null,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter((t): t is string => typeof t === 'string') : null,
      deadline: typeof parsed.deadline === 'string' ? parsed.deadline : null,
      minYearsRequired: typeof parsed.minYearsRequired === 'number' ? Math.round(parsed.minYearsRequired) : null,
    };
  } catch (err) {
    logger.warn(`[OpportunityParser] Failed to parse opportunity "${title}": ${err}`);
    return null;
  }
}

/**
 * Lightweight function that extracts only the deadline from opportunity text.
 * Used by the backfill script — cheaper prompt (50 tokens output vs 650).
 */
export async function extractDeadlineFromText(
  title: string,
  description: string,
  about?: string | null,
): Promise<Date | null> {
  const client = getClient();
  if (!client) return null;

  const userContent = [
    `Titolo: ${title}`,
    `Descrizione:\n${description}`,
    about ? `Info aggiuntive:\n${about}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: DEADLINE_ONLY_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: 50,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { deadline?: string | null };
    return parseAIDate(parsed.deadline ?? null);
  } catch (err) {
    logger.warn(`[OpportunityParser] extractDeadline failed for "${title}": ${err}`);
    return null;
  }
}

const SKILLS_SYSTEM_PROMPT = `Sei un assistente che estrae competenze richieste da descrizioni di opportunità per studenti universitari italiani.

Data la descrizione di un'opportunità, estrai le competenze concrete richieste o preferite.
Rispondi SOLO con JSON: { "skills": ["Competenza 1", "Competenza 2", ...] }

Regole:
- Massimo 5 competenze.
- Solo competenze REALI e SPECIFICHE (es. "Excel avanzato", "Python", "Public speaking", "Analisi dati", "Project management", "Lingua tedesca B2", "Adobe Photoshop").
- NON includere parole vaghe o generiche come "teamwork", "motivazione", "dinamismo", "flessibilità", "passione", "proattività", "team", "junior", "senior".
- NON includere requisiti di studio/anno (quelli sono prerequisiti, non competenze).
- Mantieni la lingua dell'opportunità (se è in inglese, scrivi in inglese).
- Se non ci sono competenze specifiche identificabili, ritorna array vuoto: { "skills": [] }.
- Rispondi SOLO con JSON valido.`;

/**
 * Extracts up to 5 concrete required skills from an opportunity description.
 * Returns an empty array if none found or on error — never throws.
 */
export async function extractOpportunitySkills(
  title: string,
  description: string,
  about?: string | null,
): Promise<string[]> {
  const client = getClient();
  if (!client) return [];

  const userContent = [
    `Titolo: ${title}`,
    `Descrizione:\n${description.slice(0, 3000)}`,
    about ? `Info aggiuntive:\n${about.slice(0, 1000)}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SKILLS_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: 150,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return [];

    const parsed = JSON.parse(raw) as { skills?: unknown };
    if (!Array.isArray(parsed.skills)) return [];
    return parsed.skills
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .slice(0, 5);
  } catch (err) {
    logger.warn(`[OpportunityParser] extractSkills failed for "${title}": ${err}`);
    return [];
  }
}

/**
 * Boot-time backfill: processes up to `limit` active opportunities that have no
 * extractedSkills yet. Runs in the background — never throws, never blocks startup.
 */
export async function backfillExtractedSkillsBoot(limit = 50): Promise<void> {
  if (!process.env.OPENAI_API_KEY) return;

  const now = new Date();
  const opps = await prisma.opportunity.findMany({
    where: {
      extractedSkills: { isEmpty: true },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true, title: true, description: true, about: true },
    take: limit,
    orderBy: { postedAt: 'desc' },
  });

  if (!opps.length) return;

  logger.info(`[SkillsBackfill] Processing ${opps.length} opportunities at boot`);

  for (const opp of opps) {
    try {
      const skills = await extractOpportunitySkills(opp.title, opp.description, opp.about);
      await prisma.opportunity.update({ where: { id: opp.id }, data: { extractedSkills: skills } });
    } catch {
      // Non-fatal — will be retried on next boot
    }
  }

  logger.info('[SkillsBackfill] Boot backfill complete');
}
