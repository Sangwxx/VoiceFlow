import { describe, expect, it } from 'vitest';

import { buildAgentPrompt } from '../commands/agent/agentPrompt';

describe('agentPrompt', () => {
  it('requires autonomous completion for complete creation intents', () => {
    const prompt = buildAgentPrompt({
      intent: 'create_diagram',
      originalCommand: '画一个流程图',
      conversation: [],
    });

    expect(prompt).toContain('就视为信息充足');
    expect(prompt).toContain('绝对不得返回 clarification');
  });
});
