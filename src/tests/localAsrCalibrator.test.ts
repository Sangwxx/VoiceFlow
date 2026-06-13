import { describe, expect, it } from 'vitest';

import {
  buildDynamicLexicon,
  calibrateAsrTranscript,
  editDistance,
  similarity,
} from '../voice/localAsrCalibrator';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';
import { getBuiltInLexiconStats } from '../voice/asrLexicon';

describe('localAsrCalibrator', () => {
  it('applies domain error mappings and command alias normalization locally', () => {
    expect(
      calibrateAsrTranscript('声成一张强化学西的流成图', {
        diagram: loginFlowDiagram,
      }),
    ).toMatchObject({
      correctedText: '生成一张强化学习的流程图',
      changed: true,
    });
    expect(
      calibrateAsrTranscript('横向布橘', { diagram: loginFlowDiagram }),
    ).toMatchObject({
      correctedText: '横向布局',
      changed: true,
    });
  });

  it('uses phonetic similarity and edit distance for domain terms', () => {
    expect(
      calibrateAsrTranscript('请重新排板', { diagram: loginFlowDiagram }).correctedText,
    ).toBe('请自动排版');
    expect(editDistance('横向布橘', '横向布局')).toBe(1);
  });

  it.each([
    ['请从左到右', '请横向布局'],
    ['重新排版', '自动排版'],
    ['回到上一步', '撤销'],
  ])('normalizes command aliases locally: %s', (input, expected) => {
    expect(calibrateAsrTranscript(input, { diagram: loginFlowDiagram })).toMatchObject({
      correctedText: expected,
      changed: true,
      confidence: 0.96,
      reason: '命令别名归一化',
    });
  });

  it('does not normalize ambiguous diagram vocabulary as a command alias', () => {
    expect(
      calibrateAsrTranscript('用户开始登录流程', { diagram: loginFlowDiagram }),
    ).toMatchObject({
      correctedText: '用户开始登录流程',
      changed: false,
    });
  });

  it('uses current canvas node labels as a correction dictionary', () => {
    expect(
      calibrateAsrTranscript('删除进入登路页', { diagram: loginFlowDiagram })
        .correctedText,
    ).toBe('删除进入登录页');
  });

  it('leaves unrelated speech unchanged', () => {
    expect(
      calibrateAsrTranscript('今天天气怎么样', { diagram: loginFlowDiagram }),
    ).toMatchObject({
      correctedText: '今天天气怎么样',
      changed: false,
    });
  });

  it('ships a reusable baseline lexicon and expands it from live context', () => {
    const stats = getBuiltInLexiconStats();
    expect(stats).toEqual({
      canonicalTerms: 99,
      aliases: 49,
      errorMappings: 18,
      phoneticGroups: 71,
    });
    expect(
      buildDynamicLexicon({
        diagram: loginFlowDiagram,
        recentCommands: ['把风控复核节点改成蓝色'],
      }).some((entry) => entry.term === '把风控复核节点改成蓝色'),
    ).toBe(true);
  });

  it('uses candidate competition to avoid aggressive unrelated replacements', () => {
    expect(
      calibrateAsrTranscript('用户今天准备去上海开会', {
        diagram: loginFlowDiagram,
      }).correctedText,
    ).toBe('用户今天准备去上海开会');
    expect(similarity('横向布橘', '横向布局')).toBeGreaterThan(0.85);
  });

  it('learns project vocabulary from recent commands without AI', () => {
    const diagram = structuredClone(loginFlowDiagram);
    diagram.nodes.push({ id: 'risk-review', label: '风控复核', type: 'process' });
    expect(calibrateAsrTranscript('删除风控复合', { diagram }).correctedText).toBe(
      '删除风控复核',
    );
  });

  it.each([
    ['删除风控复合', '删除风控复核'],
    ['连接提交申请到人工省核', '连接提交申请到人工审核'],
    ['把验正码改成蓝色', '把验证码改成蓝色'],
  ])(
    'generalizes full-pinyin correction from canvas vocabulary: %s',
    (input, expected) => {
      const diagram = structuredClone(loginFlowDiagram);
      diagram.nodes.push(
        { id: 'risk-review', label: '风控复核', type: 'process' },
        { id: 'manual-review', label: '人工审核', type: 'process' },
        { id: 'verification-code', label: '验证码', type: 'process' },
      );
      expect(calibrateAsrTranscript(input, { diagram }).correctedText).toBe(expected);
    },
  );
});
