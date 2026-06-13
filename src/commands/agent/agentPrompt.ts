import type { AgentRequest } from './agentTypes';

export function buildAgentPrompt(request: AgentRequest): string {
  const context = request.conversation
    .map((turn) => `${turn.role === 'user' ? '用户' : '系统'}：${turn.content}`)
    .join('\n');

  const isModification = request.intent === 'modify_diagram';
  return [
    'For broad learning-flow requests, infer a useful practical sequence instead of asking unnecessary clarification.',
    '你是 VoiceFlow 图表规划器。只返回一个 JSON 对象，不要 Markdown、代码围栏或解释性文字。',
    isModification
      ? '修改现有图表时返回：{"kind":"operations","explanation":"...","summary":"...","operations":[...]}。'
      : '信息充足时返回：{"kind":"diagram","explanation":"...","summary":"...","diagram":{...}}。',
    '信息不足时返回：{"kind":"clarification","explanation":"...","question":"..."}。',
    `任务类型：${request.intent}。`,
    '支持的节点类型：start,end,process,decision,database,service,user,external。',
    '支持的连线类型：solid,dashed,highlight,weak。',
    isModification
      ? 'operations 只允许 apply_layout、create_node、delete_node、update_node、create_edge、delete_edge、update_edge、insert_node_after。目标必须使用当前图表中的真实 ID；新 ID 必须唯一。不得修改节点 ID、连线 ID 或连线端点。'
      : '',
    '节点不要输出 position。流程图应包含必要的开始、结束、判断和分支标签。',
    '架构图优先使用 user、external、service、database 节点。',
    '不得生成自连或相同起终点的重复连线。',
    `原始请求：${request.originalCommand}`,
    request.currentDiagram
      ? `当前图表 JSON：${JSON.stringify(request.currentDiagram)}`
      : '',
    request.recentCommands?.length
      ? `最近命令：${request.recentCommands.join('；')}`
      : '',
    context ? `澄清上下文：\n${context}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
