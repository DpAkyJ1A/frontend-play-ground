import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import styles from './index.module.css';

type Step = { title: string; text: ReactNode; ms: number };

// How the page works, drawn as a gaze plot: each step is a fixation, sized by
// how long it holds the eyes, and saccades lead from one to the next.
const STEPS: Step[] = [
  {
    title: 'Calibrate.',
    text: 'Follow a dot gliding across the screen, then 5 more dots measure the error.',
    ms: 312,
  },
  {
    title: 'Aim.',
    text: 'The ring follows your gaze and snaps to the closest button. Landed next to it? Raise your brows, drop your jaw or pull your mouth sideways to nudge it over.',
    ms: 540,
  },
  {
    title: 'Click.',
    text: 'Hold your gaze — where buttons are crowded, a ×3 loupe opens and you pick inside it. Or blink twice; three times flags a button, like a right click.',
    ms: 420,
  },
];

const LONGEST = Math.max(...STEPS.map((step) => step.ms));

type Line = { x1: number; y1: number; x2: number; y2: number };

export default function Scanpath({ className = '' }: { className?: string }) {
  const pathRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);

  // the saccades join the fixations wherever the text wrap put them
  useLayoutEffect(() => {
    const path = pathRef.current!;
    const measure = () => {
      const box = path.getBoundingClientRect();
      const centres = [
        ...path.querySelectorAll<HTMLElement>(`.${styles.fixation}`),
      ].map((fixation) => {
        const rect = fixation.getBoundingClientRect();
        return {
          x: rect.left - box.left + rect.width / 2,
          y: rect.top - box.top + rect.height / 2,
          r: rect.width / 2,
        };
      });
      setLines(
        centres.slice(1).map((to, i) => {
          const from = centres[i];
          const angle = Math.atan2(to.y - from.y, to.x - from.x);
          return {
            x1: from.x + Math.cos(angle) * from.r,
            y1: from.y + Math.sin(angle) * from.r,
            x2: to.x - Math.cos(angle) * to.r,
            y2: to.y - Math.sin(angle) * to.r,
          };
        })
      );
    };
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(path);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={pathRef} className={`${styles.scanpath} ${className}`}>
      <svg className={styles.saccades} aria-hidden="true">
        {lines.map((line, i) => (
          <line key={i} {...line} />
        ))}
      </svg>
      <ol className={styles.steps}>
      {STEPS.map((step, i) => (
        <li
          key={step.title}
          className={styles.step}
          style={{ '--r': `${16 + (step.ms / LONGEST) * 16}px` } as CSSProperties}
        >
          <span
            className={styles.fixation}
            data-heat={(0.35 + (step.ms / LONGEST) * 0.4).toFixed(2)}
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <p className={styles.text}>
            <strong>{step.title}</strong> {step.text}
          </p>
          <span className={styles.duration}>{step.ms} ms</span>
        </li>
      ))}
      </ol>
    </div>
  );
}
