'use client';

import dynamic from 'next/dynamic';
import { Header } from '@/layout';
import styles from './index.module.css';

function Frame() {
  return (
    <div className={styles.theGameOfLifePage}>
      <Header>
        <div className={styles.headerControls}>
          <div className={styles.titleGroup}>
            <h1 className={styles.pageTitle}>The Game of Life Ultimate</h1>
          </div>
          {/* Holds the header at the height the game's controls give it. */}
          <div className={`${styles.transport} ${styles.frameTransport}`} />
          <dl className={styles.stats}>
            <div>
              <dt>Generation</dt>
              <dd>0</dd>
            </div>
            <div>
              <dt>Gen/s</dt>
              <dd>0.0</dd>
            </div>
            <div>
              <dt>Alive</dt>
              <dd>0</dd>
            </div>
          </dl>
        </div>
      </Header>
    </div>
  );
}

// The game picks its first layout from the screen (pixel ratio, viewport width,
// panels saved in localStorage), so it renders in the browser only. The server
// sends the page frame with the title.
const Game = dynamic(() => import('.'), { ssr: false, loading: Frame });

export default function ClientGame() {
  return <Game />;
}
