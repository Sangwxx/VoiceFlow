import { describe, expect, it } from 'vitest';

import { VoiceTaskSegmenter, splitByBoundaries } from '../voice/voiceTaskSegmenter';

describe('VoiceTaskSegmenter', () => {
  it('splits multiple tasks in spoken order', () => {
    expect(splitByBoundaries('横向布局，然后放大，最后看全图')).toEqual({
      complete: ['横向布局', '放大'],
      remainder: '看全图',
    });
  });

  it('emits only complete low-risk interim tasks immediately', () => {
    const tasks = new VoiceTaskSegmenter().ingestInterim(
      '横向布局，然后继续说后面的需求',
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      text: '横向布局',
      readiness: 'immediate',
      source: 'interim',
    });
  });

  it('marks complex tasks for execution after recording ends', () => {
    const tasks = new VoiceTaskSegmenter().ingestFinal(
      '加一个节点叫人工审核，然后横向布局',
    );
    expect(tasks.map((task) => [task.text, task.readiness])).toEqual([
      ['加一个节点叫人工审核', 'after_recording'],
      ['横向布局', 'immediate'],
    ]);
  });

  it('does not emit an interim task again when it becomes final', () => {
    const segmenter = new VoiceTaskSegmenter();
    expect(segmenter.ingestInterim('横向布局，然后')).toHaveLength(1);
    expect(
      segmenter.ingestFinal('横向布局，然后纵向布局').map((task) => task.text),
    ).toEqual(['纵向布局']);
  });

  it('marks only an unfinished final remainder as accepting continuation', () => {
    const segmenter = new VoiceTaskSegmenter();

    expect(segmenter.ingestFinal('加一个节点叫审核然后')).toEqual([
      expect.objectContaining({
        text: '加一个节点叫审核',
        acceptsFinalContinuation: false,
      }),
    ]);
    expect(segmenter.ingestFinal('加一个节点叫归档')).toEqual([
      expect.objectContaining({
        text: '加一个节点叫归档',
        acceptsFinalContinuation: true,
      }),
    ]);
  });

  it('keeps shape placement clauses inside one composite drawing task', () => {
    expect(splitByBoundaries('画一个正方形，放左边，圆形，放右边')).toEqual({
      complete: [],
      remainder: '画一个正方形，放左边，圆形，放右边',
    });
  });

  it('still splits comma-separated independent commands', () => {
    expect(splitByBoundaries('撤销，保存当前版本')).toEqual({
      complete: ['撤销'],
      remainder: '保存当前版本',
    });
  });

  it('keeps clauses joined by 并且 inside one composite task', () => {
    expect(splitByBoundaries('画一个圆形并且放到左边')).toEqual({
      complete: [],
      remainder: '画一个圆形并且放到左边',
    });
  });
});
