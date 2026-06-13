import styles from './VisualClarificationCard.module.css';

export type VisualClarificationCandidate = {
  id: string;
  label: string;
  kind: string;
  detail?: string;
};

type VisualClarificationCardProps = {
  title: string;
  status: string;
  originalCommand: string;
  reason: string;
  candidates: VisualClarificationCandidate[];
};

export function VisualClarificationCard({
  title,
  status,
  originalCommand,
  reason,
  candidates,
}: VisualClarificationCardProps) {
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.heading}>
        <span>{title}</span>
        <span className={styles.status}>{status}</span>
      </div>
      <div className={styles.context}>
        <span>原始语音</span>
        <strong>“{originalCommand}”</strong>
        <span>系统判断</span>
        <p>{reason}</p>
      </div>
      {candidates.length > 0 && (
        <ol className={styles.candidates}>
          {candidates.map((candidate, index) => (
            <li className={styles.candidate} key={candidate.id}>
              <span className={styles.number}>{index + 1}</span>
              <span className={styles.label}>{candidate.label}</span>
              <span className={styles.kind}>{candidate.detail ?? candidate.kind}</span>
            </li>
          ))}
        </ol>
      )}
      <p className={styles.hint}>
        请继续用语音说“第一个”“第二个”、候选名称、确认或取消。
      </p>
    </section>
  );
}
