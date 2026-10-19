import { useEffect, useState, useSyncExternalStore } from 'react';
import styles from './index.module.css';
import { prefersReducedMotion } from '@/utils/helpers';

export type TypewriterProps = {
  text: string;
  delay?: number;
  speed?: number;
  className?: string;
};

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const subscribeReducedMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

export default function Typewriter({
  text,
  delay = 0,
  speed = 45,
  className = '',
}: TypewriterProps) {
  // The server (and hydration) assume motion, so the headline starts empty
  // everywhere; with reduced motion it is filled right after, and the CSS keeps
  // the untyped rest visible until then.
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => false
  );
  const [typed, setTyped] = useState({ text, count: 0 });
  const count = reduceMotion
    ? text.length
    : typed.text === text
      ? typed.count
      : 0;

  useEffect(() => {
    if (reduceMotion) return;

    let typedCount = 0;
    let interval = 0;

    const timeout = setTimeout(() => {
      interval = window.setInterval(() => {
        typedCount += 1;
        setTyped({ text, count: typedCount });
        if (typedCount >= text.length) clearInterval(interval);
      }, speed);
    }, delay);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [text, delay, speed, reduceMotion]);

  return (
    <span className={`${styles.typewriter} ${className}`}>
      {text.slice(0, count)}
      <span
        className={styles.caret}
        data-done={count >= text.length}
        aria-hidden="true"
      />
      <span className={styles.rest}>{text.slice(count)}</span>
    </span>
  );
}
