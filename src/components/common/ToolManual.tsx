import styles from './ToolManual.module.css';
import { TOOL_MANUAL_COMMAND_GROUPS } from './toolManualCommands';

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
          {TOOL_MANUAL_COMMAND_GROUPS.map((group) => (
            <section key={group.title}>
              <div className={styles.groupHeading}>
                <h4>{group.title}</h4>
                <span>{group.path}</span>
              </div>
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
