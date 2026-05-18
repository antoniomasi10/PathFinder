/**
 * AI-powered opportunity content parser.
 *
 * Extracts structured sections, deadline, and inferred eligibility fields from raw
 * scraped opportunity text using GPT-4o Mini. Output is forced in Italian regardless
 * of source language. Called once per new opportunity at import time.
 *
 * If OPENAI_API_KEY is not set, all functions return null (graceful no-op).
 * On any API error the function returns null, never throws.
 */

import OpenAI from 'openai';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';

const VALID_FIELDS = [
  'COMPUTER_SCIENCE',
  'ENGINEERING',
  'MEDICINE',
  'LIFE_SCIENCES',
  'PHYSICAL_SCIENCES',
  'MATHEMATICS',
  'ECONOMICS',
  'BUSINESS',
  'LAW',
  'POLITICAL_SCIENCE',
  'HUMANITIES',
  'DESIGN',
  'ARCHITECTURE',
  'PSYCHOLOGY',
  'EDUCATION',
  'ANY',
] as const;
export type FieldOfStudyValue = typeof VALID_FIELDS[number];
const VALID_FIELDS_SET = new Set<string>(VALID_FIELDS);

export interface StructuredContent {
  opportunityDescription: string | null;
  companyDescription: string | null;
  tasks: string[] | null;
  deadline: string | null;        // ISO 8601 "YYYY-MM-DD"
  minYearsRequired: number | null;
  eligibleFields: FieldOfStudyValue[]; // inferred from text; [] = open to all
  targetAudience: string | null;       // short Italian description, audit/UX
  parsedLanguage: string | null;       // detected source language (e.g. "en", "it")
}

const LIMITS = {
  descSentences: 3,
  descWords: 60,
  companySentences: 2,
  companyWords: 40,
  taskCount: 6,
  taskWords: 12,
} as const;

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export function parseAIDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  if (d.getTime() <= Date.now()) return null;
  return d;
}

const SYSTEM_PROMPT = `Sei un assistente che estrae informazioni strutturate da descrizioni di opportunità (stage, fellowship, hackathon, conferenze, ecc.) per studenti universitari italiani.

REGOLA LINGUA (assoluta): rispondi SEMPRE in italiano, anche se il testo sorgente è in inglese, francese, spagnolo o altra lingua. Traduci tu i contenuti in italiano naturale e scorrevole. Non lasciare frasi nella lingua originale.

Estrai un JSON con questi campi:
- "opportunityDescription": cosa prevede l'opportunità (ruolo, programma, obiettivo). MASSIMO ${LIMITS.descSentences} frasi e ${LIMITS.descWords} parole totali. Chiaro, diretto, senza marketing. Null se non deducibile.
- "companyDescription": chi è l'azienda/organizzazione. MASSIMO ${LIMITS.companySentences} frasi e ${LIMITS.companyWords} parole. Null se non c'è informazione.
- "tasks": array di MASSIMO ${LIMITS.taskCount} bullet (minimo 3). Ogni bullet inizia con un verbo all'infinito (es. "Sviluppare", "Analizzare") ed è MASSIMO ${LIMITS.taskWords} parole. Null se non deducibile.
- "deadline": data di scadenza per candidarsi in formato "YYYY-MM-DD". Estrai SOLO se il testo la menziona esplicitamente (es. "Deadline: April 30, 2026", "Apply by May 15"). Null altrimenti. Non inventare.
- "minYearsRequired": intero, anni di esperienza lavorativa richiesti esplicitamente (es. "3+ years of experience"). Null se entry-level, per studenti, o non specificato.
- "eligibleFields": array di campi di studio richiesti per candidarsi. Usa SOLO questi valori esatti: ${VALID_FIELDS.join(', ')}. Sii CONSERVATIVO: se l'opportunità è specifica di un dominio tecnico (es. ingegneria, medicina, design), DEVI inserire il/i campo/i corrispondenti. Lascia [] SOLO se è davvero aperta a qualsiasi studente universitario. Esempi: stage di sviluppo software → ["COMPUTER_SCIENCE","ENGINEERING"]; programma di marketing → ["BUSINESS","ECONOMICS"]; ricerca biomedica → ["MEDICINE","LIFE_SCIENCES"]; hackathon generalista aperto a tutti → [].
- "targetAudience": una frase breve in italiano che descrive il pubblico target (es. "Studenti di ingegneria magistrale", "Qualsiasi studente universitario", "Studenti di business o economia"). Null se davvero non deducibile.
- "parsedLanguage": codice ISO 2 lettere della lingua sorgente del testo di input (es. "en", "it", "fr", "es"). Mai null.

Regole generali:
- Se un campo non è deducibile, metti null (non inventare).
- Non superare MAI i limiti di lunghezza indicati. Se devi tagliare, taglia.
- Rispondi SOLO con JSON valido, nessun testo aggiuntivo.`;

