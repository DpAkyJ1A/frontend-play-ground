'use client';

import { useCallback, useMemo, useState } from 'react';
import { Header } from '@/layout';
import About from './About';
import Eyes, { useSharingan } from './Eyes';
import Hero from './Hero';
import { fingerprintId, portrait } from './Hero/summary';
import Insights, { TRY_IDS } from './Insights';
import { conclude } from './Insights/rules';
import { PROBES } from './probes';
import { shared } from './probes/score';
import type { Probe } from './probes/types';
import Results, { type Focus } from './Results';
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
  const [focusId, setFocusId] = useState<string | null>(null);
  const done = elapsed !== null;
  const { insights, verdict } = useMemo(() => conclude(results), [results]);
  const tries = TRY_IDS.filter((id) => !results.get(id)?.guarded);
  const canTry = tries.every((id) => !shared(results.get(id)));
  const insight = insights.find((item) => item.id === focusId);
  const focus: Focus | null = insight
    ? { label: insight.title, tone: insight.level, sources: insight.sources }
    : focusId === 'try' && canTry
      ? { label: 'what to try next', tone: 'try', sources: tries }
      : null;

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
  const changeFocus = useCallback((id: string | null) => {
    setFocusId(id);
    if (!id) return;
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    requestAnimationFrame(() =>
      document
        .getElementById('results')
        ?.scrollIntoView({
          behavior: reduce ? 'auto' : 'smooth',
          block: 'start',
        })
    );
  }, []);
  const clearFocus = useCallback(() => setFocusId(null), []);

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
        <Insights
          insights={insights}
          verdict={verdict}
          done={done}
          focus={focus ? focusId : null}
          canTry={canTry}
          onFocus={changeFocus}
        />
        <Results
          results={results}
          done={done}
          focus={focus}
          onClearFocus={clearFocus}
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
