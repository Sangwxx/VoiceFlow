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
    expect(prompt).toContain('缺少普通细节时主动补全');
    expect(prompt).toContain('关键歧义时，才允许返回 clarification');
  });

  it('uses a dedicated constrained SVG prompt for free drawing', () => {
    const prompt = buildAgentPrompt({
      intent: 'free_drawing',
      originalCommand: '画一只小猫',
      conversation: [],
    });

    expect(prompt).toContain('自由画布 SVG 图元规划器');
    expect(prompt).toContain('允许的图元 type 只有 circle、ellipse、rect、line、path');
    expect(prompt).toContain('画一只小猫');
    expect(prompt).not.toContain('专业图表架构师');
  });
});
