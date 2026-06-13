import type { Diagram } from '../core/diagram/diagramTypes';

export const architectureDiagram: Diagram = {
  id: 'service-architecture',
  title: '语音绘图服务架构',
  diagramType: 'architecture',
  nodes: [
    { id: 'user', label: '语音用户', type: 'user' },
    { id: 'browser', label: 'VoiceFlow Web', type: 'external' },
    { id: 'asr', label: 'ASR 服务', type: 'service' },
    { id: 'router', label: 'Command Router', type: 'service' },
    { id: 'diagram-core', label: 'Diagram Core', type: 'service' },
    { id: 'storage', label: '图形存储', type: 'database' },
  ],
  edges: [
    { id: 'a1', from: 'user', to: 'browser', label: '语音' },
    { id: 'a2', from: 'browser', to: 'asr', label: '音频' },
    { id: 'a3', from: 'asr', to: 'router', label: '文本' },
    { id: 'a4', from: 'router', to: 'diagram-core', label: '指令' },
    { id: 'a5', from: 'diagram-core', to: 'storage', label: 'Diagram JSON' },
  ],
  groups: [],
  layout: {
    direction: 'left_to_right',
    spacingX: 90,
    spacingY: 70,
    autoLayout: true,
  },
  theme: { name: 'tech_dark' },
  metadata: {
    createdAt: '2026-06-12T09:00:00.000Z',
    updatedAt: '2026-06-12T09:00:00.000Z',
    version: 1,
  },
};
