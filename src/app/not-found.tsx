import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/layout';
import styles from './not-found.module.css';

export const metadata: Metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>This page isn’t here.</h1>
        <p className={styles.lede}>
          The link may be old, or the experiment moved. The rest of the
          playground is one click away.
        </p>
        <Link href="/" className={styles.home}>
          Back to the experiments
        </Link>
      </main>
    </>
  );
}
