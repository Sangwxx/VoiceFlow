import type { AgentRequest } from '../agent/agentTypes';

export function buildFreeDrawingPrompt(request: AgentRequest): string {
  return [
    '你是自由画布 SVG 图元规划器。请把用户想画的物体拆成少量、清晰、可编辑的 SVG 基础图元。',
    '只返回一个 JSON 对象，不要 Markdown、解释前缀或后缀。',
    '返回格式：{"title":"自由画布：主题","groupLabel":"主题","objects":[...]}。',
    '允许的图元 type 只有 circle、ellipse、rect、line、path。',
    'circle 字段：type,label,cx,cy,radius,fill,stroke,strokeWidth。',
    'ellipse 字段：type,label,cx,cy,rx,ry,rotate,fill,stroke,strokeWidth。',
    'rect 字段：type,label,x,y,width,height,radius,fill,stroke,strokeWidth。',
    'line 字段：type,label,x1,y1,x2,y2,stroke,strokeWidth,lineCap。',
    'path 字段：type,label,d,fill,stroke,strokeWidth。',
    '画布大小为 1000x700。物体应位于画布中央附近，完整可见；通常使用 3 到 30 个图元，最多 60 个。',
    '颜色使用 #RRGGBB 或 none。路径只使用标准 SVG 路径命令，不得包含脚本、URL 或 HTML。',
    '不要返回删除、修改、专业图表节点或流程图 Operation。只规划本次新绘制物体。',
    `用户请求：${request.originalCommand}`,
    request.currentFreeDrawingScene
      ? `当前自由画布摘要：已有 ${request.currentFreeDrawingScene.objects.length} 个图元；新物体应避免完全覆盖已有内容。`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
