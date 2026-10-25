'use client';

import { useCallback, useState } from 'react';
import { Header } from '@/layout';
import About from './About';
import Eyes, { useSharingan } from './Eyes';
import Hero from './Hero';
import { fingerprintId, portrait } from './Hero/summary';
import { PROBES } from './probes';
import { shared } from './probes/score';
import type { Probe } from './probes/types';
import Results from './Results';
import InfoSheet from './Results/InfoSheet';
import { useProbes } from './useProbes';
import styles from './index.module.css';

const OPEN_PROBES = PROBES.filter((probe) => probe.access === 'none');

export type YourSecretsProps = {
  /** False in a static export, where the IP card has no server to ask. */
  hasServer: boolean;
};

export default function YourSecrets({ hasServer }: YourSecretsProps) {
  const { results, elapsed, setResult } = useProbes({ hasServer });
  const [sharingan, setSharingan] = useSharingan();
  const [info, setInfo] = useState<{ probe: Probe; open: boolean } | null>(
    null
  );
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const done = elapsed !== null;

  const count = OPEN_PROBES.reduce(
    (sum, probe) => sum + shared(results.get(probe.id)),
    0
  );
  const sentence = portrait(results);

  const openInfo = useCallback(
    (probe: Probe) => setInfo({ probe, open: true }),
    []
  );
  const closeInfo = useCallback(
    () => setInfo((current) => current && { ...current, open: false }),
    []
  );
  const closeAbout = useCallback(() => setIsAboutOpen(false), []);

  return (
    <div className={styles.yourSecretsPage}>
      <Header>
        <h2 className={styles.project}>Your Secrets</h2>
        <button
          type="button"
          className={styles.aboutButton}
          onClick={() => setIsAboutOpen(true)}
        >
          About
        </button>
      </Header>
      <main className={styles.main}>
        <Hero
          count={count}
          portrait={sentence === 'You’re.' ? 'Looking…' : sentence}
          meta={
            done
              ? `Found in ${Math.round(elapsed)} ms. Nothing was asked, and nothing leaves this tab but your IP.`
              : 'Reading what your browser shares on its own.'
          }
          id={done ? fingerprintId(results) : null}
          eyes={<Eyes />}
          awake={sharingan}
          onWake={() => setSharingan(!sharingan)}
        />
        <Results
          results={results}
          done={done}
          onResult={setResult}
          onInfo={openInfo}
        />
      </main>
      <InfoSheet
        probe={info?.probe ?? null}
        result={info ? results.get(info.probe.id) : undefined}
        open={Boolean(info?.open)}
        onClose={closeInfo}
      />
      <About open={isAboutOpen} onClose={closeAbout} />
    </div>
  );
}
