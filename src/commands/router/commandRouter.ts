import { normalizeText } from '../../utils/text';
import {
  matchFastCommand,
  matchHighPriorityCommand,
} from '../fast/fastCommandDictionary';
import { parseSimpleCommand } from '../simple/simpleCommandParser';
import type { RouteResult } from './routeTypes';

const ARCHITECTURE_PATTERNS = ['架构图', '系统架构', '服务架构', '技术架构'];
const FLOWCHART_PATTERNS = [
  '画一个',
  '画一张',
  '生成一个',
  '生成一张',
  '创建一个',
  '创建一张',
  '新建一个',
  '新建一张',
  '绘制一个',
  '绘制一张',
  '流程图',
  '学习流程',
  '完整流程',
];
const SIMPLE_HINTS = ['添加节点', '加节点', '删除节点', '修改节点', '连接'];
const GENERATION_PATTERNS = [
  '帮我画',
  '帮我生成',
  '帮我创建',
  '设计一个',
  '梳理一个',
  '整理一个',
  '学习路径',
  '学习计划',
  '知识结构',
  '知识图谱',
  '步骤图',
];
const CONTEXTUAL_MODIFICATION_PATTERNS = [
  /把.+(改|换|弄|调整|优化|整理)/,
  /(加上|补上|补一个|插入|增加|删除|移除|连接|断开).+/,
  /(主流程|失败分支|成功分支|异常分支|当前图|这个图).+(突出|弱化|修改|调整|优化)/,
];
const WORKFLOW_PATTERNS = [
  ['整理成适合汇报', 'report_mode'],
  ['汇报版', 'report_mode'],
  ['突出主流程', 'report_mode'],
  ['弱化异常分支', 'report_mode'],
  ['自动美化', 'report_mode'],
  ['蓝色商务风', 'theme_business_blue'],
  ['商务蓝', 'theme_business_blue'],
  ['汇报简洁风', 'theme_report_clean'],
  ['技术深色风', 'theme_tech_dark'],
  ['保存当前版本', 'save_version'],
  ['保存版本', 'save_version'],
  ['恢复版本', 'restore_version'],
  ['回到版本', 'restore_version'],
  ['对比版本', 'compare_version'],
  ['加载登录', 'load_login_scene'],
  ['载入登录', 'load_login_scene'],
  ['加载电商', 'load_ecommerce_scene'],
  ['载入电商', 'load_ecommerce_scene'],
  ['加载系统架构', 'load_architecture_scene'],
  ['载入系统架构', 'load_architecture_scene'],
  ['聚焦', 'focus_node'],
  ['查看节点', 'focus_node'],
  ['隐藏异常分支', 'hide_exception_paths'],
  ['隐藏失败分支', 'hide_exception_paths'],
  ['显示异常分支', 'show_exception_paths'],
  ['显示失败分支', 'show_exception_paths'],
] as const;

export function routeCommand(text: string): RouteResult {
  const normalizedText = normalizeText(text);
  const base = { rawText: text, normalizedText };
  if (!normalizedText) {
    return { ...base, route: 'unknown', confidence: 0, reason: '未识别到有效文本' };
  }

  const highPriority = matchHighPriorityCommand(normalizedText);
  if (highPriority) {
    return {
      ...base,
      route: 'fast',
      confidence: highPriority.confidence,
      fastCommand: highPriority.command,
      reason: '命中高优先级控制词',
    };
  }

  const namedVersionWorkflow = WORKFLOW_PATTERNS.find(
    ([, intent]) =>
      intent === 'save_version' && /保存(当前)?版本(叫|为)/.test(normalizedText),
  );
  if (namedVersionWorkflow) {
    return {
      ...base,
      route: 'workflow',
      confidence: 0.98,
      workflowIntent: 'save_version',
      reason: '识别为命名版本保存指令',
    };
  }

  const objectCommand = parseSimpleCommand(text);
  if (
    objectCommand.status === 'ready' &&
    ['duplicate_node', 'resize_node'].includes(objectCommand.intent)
  ) {
    return {
      ...base,
      route: 'simple',
      confidence: 0.96,
      simpleIntent: objectCommand.intent,
      reason: '识别为对象级绘图操作',
    };
  }

  const fast = matchFastCommand(normalizedText);
  if (fast) {
    return {
      ...base,
      route: 'fast',
      confidence: fast.confidence,
      fastCommand: fast.command,
      reason: '命中 Fast Path 规则',
    };
  }

  const simple = parseSimpleCommand(text);
  if (simple.status === 'ready') {
    return {
      ...base,
      route: 'simple',
      confidence: 0.9,
      simpleIntent: simple.intent,
      reason: '命中 Simple Path 规则',
    };
  }
  if (SIMPLE_HINTS.some((pattern) => normalizedText.includes(pattern))) {
    return {
      ...base,
      route: 'simple',
      confidence: 0.65,
      reason: '识别为参数不完整的 Simple Path 指令',
    };
  }

  const workflow = WORKFLOW_PATTERNS.find(([pattern]) =>
    normalizedText.includes(pattern),
  );
  if (workflow) {
    return {
      ...base,
      route: 'workflow',
      confidence: 0.94,
      workflowIntent: workflow[1],
      reason: '命中确定性 Workflow Path 规则',
    };
  }

  if (ARCHITECTURE_PATTERNS.some((pattern) => normalizedText.includes(pattern))) {
    return {
      ...base,
      route: 'agent',
      confidence: 0.92,
      agentIntent: 'create_architecture',
      reason: '识别为完整系统架构图生成请求',
    };
  }
  if (FLOWCHART_PATTERNS.some((pattern) => normalizedText.includes(pattern))) {
    return {
      ...base,
      route: 'agent',
      confidence: 0.9,
      agentIntent: 'create_flowchart',
      reason: '识别为完整流程图生成请求',
    };
  }
  if (GENERATION_PATTERNS.some((pattern) => normalizedText.includes(pattern))) {
    return {
      ...base,
      route: 'agent',
      confidence: 0.82,
      agentIntent: 'create_flowchart',
      reason: '识别为开放式图表生成请求',
    };
  }
  if (CONTEXTUAL_MODIFICATION_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    return {
      ...base,
      route: 'agent',
      confidence: 0.72,
      agentIntent: 'modify_diagram',
      reason: '识别为需要上下文理解的图表修改请求',
    };
  }

  return {
    ...base,
    route: 'unknown',
    confidence: 0.2,
    reason: '未匹配支持的指令',
  };
}
