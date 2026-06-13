import { create } from 'zustand';

import type { Diagram } from '../core/diagram/diagramTypes';
import { cloneDiagram } from '../core/diagram/diagramUtils';
import { validateDiagram } from '../core/diagram/diagramValidators';

export type DiagramVersion = {
  id: string;
  name: string;
  kind: 'manual' | 'auto';
  sourceAction: string;
  createdAt: string;
  diagram: Diagram;
};

export type VersionDiff = {
  addedNodes: number;
  removedNodes: number;
  changedNodes: number;
  addedEdges: number;
  removedEdges: number;
  themeChanged: boolean;
  layoutChanged: boolean;
};

const STORAGE_KEY = 'voiceflow-diagram-versions-v1';
const MAX_VERSIONS = 50;
const STORAGE_ERROR_MESSAGE = '浏览器版本存储不可用，当前版本仅在本次会话中保留';

type VersionStorageResult = {
  versions: DiagramVersion[];
  error: string | null;
};

function isDiagramVersion(item: unknown): item is DiagramVersion {
  if (!item || typeof item !== 'object') return false;
  const version = item as Partial<DiagramVersion>;
  return Boolean(
    typeof version.id === 'string' &&
    version.id &&
    typeof version.name === 'string' &&
    version.name.trim() &&
    (version.kind === 'manual' || version.kind === 'auto') &&
    typeof version.sourceAction === 'string' &&
    typeof version.createdAt === 'string' &&
    version.diagram &&
    validateDiagram(version.diagram).success,
  );
}

function loadVersions(): VersionStorageResult {
  if (typeof localStorage === 'undefined') return { versions: [], error: null };
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return { versions: [], error: null };
    return { versions: parsed.filter(isDiagramVersion), error: null };
  } catch {
    return { versions: [], error: STORAGE_ERROR_MESSAGE };
  }
}

function persist(versions: DiagramVersion[]): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
    return null;
  } catch {
    return STORAGE_ERROR_MESSAGE;
  }
}

function trimVersions(versions: DiagramVersion[]): DiagramVersion[] {
  return versions.slice(0, MAX_VERSIONS);
}

export type VersionStoreState = {
  versions: DiagramVersion[];
  lastDiff: VersionDiff | null;
  persistenceError: string | null;
  saveVersion: (
    name: string,
    kind: DiagramVersion['kind'],
    sourceAction: string,
    diagram: Diagram,
  ) => DiagramVersion;
  findVersions: (name: string) => DiagramVersion[];
  compare: (left: Diagram, right: Diagram) => VersionDiff;
  reload: () => void;
  clear: () => void;
};

const initialStorage = loadVersions();

export const useVersionStore = create<VersionStoreState>((set, get) => ({
  versions: initialStorage.versions,
  lastDiff: null,
  persistenceError: initialStorage.error,
  saveVersion: (name, kind, sourceAction, diagram) => {
    const createdAt = new Date().toISOString();
    const version: DiagramVersion = {
      id: `version-${createdAt}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || `版本 ${createdAt}`,
      kind,
      sourceAction,
      createdAt,
      diagram: cloneDiagram(diagram),
    };
    const versions = trimVersions([version, ...get().versions]);
    const persistenceError = persist(versions);
    set({ versions, persistenceError });
    return version;
  },
  findVersions: (name) => {
    const normalized = name.trim().toLowerCase();
    return get().versions.filter((version) =>
      version.name.toLowerCase().includes(normalized),
    );
  },
  compare: (left, right) => {
    const leftNodes = new Map(left.nodes.map((node) => [node.id, node]));
    const rightNodes = new Map(right.nodes.map((node) => [node.id, node]));
    const leftEdges = new Set(left.edges.map((edge) => edge.id));
    const rightEdges = new Set(right.edges.map((edge) => edge.id));
    const diff: VersionDiff = {
      addedNodes: right.nodes.filter((node) => !leftNodes.has(node.id)).length,
      removedNodes: left.nodes.filter((node) => !rightNodes.has(node.id)).length,
      changedNodes: right.nodes.filter(
        (node) =>
          leftNodes.has(node.id) &&
          JSON.stringify(leftNodes.get(node.id)) !== JSON.stringify(node),
      ).length,
      addedEdges: right.edges.filter((edge) => !leftEdges.has(edge.id)).length,
      removedEdges: left.edges.filter((edge) => !rightEdges.has(edge.id)).length,
      themeChanged: left.theme.name !== right.theme.name,
      layoutChanged: left.layout.direction !== right.layout.direction,
    };
    set({ lastDiff: diff });
    return diff;
  },
  reload: () => {
    const result = loadVersions();
    set({ versions: result.versions, persistenceError: result.error });
  },
  clear: () => {
    let persistenceError: string | null = null;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        persistenceError = STORAGE_ERROR_MESSAGE;
      }
    }
    set({ versions: [], lastDiff: null, persistenceError });
  },
}));
