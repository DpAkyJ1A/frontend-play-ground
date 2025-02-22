import { Link } from 'react-router-dom';
import styles from './index.module.css';

const GLIDER = [0, 1, 0, 0, 0, 1, 1, 1, 1];

export default function Header({ children }) {
  return (
    <header className={styles.header}>
      <Link to={'/'} className={styles.logo} aria-label="Frontend Play Ground">
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
