import { Link } from 'react-router-dom';
import styles from './index.module.css';

export default function Header({ children }) {
  return (
    <header className={styles.header}>
      <Link to={'/'}>
        <h1>FPG</h1>
      </Link>
      {children}
    </header>
  );
}
