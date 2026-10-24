import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRightIcon, XIcon } from 'lucide-react';
import Icon from '@/components/Icon';
import styles from './index.module.css';

export type ProjectInfoProps = {
  name: string;
  href: string;
  what: string;
  why: string;
  stack: string[];
};

export default function ProjectInfo({
  name,
  href,
  what,
  why,
  stack,
}: ProjectInfoProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!rootRef.current!.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current!.focus();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const host = new URL(href).host;
  const facts = [
    { term: 'What', detail: what },
    { term: 'Why', detail: why },
  ];

  return (
    <div ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`About ${name}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.info} aria-hidden="true">
          i
        </span>
        <Icon icon={XIcon} className={styles.close} />
      </button>
      <div
        id={panelId}
        className={styles.panel}
        data-open={open}
        inert={!open}
        role="region"
        aria-label={`About ${name}`}
      >
        <div
          className={`${styles.head} ${styles.reveal}`}
          style={{ '--i': 0 } as CSSProperties}
        >
          <p className={styles.title}>{name}</p>
          <a
            className={styles.visit}
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={`${host} (opens in a new tab)`}
          >
            {host}
            <Icon icon={ArrowUpRightIcon} />
          </a>
        </div>
        <dl className={styles.facts}>
          {facts.map(({ term, detail }, i) => (
            <div
              key={term}
              className={styles.reveal}
              style={{ '--i': i + 1 } as CSSProperties}
            >
              <dt>{term}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
          <div
            className={styles.reveal}
            style={{ '--i': facts.length + 1 } as CSSProperties}
          >
            <dt>Stack</dt>
            <dd>
              <ul className={styles.stack}>
                {stack.map((tech) => (
                  <li key={tech}>{tech}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
