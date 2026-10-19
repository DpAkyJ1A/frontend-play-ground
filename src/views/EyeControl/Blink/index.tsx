import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/utils/helpers';
import styles from './index.module.css';

const CLOSE = 140;
const SHUT = 60;

/**
 * State changes happen behind a blink: the lids close, `then` swaps the state
 * under cover, the lids open. With reduced motion `then` runs at once.
 */
export function useBlink() {
  const [closed, setClosed] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    []
  );

  const blink = useCallback((then: () => void) => {
    if (prefersReducedMotion()) {
      then();
      return;
    }
    timers.current.forEach(clearTimeout);
    setClosed(true);
    timers.current = [
      window.setTimeout(then, CLOSE),
      window.setTimeout(() => setClosed(false), CLOSE + SHUT),
    ];
  }, []);

  return [closed, blink] as const;
}

export default function Lids({ closed }: { closed: boolean }) {
  return (
    <div className={styles.lids} data-closed={closed} aria-hidden="true">
      <span className={styles.upper} />
      <span className={styles.lower} />
    </div>
  );
}
