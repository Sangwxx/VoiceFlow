import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createReportDiagram } from '../core/theme/reportMode';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';
import { createDiagramProposal, useProposalStore } from '../stores/proposalStore';
import { useDiagramStore } from '../stores/diagramStore';
import { useVersionStore } from '../stores/versionStore';

describe('proposal and persistent versions', () => {
  beforeEach(() => {
    useDiagramStore.getState().reset();
    useProposalStore.getState().cancel();
    useVersionStore.getState().clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not mutate before confirmation and saves an automatic snapshot', () => {
    const original = structuredClone(useDiagramStore.getState().diagram);
    useProposalStore
      .getState()
      .setProposal(
        createDiagramProposal(
          'report_mode',
          createReportDiagram(original),
          '确认汇报美化',
          '预览',
        ),
      );
    expect(useDiagramStore.getState().diagram).toEqual(original);
    expect(useVersionStore.getState().versions).toHaveLength(0);
    expect(useProposalStore.getState().confirm()).toBe(true);
    expect(useDiagramStore.getState().diagram.theme.name).toBe('report_clean');
    expect(useVersionStore.getState().versions[0]).toMatchObject({
      name: '汇报美化前',
      kind: 'automatic',
    });
  });

  it('persists, reloads, finds and compares named versions', () => {
    useVersionStore
      .getState()
      .saveVersion('初始流程', 'manual', 'test', loginFlowDiagram);
    useVersionStore.setState({ versions: [] });
    useVersionStore.getState().reload();
    expect(useVersionStore.getState().findVersions('初始')).toHaveLength(1);
    const changed = structuredClone(loginFlowDiagram);
    changed.nodes.push({ id: 'extra', label: '额外节点', type: 'process' });
    expect(useVersionStore.getState().compare(loginFlowDiagram, changed).addedNodes).toBe(
      1,
    );
  });

  it('cancels a proposal without changing diagram or versions', () => {
    const original = structuredClone(useDiagramStore.getState().diagram);
    useProposalStore
      .getState()
      .setProposal(createDiagramProposal('demo_scene', loginFlowDiagram, '场景', '预览'));
    useProposalStore.getState().cancel();
    expect(useProposalStore.getState().proposal).toBeNull();
    expect(useDiagramStore.getState().diagram).toEqual(original);
    expect(useVersionStore.getState().versions).toHaveLength(0);
  });

  it('filters malformed persisted version metadata during reload', () => {
    localStorage.setItem(
      'voiceflow-diagram-versions-v1',
      JSON.stringify([
        {
          id: 'valid',
          name: '有效版本',
          kind: 'manual',
          sourceAction: 'test',
          createdAt: new Date().toISOString(),
          diagram: loginFlowDiagram,
        },
        {
          id: 'invalid',
          kind: 'manual',
          sourceAction: 'test',
          createdAt: new Date().toISOString(),
          diagram: loginFlowDiagram,
        },
      ]),
    );

    useVersionStore.getState().reload();

    expect(useVersionStore.getState().versions).toHaveLength(1);
    expect(useVersionStore.getState().findVersions('有效')).toHaveLength(1);
    expect(useVersionStore.getState().persistenceError).toBeNull();
  });

  it('keeps a saved version in memory when browser persistence fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    });

    expect(() =>
      useVersionStore
        .getState()
        .saveVersion('会话版本', 'manual', 'test', loginFlowDiagram),
    ).not.toThrow();

    expect(useVersionStore.getState().versions[0]?.name).toBe('会话版本');
    expect(useVersionStore.getState().persistenceError).toContain('仅在本次会话中保留');
  });
});
