import { useEffect, useState } from 'react';
import styles from './index.module.css';
import { prefersReducedMotion } from '@/utils/helpers';

export default function Typewriter({
  text,
  delay = 0,
  speed = 45,
  className = '',
}) {
  const [count, setCount] = useState(() =>
    prefersReducedMotion() ? text.length : 0
  );

  useEffect(() => {
    if (prefersReducedMotion()) {
      setCount(text.length);
      return;
    }

    let typed = 0;
    let interval = 0;
    setCount(0);

    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        typed += 1;
        setCount(typed);
        if (typed >= text.length) clearInterval(interval);
      }, speed);
    }, delay);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [text, delay, speed]);

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
