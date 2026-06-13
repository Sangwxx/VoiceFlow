import type { NodeType } from '../../core/diagram/diagramTypes';
import { normalizeText } from '../../utils/text';
import type { SimpleOperationDraft, SimpleParseResult } from './simpleTypes';

const NODE_TYPE_RULES: Array<[string, NodeType]> = [
  ['开始', 'start'],
  ['起点', 'start'],
  ['结束', 'end'],
  ['终点', 'end'],
  ['判断', 'decision'],
  ['数据库', 'database'],
  ['服务', 'service'],
  ['用户', 'user'],
  ['外部系统', 'external'],
  ['外部', 'external'],
  ['流程', 'process'],
];

const COLOR_NAMES = ['红色', '蓝色', '绿色', '黄色', '灰色'];

export function parseSimpleCommand(text: string): SimpleParseResult {
  const normalized = normalizeText(text);
  const draft =
    parseInsertNode(normalized) ??
    parseUpdateEdgeStyle(normalized) ??
    parseDeleteEdge(normalized) ??
    parseCreateEdge(normalized) ??
    parseRenameNode(normalized) ??
    parseUpdateNodeStyle(normalized) ??
    parseDeleteNode(normalized) ??
    parseCreateNode(normalized);

  return draft
    ? { status: 'ready', intent: draft.intent, draft }
    : { status: 'invalid', message: '没有理解这条简单绘图指令，请换一种说法。' };
}

function parseInsertNode(text: string): SimpleOperationDraft | null {
  const match = text.match(/^在(.+?)后面(?:加|添加|插入)(?:一个)?(.+)$/);
  if (!match) return null;
  const targetText = cleanNodeText(match[1]);
  const newLabel = cleanNodeText(match[2]);
  if (!targetText || !newLabel) return null;
  return {
    intent: 'insert_node_after',
    targetText,
    newLabel,
    nodeType: inferNodeType(match[2]),
  };
}

function parseUpdateEdgeStyle(text: string): SimpleOperationDraft | null {
  const match = text.match(/^把(.+?)(?:改成|设为)(.+)$/);
  if (!match || (!match[1].includes('分支') && !match[1].includes('线'))) return null;
  const colorName = COLOR_NAMES.find((color) => match[2].includes(color));
  const lineType = match[2].includes('虚线')
    ? 'dashed'
    : match[2].includes('实线')
      ? 'solid'
      : undefined;
  if (!colorName && !lineType) return null;
  return {
    intent: 'update_edge_style',
    edgeText: cleanEdgeText(match[1]),
    colorName,
    lineType,
  };
}

function parseDeleteEdge(text: string): SimpleOperationDraft | null {
  const endpoints = text.match(/^删除(.+?)到(.+?)(?:的)?(?:连线|线)$/);
  if (endpoints) {
    return {
      intent: 'delete_edge',
      sourceText: cleanNodeText(endpoints[1]),
      targetText: cleanNodeText(endpoints[2]),
    };
  }
  const byName = text.match(/^删除(.+?)(?:分支|连线|线)$/);
  return byName ? { intent: 'delete_edge', edgeText: cleanEdgeText(byName[1]) } : null;
}

function parseCreateEdge(text: string): SimpleOperationDraft | null {
  const match = text.match(/^连接(.+?)到(.+?)(?:标签为(.+))?$/);
  if (!match) return null;
  return {
    intent: 'create_edge',
    sourceText: cleanNodeText(match[1]),
    targetText: cleanNodeText(match[2]),
    label: match[3],
  };
}

function parseRenameNode(text: string): SimpleOperationDraft | null {
  const match = text.match(/^把(.+?)(?:改名为|重命名为)(.+)$/);
  return match
    ? {
        intent: 'update_node_text',
        targetText: cleanNodeText(match[1]),
        newLabel: cleanNodeText(match[2]),
      }
    : null;
}

function parseUpdateNodeStyle(text: string): SimpleOperationDraft | null {
  const match = text.match(/^把(.+?)(?:改成|设为)(红色|蓝色|绿色|黄色|灰色)$/);
  return match
    ? {
        intent: 'update_node_style',
        targetText: cleanNodeText(match[1]),
        colorName: match[2],
      }
    : null;
}

function parseDeleteNode(text: string): SimpleOperationDraft | null {
  const match = text.match(/^删除(.+)$/);
  if (!match || match[1].includes('线') || match[1].includes('分支')) return null;
  return { intent: 'delete_node', targetText: cleanNodeText(match[1]) };
}

function parseCreateNode(text: string): SimpleOperationDraft | null {
  const match = text.match(/^(?:加|添加|创建)(?:一个)?(.+)$/);
  if (!match) return null;
  const content = match[1];
  const nameMatch = content.match(/(?:节点)?(?:叫|名为)(.+)$/);
  if (!nameMatch) return null;
  const label = cleanNodeText(nameMatch[1]);
  return label
    ? { intent: 'create_node', label, nodeType: inferNodeType(content) }
    : null;
}

function inferNodeType(text: string): NodeType {
  return NODE_TYPE_RULES.find(([keyword]) => text.includes(keyword))?.[1] ?? 'process';
}

function cleanNodeText(text: string): string {
  return text
    .replace(/^(?:一个|这个|那个)/, '')
    .replace(/(?:流程)?节点$/, '')
    .trim();
}

function cleanEdgeText(text: string): string {
  return text.replace(/(?:的)?(?:分支|连线|线)$/, '').trim();
}
