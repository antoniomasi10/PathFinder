/**
 * Shared OpenAI client — consolidates what used to be three near-identical
 * lazy-singleton getClient() implementations (opportunityParser.ts,
 * clusterClassifier.ts, company-watchlist.import.ts). Single point where
 * usage tracking (trackedCompletion, Fase 4 hardening) can be attached
 * without touching every call site's client-creation logic.
 */
import OpenAI from 'openai';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';

let _client: OpenAI | null = null;

export function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export interface CompletionContext {
  /** e.g. "opportunity-enrichment", "msca", "harvest-extraction" */
  source: string;
  /** e.g. "content-parse", "cluster-classify", "skill-extract" */
  purpose: string;
}

/**
 * $/1M tokens for models we call. Prices only — never baked into stored rows
 * (see LlmUsageLog doc comment in schema.prisma), so repricing means updating
 * one constant here, not backfilling historical data.
 */
export const OPENAI_PRICING: Record<string, { promptPer1M: number; completionPer1M: number }> = {
  'gpt-4o-mini': { promptPer1M: 0.15, completionPer1M: 0.60 },
};

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number | null {
  const pricing = OPENAI_PRICING[model];
  if (!pricing) return null;
  return (promptTokens / 1_000_000) * pricing.promptPer1M + (completionTokens / 1_000_000) * pricing.completionPer1M;
}

/**
 * Drop-in wrapper around client.chat.completions.create that logs token usage
 * to LlmUsageLog. Errors from the underlying call propagate unchanged — every
 * call site already has its own error handling; this only adds logging on
 * success, fire-and-forget (a logging failure must never break the actual
 * LLM call this wraps).
 */
export async function trackedCompletion(
  client: OpenAI,
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  ctx: CompletionContext,
): Promise<OpenAI.Chat.ChatCompletion> {
  const response = await client.chat.completions.create(params);
  const usage = response.usage;
  if (usage) {
    prisma.llmUsageLog.create({
      data: {
        source: ctx.source,
        purpose: ctx.purpose,
        model: params.model,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
    }).catch(err => logger.warn(`[LlmUsage] log failed: ${err}`));
  }
  return response;
}
