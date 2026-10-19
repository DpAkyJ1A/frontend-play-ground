import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './index.module.css';

const GLIDER = [0, 1, 0, 0, 0, 1, 1, 1, 1];

export type HeaderProps = {
  children?: ReactNode;
};

export default function Header({ children }: HeaderProps) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo} aria-label="Frontend Play Ground">
        <span className={styles.glider} aria-hidden="true">
          {GLIDER.map((alive, i) => (
            <span key={i} className={alive ? styles.alive : undefined} />
          ))}
        </span>
        <span className={styles.wordmark}>FPG</span>
      </Link>
      {children}
    </header>
  );
}
