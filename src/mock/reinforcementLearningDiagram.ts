import type { Diagram } from '../core/diagram/diagramTypes';

export const reinforcementLearningDiagram: Diagram = {
  id: 'reinforcement-learning-path',
  title: '强化学习学习流程',
  diagramType: 'flowchart',
  nodes: [
    { id: 'start', label: '开始学习', type: 'start' },
    { id: 'foundation', label: '掌握概率与机器学习基础', type: 'process' },
    { id: 'mdp', label: '理解马尔可夫决策过程', type: 'process' },
    { id: 'value', label: '学习价值函数与贝尔曼方程', type: 'process' },
    { id: 'tabular', label: '实现 Q-Learning 与 SARSA', type: 'process' },
    { id: 'evaluate', label: '评估训练效果', type: 'decision' },
    { id: 'deep', label: '学习 DQN 与策略梯度', type: 'process' },
    { id: 'project', label: '完成强化学习项目', type: 'process' },
    { id: 'end', label: '形成知识体系', type: 'end' },
  ],
  edges: [
    { id: 'rl1', from: 'start', to: 'foundation' },
    { id: 'rl2', from: 'foundation', to: 'mdp' },
    { id: 'rl3', from: 'mdp', to: 'value' },
    { id: 'rl4', from: 'value', to: 'tabular' },
    { id: 'rl5', from: 'tabular', to: 'evaluate' },
    { id: 'rl6', from: 'evaluate', to: 'deep', label: '通过', type: 'highlight' },
    { id: 'rl7', from: 'evaluate', to: 'tabular', label: '未通过', type: 'weak' },
    { id: 'rl8', from: 'deep', to: 'project' },
    { id: 'rl9', from: 'project', to: 'end' },
  ],
  groups: [],
  layout: { direction: 'top_down', spacingX: 90, spacingY: 85, autoLayout: true },
  theme: { name: 'business_blue' },
  metadata: {
    createdAt: '2026-06-12T13:00:00.000Z',
    updatedAt: '2026-06-12T13:00:00.000Z',
    version: 1,
  },
};
