import type { DiagramValidationError } from '../../core/diagram/diagramValidators';
import styles from './ErrorPanel.module.css';

type ErrorPanelProps = {
  title: string;
  message: string;
  errors?: DiagramValidationError[];
};

export function ErrorPanel({ title, message, errors = [] }: ErrorPanelProps) {
  return (
    <section className={styles.panel} role="alert">
      <span className={styles.eyebrow}>无法渲染图形</span>
      <h2>{title}</h2>
      <p>{message}</p>
      {errors.length > 0 && (
        <ul>
          {errors.map((error) => (
            <li key={`${error.path}-${error.code}`}>
              <code>{error.path}</code>
              {error.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
