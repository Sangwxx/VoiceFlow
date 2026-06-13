import { create } from 'zustand';

import type { Diagram } from '../core/diagram/diagramTypes';
import { cloneDiagram } from '../core/diagram/diagramUtils';
import type { DiagramOperation } from '../core/operations/operationTypes';
import { useDiagramStore } from './diagramStore';
import { useVersionStore } from './versionStore';

export type ProposalSource = 'agent' | 'report_mode' | 'version_restore' | 'demo_scene';

export type DiagramProposal = {
  id: string;
  source: ProposalSource;
  diagram: Diagram;
  title: string;
  summary: string;
  createdAt: string;
  sourceVersionId?: string;
  operations?: DiagramOperation[];
};

export type ProposalStore = {
  proposal: DiagramProposal | null;
  setProposal: (proposal: DiagramProposal) => void;
  confirm: () => boolean;
  cancel: () => void;
};

const SNAPSHOT_NAMES: Partial<Record<ProposalSource, string>> = {
  report_mode: '汇报美化前',
  version_restore: '版本恢复前',
  demo_scene: '载入演示场景前',
};

export const useProposalStore = create<ProposalStore>((set, get) => ({
  proposal: null,
  setProposal: (proposal) =>
    set({ proposal: { ...proposal, diagram: cloneDiagram(proposal.diagram) } }),
  confirm: () => {
    const proposal = get().proposal;
    if (!proposal) return false;
    const current = useDiagramStore.getState().diagram;
    const snapshotName = SNAPSHOT_NAMES[proposal.source];
    if (snapshotName) {
      useVersionStore
        .getState()
        .saveVersion(snapshotName, 'automatic', proposal.source, current);
    }
    if (proposal.operations?.length) {
      useDiagramStore.getState().applyOperations(proposal.operations, proposal.title);
    } else {
      useDiagramStore.getState().replaceDiagram(proposal.diagram, proposal.title);
    }
    set({ proposal: null });
    return true;
  },
  cancel: () => set({ proposal: null }),
}));

export function createDiagramProposal(
  source: ProposalSource,
  diagram: Diagram,
  title: string,
  summary: string,
  sourceVersionId?: string,
  operations?: DiagramOperation[],
): DiagramProposal {
  const createdAt = new Date().toISOString();
  return {
    id: `proposal-${createdAt}-${Math.random().toString(36).slice(2, 7)}`,
    source,
    diagram,
    title,
    summary,
    createdAt,
    sourceVersionId,
    operations,
  };
}
