import { useEffect, useRef } from 'react';
import styles from './index.module.css';
import { GESTURES } from '../gestures';

// the bar runs to this multiple of the threshold; the tick marks the threshold
const MAX_RATIO = 1.5;

// Live level of each nudge gesture against its threshold, so you can see what
// your face does before relying on it. Written straight to the DOM every frame.
export default function GestureMeters({ engine, sensitivity }) {
  const barsRef = useRef([]);
  const sensitivityRef = useRef(sensitivity);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(
    () =>
      engine.subscribe((frame) => {
        GESTURES.forEach((gesture, i) => {
          const bar = barsRef.current[i];
          if (!bar) return;
          const ratio = frame.gestures
            ? frame.gestures[gesture.key] /
              (gesture.threshold / sensitivityRef.current)
            : 0;
          bar.style.setProperty('--level', Math.min(ratio / MAX_RATIO, 1));
          bar.dataset.over = ratio >= 1;
        });
      }),
    [engine]
  );

  return (
    <ul className={styles.meters} style={{ '--tick': `${100 / MAX_RATIO}%` }}>
      {GESTURES.map((gesture, i) => (
        <li key={gesture.key}>
          <span>
            <b>{gesture.arrow}</b> {gesture.label}
          </span>
          <span
            ref={(element) => {
              barsRef.current[i] = element;
            }}
            className={styles.meter}
          />
        </li>
      ))}
    </ul>
  );
}
