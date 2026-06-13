import type { NodeType } from '../../core/diagram/diagramTypes';
import { normalizeText } from '../../utils/text';
import type { SimpleOperationDraft, SimpleParseResult } from './simpleTypes';
import { matchGenericDrawingActions } from './genericDrawingMatcher';

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
  const genericActions = matchGenericDrawingActions(text);
  if (genericActions.length) {
    return {
      status: 'ready',
      intent: genericActions[0].intent,
      draft: genericActions[0],
    };
  }
  const draft =
    parseDuplicateNode(normalized) ??
    parseResizeNode(normalized) ??
    parseCreateShape(normalized) ??
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

function parseDuplicateNode(text: string): SimpleOperationDraft | null {
  const match = text.match(/^(?:复制|克隆|拷贝|再来一个)(.+)$/);
  return match ? { intent: 'duplicate_node', targetText: cleanNodeText(match[1]) } : null;
}

function parseResizeNode(text: string): SimpleOperationDraft | null {
  const exact = text.match(/^把(.+?)(?:改成|设置为)?宽(\d+)高(\d+)$/);
  if (exact) {
    return {
      intent: 'resize_node',
      targetText: cleanNodeText(exact[1]),
      width: Number(exact[2]),
      height: Number(exact[3]),
    };
  }
  const relative = text.match(/^把(.+?)(放大|缩小)$/);
  if (!relative) return null;
  return {
    intent: 'resize_node',
    targetText: cleanNodeText(relative[1]),
    scale: relative[2] === '放大' ? 1.25 : 0.8,
  };
}

function parseCreateShape(text: string): SimpleOperationDraft | null {
  const match = text.match(
    /^(?:画出|画|绘制出|绘制|创建|生成|放置)(?:一个|一张|个)?(正方形|方形|圆形|圆|矩形|长方形|菱形|椭圆|三角形|六边形|五角星|星形)$/,
  );
  if (!match) return null;
  const shape = match[1];
  const square = shape === '正方形' || shape === '方形';
  const circle = shape === '圆形' || shape === '圆';
  const diamond = shape === '菱形';
  const ellipse = shape === '椭圆';
  const triangle = shape === '三角形';
  const hexagon = shape === '六边形';
  const star = shape === '五角星' || shape === '星形';
  return {
    intent: 'create_node',
    label: circle
      ? '圆形'
      : square
        ? '正方形'
        : diamond
          ? '菱形'
          : ellipse
            ? '椭圆'
            : triangle
              ? '三角形'
              : hexagon
                ? '六边形'
                : star
                  ? '五角星'
                  : '矩形',
    nodeType: diamond ? 'decision' : ellipse ? 'start' : 'process',
    size:
      circle || square || diamond
        ? { width: 150, height: 150 }
        : { width: 220, height: 120 },
    style: {
      background: '#dbeafe',
      border: '#3b82f6',
      borderWidth: 2,
      borderRadius: circle || ellipse ? 999 : square ? 0 : 8,
      color: '#1e3a5f',
      clipPath: triangle
        ? 'polygon(50% 0, 100% 100%, 0 100%)'
        : hexagon
          ? 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)'
          : star
            ? 'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 92%, 50% 70%, 21% 92%, 32% 57%, 2% 35%, 39% 35%)'
            : undefined,
    },
  };
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