const DEADLINE_ONLY_PROMPT = `Estrai la data di scadenza per candidarsi (application deadline) dal testo dell'opportunità.
Rispondi SOLO con JSON: { "deadline": "YYYY-MM-DD" } oppure { "deadline": null } se non è esplicitamente presente.
Non inventare date. Estrai solo se il testo le menziona chiaramente.`;

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(s: string): number {
  return s.split(/[.!?]+\s/).filter(t => t.trim().length > 0).length;
}

interface ValidationIssue {
  field: string;
  reason: string;
}

function validateStructured(s: StructuredContent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (s.opportunityDescription) {
    const w = countWords(s.opportunityDescription);
    const sent = countSentences(s.opportunityDescription);
    if (w > LIMITS.descWords) issues.push({ field: 'opportunityDescription', reason: `${w} parole > ${LIMITS.descWords}` });
    if (sent > LIMITS.descSentences) issues.push({ field: 'opportunityDescription', reason: `${sent} frasi > ${LIMITS.descSentences}` });
  }
  if (s.companyDescription) {
    const w = countWords(s.companyDescription);
    const sent = countSentences(s.companyDescription);
    if (w > LIMITS.companyWords) issues.push({ field: 'companyDescription', reason: `${w} parole > ${LIMITS.companyWords}` });
    if (sent > LIMITS.companySentences) issues.push({ field: 'companyDescription', reason: `${sent} frasi > ${LIMITS.companySentences}` });
  }
  if (s.tasks) {
    if (s.tasks.length > LIMITS.taskCount) {
      issues.push({ field: 'tasks', reason: `${s.tasks.length} bullet > ${LIMITS.taskCount}` });
    }
    s.tasks.forEach((t, i) => {
      const w = countWords(t);
      if (w > LIMITS.taskWords) issues.push({ field: `tasks[${i}]`, reason: `${w} parole > ${LIMITS.taskWords}` });
    });
  }
  return issues;
}

function normalizeRaw(raw: unknown): StructuredContent {
  const p = (raw ?? {}) as Record<string, unknown>;
  const fields = Array.isArray(p.eligibleFields)
    ? (p.eligibleFields as unknown[])
        .filter((v): v is string => typeof v === 'string')
        .map(v => v.trim().toUpperCase())
        .filter((v): v is FieldOfStudyValue => VALID_FIELDS_SET.has(v))
    : [];
  return {
    opportunityDescription: typeof p.opportunityDescription === 'string' ? p.opportunityDescription.trim() : null,
    companyDescription: typeof p.companyDescription === 'string' ? p.companyDescription.trim() : null,
    tasks: Array.isArray(p.tasks)
      ? (p.tasks as unknown[]).filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map(t => t.trim())
      : null,
    deadline: typeof p.deadline === 'string' ? p.deadline : null,
    minYearsRequired: typeof p.minYearsRequired === 'number' ? Math.round(p.minYearsRequired) : null,
    eligibleFields: fields,
    targetAudience: typeof p.targetAudience === 'string' ? p.targetAudience.trim() : null,
    parsedLanguage: typeof p.parsedLanguage === 'string' ? p.parsedLanguage.trim().toLowerCase().slice(0, 5) : null,
  };
}

