import { describe, expect, it } from 'vitest';

import { matchGenericDrawingActions } from '../commands/simple/genericDrawingMatcher';

describe('matchGenericDrawingActions', () => {
  it('extracts multiple shapes from one natural command in spoken order', () => {
    const actions = matchGenericDrawingActions('画一个正方形和三角形');

    expect(actions).toHaveLength(2);
    expect(actions.map((action) => ('label' in action ? action.label : ''))).toEqual([
      '正方形',
      '三角形',
    ]);
  });

  it('supports quantities, classifiers and colors without AI', () => {
    const actions = matchGenericDrawingActions('画两颗红色圆形和一个蓝色三角形');

    expect(actions).toHaveLength(3);
    expect(actions[0]).toMatchObject({
      intent: 'create_node',
      label: '圆形',
      style: { border: '#ef4444' },
    });
    expect(actions[2]).toMatchObject({
      intent: 'create_node',
      label: '三角形',
      style: {
        border: '#3b82f6',
        clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
      },
    });
  });

  it('caps excessive quantities to keep local execution stable', () => {
    expect(matchGenericDrawingActions('画100个正方形')).toHaveLength(20);
  });
});
