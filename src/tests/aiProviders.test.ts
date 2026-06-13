import { describe, expect, it, vi } from 'vitest';

import {
  createConfiguredAiProvider,
  OpenAiCompatibleProvider,
  UnconfiguredAiProvider,
} from '../commands/agent/aiProviders';

describe('AI providers', () => {
  it('returns an explicit unconfigured provider instead of falling back', async () => {
    const provider = createConfiguredAiProvider({
      baseUrl: '',
      apiKey: '',
      model: '',
    });
    expect(provider).toBeInstanceOf(UnconfiguredAiProvider);
    await expect(
      provider.complete({
        intent: 'create_diagram',
        originalCommand: '画流程图',
        conversation: [],
      }),
    ).rejects.toThrow('真实 AI 尚未配置');
  });

  it('creates a real provider only when all configuration exists', () => {
    expect(
      createConfiguredAiProvider({
        baseUrl: 'https://example.test/v1',
        apiKey: 'secret',
        model: 'real-model',
      }),
    ).toBeInstanceOf(OpenAiCompatibleProvider);
  });

  it('sends an OpenAI-compatible request and surfaces HTTP errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"kind":"clarification","question":"补充"}' } }],
      }),
    });
    const provider = new OpenAiCompatibleProvider({
      baseUrl: 'https://example.test/v1/',
      apiKey: 'secret',
      model: 'demo',
      fetchImpl,
    });
    await provider.complete({
      intent: 'create_diagram',
      originalCommand: '画流程图',
      conversation: [],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    const request = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).not.toHaveProperty('temperature');

    const failing = new OpenAiCompatibleProvider({
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret',
      model: 'demo',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'invalid model parameter' } }),
      }),
    });
    await expect(
      failing.complete({
        intent: 'create_diagram',
        originalCommand: '画流程图',
        conversation: [],
      }),
    ).rejects.toThrow('HTTP 400 - invalid model parameter');
  });

  it('enables JSON mode for Moonshot without imposing it on other providers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{}' } }] }),
    });
    const provider = new OpenAiCompatibleProvider({
      baseUrl: 'https://api.moonshot.cn/v1',
      apiKey: 'secret',
      model: 'moonshot-v1-auto',
      fetchImpl,
    });
    await provider.complete({
      intent: 'create_diagram',
      originalCommand: '画一个学习流程',
      conversation: [],
    });
    const request = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
    });
  });
});
