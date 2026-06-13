import type { DiagramType, NodeType } from '../../core/diagram/diagramTypes';
import { normalizeAgentResult } from './agentNormalizer';
import type { AgentPlanResult } from './agentTypes';

type BlueprintNode = { id: string; label: string; type: NodeType };
type BlueprintEdge = { from: string; to: string; label?: string };

const TYPE_PATTERNS: Array<[DiagramType, RegExp]> = [
  ['usecase', /用例图/],
  ['organization', /组织结构图|组织架构图/],
  ['mindmap', /思维导图|脑图|知识图谱/],
  ['dataflow', /数据流图/],
  ['architecture', /系统架构图|架构图|系统架构|服务架构|技术架构/],
  ['framework', /框架图|结构图/],
  ['table', /表格|对比表/],
  ['flowchart', /流程图|流程|步骤图|学习路径|学习计划/],
];

export function planLocalStructuralDiagram(command: string): AgentPlanResult {
  const diagramType = detectDiagramType(command);
  const topic = extractTopic(command, diagramType);
  const explicitItems = extractExplicitItems(command);
  const blueprint = createBlueprint(diagramType, topic, explicitItems);
  return normalizeAgentResult({
    kind: 'diagram',
    title: `${topic}${typeLabel(diagramType)}`,
    diagramType,
    direction:
      diagramType === 'organization' || diagramType === 'flowchart'
        ? 'top_down'
        : 'left_to_right',
    ...blueprint,
    summary: `已按语音生成${topic}${typeLabel(diagramType)}`,
    explanation: '本地结构规划器根据图表类型与语音主题生成。',
  });
}

export function detectDiagramType(command: string): DiagramType {
  return TYPE_PATTERNS.find(([, pattern]) => pattern.test(command))?.[0] ?? 'generic';
}

function createBlueprint(
  type: DiagramType,
  topic: string,
  explicitItems: string[],
): { nodes: BlueprintNode[]; edges: BlueprintEdge[] } {
  if (explicitItems.length >= 2) {
    const nodes = explicitItems.map((label, index) => ({
      id: `item_${index + 1}`,
      label,
      type: inferNodeType(label, type),
    }));
    return {
      nodes,
      edges: nodes.slice(1).map((node, index) => ({
        from: nodes[index].id,
        to: node.id,
      })),
    };
  }

  switch (type) {
    case 'usecase':
      return blueprint(
        [
          ['actor_student', '学生', 'user'],
          ['browse', '浏览课程', 'process'],
          ['select', '选择课程', 'process'],
          ['drop', '退选课程', 'process'],
          ['schedule', '查看课表', 'process'],
          ['actor_admin', '教务管理员', 'user'],
          ['manage', '管理课程', 'process'],
        ],
        [
          ['actor_student', 'browse'],
          ['actor_student', 'select'],
          ['actor_student', 'drop'],
          ['actor_student', 'schedule'],
          ['actor_admin', 'manage'],
        ],
      );
    case 'organization':
      return blueprint(
        [
          ['board', '董事会', 'group'],
          ['manager', '总经理', 'user'],
          ['product', '产品部门', 'group'],
          ['technology', '技术部门', 'group'],
          ['market', '市场部门', 'group'],
          ['operation', '运营部门', 'group'],
        ],
        [
          ['board', 'manager'],
          ['manager', 'product'],
          ['manager', 'technology'],
          ['manager', 'market'],
          ['manager', 'operation'],
        ],
      );
    case 'architecture':
    case 'framework':
      return blueprint(
        [
          ['client', `${topic}用户端`, 'user'],
          ['gateway', 'API 网关', 'service'],
          ['service', `${topic}核心服务`, 'service'],
          ['database', '数据库', 'database'],
          ['external', '外部系统', 'external'],
        ],
        [
          ['client', 'gateway'],
          ['gateway', 'service'],
          ['service', 'database'],
          ['service', 'external'],
        ],
      );
    case 'table':
      return blueprint(
        [
          ['header', `${topic}对比维度`, 'group'],
          ['option_a', '方案 A', 'process'],
          ['option_b', '方案 B', 'process'],
          ['result', '对比结论', 'group'],
        ],
        [
          ['header', 'option_a'],
          ['header', 'option_b'],
          ['option_a', 'result'],
          ['option_b', 'result'],
        ],
      );
    case 'mindmap':
    case 'generic':
      return blueprint(
        [
          ['center', topic, 'group'],
          ['concept', '核心概念', 'process'],
          ['method', '方法与工具', 'process'],
          ['practice', '实践应用', 'process'],
          ['review', '总结复盘', 'process'],
        ],
        [
          ['center', 'concept'],
          ['center', 'method'],
          ['center', 'practice'],
          ['center', 'review'],
        ],
      );
    case 'dataflow':
      return blueprint(
        [
          ['source', '数据来源', 'external'],
          ['collect', '数据采集', 'process'],
          ['process', '数据处理', 'service'],
          ['store', '数据存储', 'database'],
          ['output', '数据输出', 'external'],
        ],
        [
          ['source', 'collect'],
          ['collect', 'process'],
          ['process', 'store'],
          ['store', 'output'],
        ],
      );
    case 'flowchart':
      return blueprint(
        [
          ['start', '开始', 'start'],
          ['understand', `了解${topic}`, 'process'],
          ['learn', `学习${topic}基础`, 'process'],
          ['practice', `${topic}实践`, 'process'],
          ['review', '总结复盘', 'process'],
          ['end', '完成', 'end'],
        ],
        [
          ['start', 'understand'],
          ['understand', 'learn'],
          ['learn', 'practice'],
          ['practice', 'review'],
          ['review', 'end'],
        ],
      );
  }
}

