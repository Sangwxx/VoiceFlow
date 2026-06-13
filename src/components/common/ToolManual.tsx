import styles from './ToolManual.module.css';

const COMMAND_GROUPS = [
  {
    title: '画布控制',
    commands: ['看全图', '放大画布', '横向布局', '自动排版', '撤销', '重做'],
  },
  {
    title: '增删改图形',
    commands: [
      '在登录页后面加一个验证码节点',
      '删除物体 3',
      '把物体 2 改名为账号登录',
      '把物体 10 改成红色虚线',
      '连接登录页到验证码校验',
    ],
  },
  {
    title: '生成结构图',
    commands: [
      '画一个强化学习的学习流程图',
      '画一个包含网关、订单服务和数据库的系统架构图',
      '画一个学生选课用例图',
      '画一个公司的组织结构图',
      '生成产品功能思维导图',
      '做一个方案对比表格',
      '确认',
      '取消',
    ],
  },
  {
    title: '美化与场景',
    commands: [
      '整理成适合汇报的版本',
      '改成蓝色商务风',
      '突出主流程',
      '加载电商订单演示场景',
    ],
  },
  {
    title: '版本管理',
    commands: ['保存当前版本叫初始流程', '列出版本', '恢复初始流程', '对比初始流程'],
  },
  { title: '导出', commands: ['导出 JSON', '导出 SVG', '导出 PNG'] },
] as const;

export function ToolManual({ onClose }: { onClose(): void }) {
  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <aside
        className={styles.manual}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-manual-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>VOICE COMMAND MANUAL</span>
            <h3 id="tool-manual-title">工具手册</h3>
            <p>直接说出示例语句。画布对象可用“物体 + 编号”引用。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭工具手册">
            关闭
          </button>
        </header>
        <div className={styles.groups}>
          {COMMAND_GROUPS.map((group) => (
            <section key={group.title}>
              <h4>{group.title}</h4>
              <ul>
                {group.commands.map((command) => (
                  <li key={command}>“{command}”</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
