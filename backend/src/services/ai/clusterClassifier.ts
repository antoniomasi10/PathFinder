/**
 * AI-powered opportunity cluster classification.
 *
 * Classifies opportunities into the 6 Schwartz personality clusters using GPT-4o Mini.
 * Returns deterministic fallback scores if OPENAI_API_KEY is not set or API fails.
 *
 * If OPENAI_API_KEY is not set, uses fallbackClassify() — never returns null.
 * On any API error, returns fallback result instead of null.
 */

import OpenAI from 'openai';
import { logger } from '../../utils/logger';

export interface ClusterClassification {
  scores: Record<'Analista' | 'Creativo' | 'Leader' | 'Imprenditore' | 'Sociale' | 'Explorer', number>;
  primary: 'Analista' | 'Creativo' | 'Leader' | 'Imprenditore' | 'Sociale' | 'Explorer';
}

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

const SYSTEM_PROMPT = `Sei un esperto di psicologia del lavoro specializzato nella classificazione di opportunità universitarie secondo i cluster di personalità di Schwartz.

I 6 cluster sono:
- Analista: pensiero analitico, dati, ricerca, problem solving strutturato.
- Creativo: design, arte, contenuti, espressione, innovazione estetica.
- Leader: gestione team, management, decisioni, influenza, responsabilità.
- Imprenditore: business building, startup, rischio, monetizzazione, prodotto da zero.
- Sociale: impatto sociale, volontariato, community, persone, educazione, sanità.
- Explorer: viaggi, scambi culturali, internazionalità, scoperta, lingue.

RUBRICA DI SCORING (0.0–1.0):
- 0.85–1.0: il cluster è l'identità CORE dell'opportunità (identità esclusiva o quasi)
- 0.60–0.84: forte allineamento, il cluster è una componente primaria
- 0.35–0.59: presenza moderata, il cluster è rilevante ma non dominante
- 0.15–0.34: presenza debole, il cluster appare ma non è centrale
- 0.00–0.14: non pertinente o minimamente presente

REGOLA FONDAMENTALE: la maggior parte delle opportunità tocca 2-4 cluster con intensità diverse. Evita distribuzioni binarie dove un cluster è vicino a 1.0 e tutti gli altri sono vicini a 0.0. Usa la rubrica sopra per riflettere le sfumature reali.

ESEMPI DI CALIBRAZIONE:

Esempio 1 — Hackathon AI per startup (HACKATHON, tag: ai, startup, data):
{ "Analista": 0.80, "Imprenditore": 0.65, "Creativo": 0.30, "Leader": 0.25, "Sociale": 0.10, "Explorer": 0.10 }
→ Analista domina (dati/ML), Imprenditore forte (startup mindset), Creativo presente (design soluzioni)

Esempio 2 — Programma Erasmus + tirocinio (EXCHANGE, tag: international, language):
{ "Explorer": 0.90, "Sociale": 0.45, "Leader": 0.40, "Analista": 0.20, "Imprenditore": 0.25, "Creativo": 0.20 }
→ Explorer nettamente dominante, ma Sociale e Leader hanno peso reale (adattamento, relazioni)

Rispondi SOLO con JSON valido: { "scores": { "Analista": 0.0, "Creativo": 0.0, "Leader": 0.0, "Imprenditore": 0.0, "Sociale": 0.0, "Explorer": 0.0 }, "primary": "Leader" }
I valori devono essere compresi tra 0.0 e 1.0.
Il campo "primary" deve essere il cluster con il punteggio più alto.`;

const CLUSTERS = ['Analista', 'Creativo', 'Leader', 'Imprenditore', 'Sociale', 'Explorer'] as const;

type Cluster = typeof CLUSTERS[number];

/**
 * Deterministic fallback classification based on opportunity type and tags.
 * Used when OPENAI_API_KEY is not set or API call fails.
 */
