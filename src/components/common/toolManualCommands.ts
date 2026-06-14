export const TOOL_MANUAL_COMMAND_GROUPS = [
  {
    title: '画布控制',
    path: '本地 Fast Path',
    commands: ['看全图', '放大画布', '横向布局', '自动排版', '撤销', '重做'],
  },
  {
    title: '增删改图形',
    path: '本地 Simple Path',
    commands: [
      '在登录页后面加一个验证码节点',
      '删除物体 3',
      '把物体 2 改名为账号登录',
      '把物体 10 改成红色虚线',
      '连接打开 App 到进入登录页',
    ],
  },
  {
    title: '生成结构图',
    path: 'LLM 规划，本地降级',
    commands: [
      '画一个强化学习的学习流程图',
      '画一个包含网关、订单服务和数据库的系统架构图',
      '画一个学生选课用例图',
      '画一个公司的组织结构图',
      '生成产品功能思维导图',
      '做一个方案对比表格',
    ],
  },
  {
    title: '美化与场景',
    path: '本地 Workflow',
    commands: [
      '整理成适合汇报的版本',
      '改成蓝色商务风',
      '突出主流程',
      '加载电商订单演示场景',
    ],
  },
  {
    title: '版本管理',
    path: '本地工具',
    commands: ['保存当前版本叫初始流程', '列出版本', '恢复初始流程', '对比初始流程'],
  },
  {
    title: '导出',
    path: '本地 Fast Path',
    commands: ['导出 JSON', '导出 SVG', '导出 PNG'],
  },
] as const;