async function callLLM(
  client: OpenAI,
  userContent: string,
  extraSystem?: string,
): Promise<StructuredContent | null> {
  const system = extraSystem ? `${SYSTEM_PROMPT}\n\n${extraSystem}` : SYSTEM_PROMPT;
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
    max_tokens: 700,
    temperature: 0.2,
  });
  const raw = response.choices[0]?.message?.content;
  if (!raw) return null;
  return normalizeRaw(JSON.parse(raw));
}

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

  // Cap input length to avoid runaway token usage on pathological scrapes.
  const MAX_DESC_CHARS = 8000;
  const safeDesc = description.length > MAX_DESC_CHARS ? description.slice(0, MAX_DESC_CHARS) : description;
  const safeAbout = about && about.length > 2000 ? about.slice(0, 2000) : about;

  const userContent = [
    `Titolo: ${title}`,
    company ? `Azienda/Organizzazione: ${company}` : null,
    `Descrizione:\n${safeDesc}`,
    safeAbout ? `Info aggiuntive:\n${safeAbout}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    let parsed = await callLLM(client, userContent);
    if (!parsed) return null;

    let issues = validateStructured(parsed);
    if (issues.length > 0) {
      logger.debug(`[OpportunityParser] "${title}" violates limits: ${issues.map(i => `${i.field}(${i.reason})`).join(', ')} — retrying with compression hint`);
      const compressionHint = `IMPORTANTE: il tentativo precedente ha sforato questi limiti: ${issues.map(i => `${i.field} (${i.reason})`).join('; ')}. Rispetta TASSATIVAMENTE i limiti di lunghezza questa volta. Taglia il superfluo.`;
      const retried = await callLLM(client, userContent, compressionHint);
      if (retried) {
        const retryIssues = validateStructured(retried);
        // Prefer retry only if it has fewer (or zero) issues
        if (retryIssues.length < issues.length) {
          parsed = retried;
          issues = retryIssues;
        }
      }
    }

    // Hard-truncate any remaining over-length tasks rather than dropping them.
    if (parsed.tasks) {
      parsed.tasks = parsed.tasks.slice(0, LIMITS.taskCount).map(t => {
        const words = t.split(/\s+/);
        return words.length > LIMITS.taskWords ? words.slice(0, LIMITS.taskWords).join(' ') : t;
      });
    }

    return parsed;
  } catch (err) {
    logger.warn(`[OpportunityParser] Failed to parse opportunity "${title}": ${err}`);
    return null;
  }
}

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

const TRANSLATE_SYSTEM_PROMPT = `Sei un traduttore professionista. Traduci il testo fornito in italiano naturale e scorrevole.
Regole:
- Mantieni titoli di lavoro, nomi propri, brand e acronimi nella forma originale (es. "Software Engineer", "Goldman Sachs", "MIT").
- Se il testo è GIÀ in italiano, restituiscilo invariato.
- NON aggiungere commenti, prefissi o suffissi.
- Preserva la formattazione (newline, elenchi puntati, paragrafi).
- Rispondi SOLO con JSON valido: { "title": "...", "description": "..." }`;

/**
 * Translates an opportunity's title and description to Italian via OpenAI.
 * Returns null on error or when OPENAI_API_KEY is not set — never throws.
 */
export async function translateOpportunityToItalian(
  title: string,
  description: string,
): Promise<{ title: string; description: string } | null> {
  const client = getClient();
  if (!client) return null;

  const userContent = JSON.stringify({ title, description: description.slice(0, 6000) });

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: TRANSLATE_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { title?: unknown; description?: unknown };
    const t = typeof parsed.title === 'string' ? parsed.title.trim() : null;
    const d = typeof parsed.description === 'string' ? parsed.description.trim() : null;
    if (!t || !d) return null;
    return { title: t, description: d };
  } catch (err) {
    logger.warn(`[OpportunityParser] translate failed for "${title}": ${err}`);
    return null;
  }
}

/**
 * Boot-time backfill: processes up to `limit` active opportunities that have no
 * extractedSkills yet. Runs in the background — never throws, never blocks startup.
 */
export async function backfillExtractedSkillsBoot(limit = 200): Promise<void> {
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

  const CONCURRENCY = 5;
  logger.info(`[SkillsBackfill] Processing ${opps.length} opportunities at boot (concurrency=${CONCURRENCY})`);

  for (let i = 0; i < opps.length; i += CONCURRENCY) {
    const chunk = opps.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (opp) => {
        try {
          const skills = await extractOpportunitySkills(opp.title, opp.description, opp.about);
          await prisma.opportunity.update({ where: { id: opp.id }, data: { extractedSkills: skills } });
        } catch {
          // Non-fatal — will be retried on next boot
        }
      }),
    );
  }

  logger.info('[SkillsBackfill] Boot backfill complete');
}
