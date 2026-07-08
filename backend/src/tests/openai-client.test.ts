import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    llmUsageLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

import { trackedCompletion, estimateCostUsd } from '../services/ai/openai-client';
import prisma from '../lib/prisma';

const mockedCreate = vi.mocked(prisma.llmUsageLog.create);

function fakeClient(response: any) {
  return { chat: { completions: { create: vi.fn().mockResolvedValue(response) } } } as any;
}

describe('trackedCompletion', () => {
  beforeEach(() => {
    mockedCreate.mockReset().mockResolvedValue({} as any);
  });

  it('logs prompt/completion/total tokens from the response usage field', async () => {
    const client = fakeClient({
      choices: [{ message: { content: '{}' } }],
      usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 },
    });

    const response = await trackedCompletion(client, { model: 'gpt-4o-mini', messages: [] } as any, {
      source: 'msca', purpose: 'extraction',
    });

    expect(response.usage?.total_tokens).toBe(160);
    expect(mockedCreate).toHaveBeenCalledWith({
      data: {
        source: 'msca', purpose: 'extraction', model: 'gpt-4o-mini',
        promptTokens: 120, completionTokens: 40, totalTokens: 160,
      },
    });
  });

  it('does not log when the response has no usage field', async () => {
    const client = fakeClient({ choices: [{ message: { content: '{}' } }] });

    await trackedCompletion(client, { model: 'gpt-4o-mini', messages: [] } as any, { source: 'msca', purpose: 'extraction' });

    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('propagates errors from the underlying call and does not log', async () => {
    const client = { chat: { completions: { create: vi.fn().mockRejectedValue(new Error('rate limited')) } } } as any;

    await expect(trackedCompletion(client, { model: 'gpt-4o-mini', messages: [] } as any, { source: 'msca', purpose: 'extraction' }))
      .rejects.toThrow('rate limited');
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('does not throw when logging itself fails (fire-and-forget)', async () => {
    mockedCreate.mockRejectedValue(new Error('db down'));
    const client = fakeClient({
      choices: [{ message: { content: '{}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const response = await trackedCompletion(client, { model: 'gpt-4o-mini', messages: [] } as any, { source: 'msca', purpose: 'extraction' });
    expect(response.usage?.total_tokens).toBe(15);
  });
});

describe('estimateCostUsd', () => {
  it('computes cost for a known model', () => {
    const cost = estimateCostUsd('gpt-4o-mini', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.15 + 0.60, 5);
  });

  it('returns null for an unknown model rather than guessing a price', () => {
    expect(estimateCostUsd('some-future-model', 1000, 1000)).toBeNull();
  });
});