export function fallbackClassify(opp: {
  title: string;
  description: string;
  type: string;
  tags?: string[];
  eligibleFields?: string[];
}): ClusterClassification {
  // Initialize all clusters to 0.5
  const scores: Record<Cluster, number> = {
    Analista: 0.5,
    Creativo: 0.5,
    Leader: 0.5,
    Imprenditore: 0.5,
    Sociale: 0.5,
    Explorer: 0.5,
  };

  // Map opportunity type to cluster scores
  switch (opp.type) {
    case 'RESEARCH':
    case 'HACKATHON':
    case 'COMPETITION':
      scores.Analista = 0.9;
      scores.Leader = 0.5;
      scores.Explorer = 0.3;
      break;
    case 'EXTRACURRICULAR':
    case 'EVENT':
      scores.Creativo = 0.7;
      scores.Sociale = 0.6;
      scores.Explorer = 0.5;
      break;
    case 'FELLOWSHIP':
      scores.Leader = 0.9;
      scores.Imprenditore = 0.6;
      scores.Analista = 0.4;
      break;
    case 'TIROCINIO':
      scores.Leader = 0.7;
      scores.Analista = 0.6;
      scores.Imprenditore = 0.5;
      break;
    case 'BOOTCAMP':
      scores.Analista = 0.7;
      scores.Creativo = 0.5;
      scores.Imprenditore = 0.5;
      break;
    case 'SUMMER_PROGRAM':
    case 'EXCHANGE':
      scores.Explorer = 0.95;
      scores.Sociale = 0.6;
      scores.Leader = 0.4;
      break;
    case 'VOLUNTEERING':
      scores.Sociale = 0.95;
      scores.Explorer = 0.4;
      break;
    // default stays at 0.5 for all
  }

  // Boost scores based on tag keywords
  const allText = [opp.title, opp.description, ...(opp.tags || [])].join(' ').toLowerCase();

  if (/design|art|creative|content|ux/i.test(allText)) {
    scores.Creativo = Math.min(scores.Creativo + 0.2, 1);
  }
  if (/startup|business|founder|entrepreneur/i.test(allText)) {
    scores.Imprenditore = Math.min(scores.Imprenditore + 0.2, 1);
  }
  if (/data|ai|ml|research|analytics/i.test(allText)) {
    scores.Analista = Math.min(scores.Analista + 0.2, 1);
  }
  if (/leadership|management|mba/i.test(allText)) {
    scores.Leader = Math.min(scores.Leader + 0.2, 1);
  }
  if (/social|volunteer|community|health|education/i.test(allText)) {
    scores.Sociale = Math.min(scores.Sociale + 0.2, 1);
  }
  if (/travel|exchange|international|language|abroad/i.test(allText)) {
    scores.Explorer = Math.min(scores.Explorer + 0.2, 1);
  }

  // Compute primary as the highest-scoring cluster (server-side)
  const primary = (Object.entries(scores).reduce((a, b) =>
    a[1] > b[1] ? a : b,
  )[0] as Cluster) || 'Analista';

  return { scores, primary };
}

/**
 * Classifies an opportunity into Schwartz personality clusters.
 * Returns fallback classification if OPENAI_API_KEY is not set or API fails.
 */
export async function classifyOpportunityCluster(opp: {
  title: string;
  description: string;
  type: string;
  tags?: string[];
  eligibleFields?: string[];
}): Promise<ClusterClassification> {
  const client = getClient();

  // If no API key, use fallback immediately
  if (!client) {
    logger.debug('[ClusterClassifier] OPENAI_API_KEY not set — using fallback');
    return fallbackClassify(opp);
  }

  // Build user content
  const truncatedDescription = opp.description.substring(0, 1500);
  const userContent = [
    `Titolo: ${opp.title}`,
    `Tipo: ${opp.type}`,
    opp.tags && opp.tags.length > 0 ? `Tag: ${opp.tags.join(', ')}` : null,
    opp.eligibleFields && opp.eligibleFields.length > 0 ? `Campi idonei: ${opp.eligibleFields.join(', ')}` : null,
    `Descrizione:\n${truncatedDescription}`,
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
      max_tokens: 200,
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      logger.warn('[ClusterClassifier] Empty response from API — using fallback');
      return fallbackClassify(opp);
    }

    const parsed = JSON.parse(raw) as Partial<ClusterClassification>;

    // Validate and normalize scores
    const scores: Record<Cluster, number> = {
      Analista: 0,
      Creativo: 0,
      Leader: 0,
      Imprenditore: 0,
      Sociale: 0,
      Explorer: 0,
    };

    if (parsed.scores && typeof parsed.scores === 'object') {
      for (const cluster of CLUSTERS) {
        const val = (parsed.scores as Record<string, any>)[cluster];
        scores[cluster] = typeof val === 'number' ? Math.max(0, Math.min(1, val)) : 0;
      }
    }

    // Compute primary server-side (ignore model's choice)
    const primary = (Object.entries(scores).reduce((a, b) =>
      a[1] > b[1] ? a : b,
    )[0] as Cluster) || 'Analista';

    return { scores, primary };
  } catch (err) {
    logger.warn(`[ClusterClassifier] Failed to classify opportunity "${opp.title}": ${err}`);
    return fallbackClassify(opp);
  }
}
