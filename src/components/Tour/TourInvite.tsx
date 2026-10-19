import { useEffect, useState, type ReactNode } from 'react';
import styles from './index.module.css';

export type TourInviteProps = {
  open: boolean;
  title: string;
  text: ReactNode;
  startLabel?: ReactNode;
  dismissLabel?: ReactNode;
  delay?: number;
  onStart: () => void;
  onDismiss: () => void;
  className?: string;
};

export default function TourInvite({
  open,
  title,
  text,
  startLabel = 'Show me around',
  dismissLabel = 'No thanks',
  delay = 1200,
  onStart,
  onDismiss,
  className = '',
}: TourInviteProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(id);
  }, [open, delay]);

  if (!open || !ready) return null;

  return (
    <section className={`${styles.invite} ${className}`} aria-label={title}>
      <p className={styles.inviteText}>
        <strong>{title}</strong>
        <span>{text}</span>
      </p>
      <div className={styles.inviteActions}>
        <button className={styles.button} onClick={onDismiss}>
          {dismissLabel}
        </button>
        <button
          className={`${styles.button} ${styles.primary}`}
          onClick={onStart}
        >
          {startLabel}
        </button>
      </div>
    </section>
  );
}
