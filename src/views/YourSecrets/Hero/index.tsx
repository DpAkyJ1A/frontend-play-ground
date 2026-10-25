import { useEffect, useState, type ReactNode } from 'react';
import styles from './index.module.css';

const STEP_MS = 28;

const useCountUp = (target: number) => {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown === target) return;
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const timer = setTimeout(
      () => setShown(reduce ? target : shown + Math.sign(target - shown)),
      reduce ? 0 : STEP_MS
    );
    return () => clearTimeout(timer);
  }, [shown, target]);
  return shown;
};

export type HeroProps = {
  count: number;
  portrait: string;
  meta: string;
  id: string | null;
  eyes: ReactNode;
  awake: boolean;
  onWake: () => void;
};

export default function Hero({
  count,
  portrait,
  meta,
  id,
  eyes,
  awake,
  onWake,
}: HeroProps) {
  const shown = useCountUp(count);

  return (
    <section className={styles.hero}>
      <div>
        <h1 className={styles.title}>
          This page already knows <span>{shown}</span> things about you.
        </h1>
        <p className={styles.portrait}>{portrait}</p>
        <p className={styles.meta}>{meta}</p>
      </div>
      <div className={styles.side}>
        <button
          type="button"
          className={styles.eyes}
          aria-pressed={awake}
          aria-label="Wake the eyes"
          onClick={onWake}
        >
          {eyes}
        </button>
        <aside className={styles.idCard} aria-live="polite">
          <h2>Your fingerprint</h2>
          <p className={styles.id}>{id ?? '···· ···· ····'}</p>
          <p>
            Open this page in a private window: the ID stays the same. No cookie
            needed to recognise you.
          </p>
          <p className={styles.from}>
            Made from your canvas and audio rendering, graphics card, screen,
            time zone, languages, fonts and system.
          </p>
        </aside>
      </div>
    </section>
  );
}
