import type { AgentRequest } from './agentTypes';

export function buildAgentPrompt(request: AgentRequest): string {
  const context = request.conversation
    .map((turn) => `${turn.role === 'user' ? '用户' : '系统'}：${turn.content}`)
    .join('\n');

  const isModification = request.intent === 'modify_diagram';
  return [
    '你是专业图表架构师。你的主要任务是根据用户主题规划准确、完整且有针对性的结构图，而不是套用固定模板。',
    '回复必须以 { 开始并以 } 结束，只返回一个紧凑 JSON 对象，不要 Markdown、解释前缀或解释后缀。生成完整图时不要输出坐标、样式、元数据或内部完整 Diagram；修改位置时优先输出语义空间 Operation，不要自行计算像素坐标。',
    isModification
      ? '修改现有图表时返回：{"kind":"operations","explanation":"...","summary":"...","operations":[...]}。'
      : '生成图表时返回：{"kind":"diagram","title":"...","diagramType":"...","direction":"top_down|left_to_right","nodes":[{"id":"n1","label":"...","type":"..."}],"edges":[{"from":"n1","to":"n2","label":"可选"}],"groups":[{"label":"可选","nodeIds":["n1"]}],"summary":"..."}。',
    isModification
      ? '只有完全无法确定修改目标时才允许返回：{"kind":"clarification","explanation":"...","question":"..."}。'
      : '创建请求只要明确表达画、生成或创建某类图，就视为信息充足。缺少普通细节时主动补全；只有存在会明显改变图表含义的关键歧义时，才允许返回 clarification。',
    '图表类型可选：flowchart,architecture,organization,dataflow,usecase,mindmap,framework,table,generic。根据用户原话和主题选择，不要默认流程图。',
    '节点类型可选：start,end,process,decision,database,service,user,external,group。',
    '支持的连线类型：solid,dashed,highlight,weak。',
    isModification
      ? 'operations 数组中的每一项都必须包含合法的 Operation type。只允许 apply_layout、create_node、delete_node、update_node、move_node、set_relative_position、align_nodes、create_edge、delete_edge、update_edge、set_edge_endpoints、insert_node_after。process、user、decision 等是 node.type，绝对不能作为 Operation type。目标必须使用当前图表中的真实 ID；新 ID 必须唯一。不得修改节点 ID 或连线 ID。相对定位使用 {"type":"set_relative_position","nodeId":"待移动ID","referenceNodeId":"参考ID","relation":"left_of|right_of|above|below"}；水平或垂直对齐使用 {"type":"align_nodes","nodeIds":["真实ID"],"axis":"horizontal|vertical"}；修改箭头方向使用 {"type":"set_edge_endpoints","edgeId":"真实ID","from":"起点真实ID","to":"终点真实ID"}；修改文字使用 update_node，并在 patch 中提供 label。'
      : '',
    '必须围绕用户给出的具体主题生成内容。不要使用“核心概念、方法与工具、实践应用”等通用占位词，除非用户明确要求。',
    '用户未列出具体节点时，请基于主题知识主动补全合理结构；通常生成 5 到 14 个节点，复杂主题可以更多，但“最简单”“最简”等请求应只生成完成表达所需的最少节点。',
    '流程图需要表达真实步骤、判断与分支；架构图需要表达层次、组件和依赖；组织结构图需要表达上下级；用例图需要表达参与者与用例；思维导图需要围绕中心主题发散；表格需要表达对比维度与内容。',
    '用例图使用 user 表示参与者、process 表示用例；组织结构图使用 group/process；表格使用 group 表示表头或分区、process 表示单元内容。',
    '仅在用户明确要求流程图时使用开始、结束、判断和分支。',
    '不得生成自连或相同起终点的重复连线。',
    `原始请求：${request.originalCommand}`,
    request.currentDiagram
      ? `当前图表 JSON：${JSON.stringify(request.currentDiagram)}`
      : '',
    request.spatialSummary ? `当前画布空间摘要：\n${request.spatialSummary}` : '',
    request.recentCommands?.length
      ? `当前画布的最近命令：${request.recentCommands.join('；')}`
      : '',
    context ? `仅属于当前画布的澄清上下文：\n${context}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