function blueprint(
  nodes: Array<[string, string, NodeType]>,
  edges: Array<[string, string, string?]>,
) {
  return {
    nodes: nodes.map(([id, label, type]) => ({ id, label, type })),
    edges: edges.map(([from, to, label]) => ({ from, to, label })),
  };
}

function extractTopic(command: string, type: DiagramType): string {
  const cleaned = command
    .replace(
      /请|帮我|给我|画一个|画一张|生成一个|生成一张|创建一个|创建一张|绘制一个|绘制一张/g,
      '',
    )
    .replace(/包含.+?(?:的|，|。|$)/g, '')
    .replace(
      /流程图|组织结构图|组织架构图|用例图|思维导图|脑图|数据流图|系统架构图|架构图|框架图|结构图|对比表格|表格/g,
      '',
    )
    .replace(/[，。！？,.!?]/g, '')
    .replace(/的$/, '')
    .trim();
  return cleaned || defaultTopic(type);
}

function extractExplicitItems(command: string): string[] {
  const match = command.match(/包含(.+?)(?:的|，|。|$)/);
  if (!match) return [];
  return match[1]
    .split(/、|，|,|和|以及/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function inferNodeType(label: string, type: DiagramType): NodeType {
  if (/数据库|存储|仓库/.test(label)) return 'database';
  if (/用户|学生|客户|管理员|员工/.test(label)) return 'user';
  if (/服务|网关|接口|API/.test(label)) return 'service';
  if (/外部|第三方/.test(label)) return 'external';
  if (type === 'organization' || type === 'table') return 'group';
  return 'process';
}

function defaultTopic(type: DiagramType): string {
  return type === 'organization' ? '公司' : type === 'table' ? '方案' : '主题';
}

function typeLabel(type: DiagramType): string {
  const labels: Record<DiagramType, string> = {
    flowchart: '流程图',
    architecture: '架构图',
    organization: '组织结构图',
    dataflow: '数据流图',
    usecase: '用例图',
    mindmap: '思维导图',
    framework: '框架图',
    table: '表格',
    generic: '结构图',
  };
  return labels[type];
}
