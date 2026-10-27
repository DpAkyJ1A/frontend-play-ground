import type { CSSProperties } from 'react';
import { PROBES } from '../probes';
import type { Insight, Level, Verdict } from './rules';
import styles from './index.module.css';

const TITLES = new Map(PROBES.map((probe) => [probe.id, probe.title]));

const LEVELS: Record<Level, string> = {
  green: 'Harmless',
  yellow: 'Worth knowing',
  red: 'Dangerous',
};

const CRACKS = [
  'M190 30 L172 47 L175 60 L153 80 L157 94 L131 116 L127 142 L108 170',
  'M190 30 L207 54 L203 72 L220 92',
  'M190 30 L166 28 L151 18 L128 22 L110 8 L90 12 L78 0',
  'M190 30 L200 15 L197 4 L202 0',
  'M190 30 L214 34 L220 31',
  'M153 80 L134 75 L116 84',
  'M128 22 L124 40 L107 46',
  'M131 116 L148 128 L149 142',
  'M184 25 L196 24 L197 36 L186 38 Z',
];

function Cracks() {
  return (
    <svg className={styles.cracks} viewBox="0 0 220 170" aria-hidden="true">
      {CRACKS.map((d, i) => (
        <path
          key={d}
          d={d}
          pathLength={1}
          style={{ '--i': i } as CSSProperties}
        />
      ))}
    </svg>
  );
}

export const TRY_IDS = ['photo', 'docs', 'folder', 'contacts', 'location'];

export type InsightsProps = {
  insights: Insight[];
  verdict: Verdict;
  done: boolean;
  focus: string | null;
  canTry: boolean;
  onFocus: (id: string | null) => void;
};

export default function Insights({
  insights,
  verdict,
  done,
  focus,
  canTry,
  onFocus,
}: InsightsProps) {
  const toggle = (id: string) => onFocus(focus === id ? null : id);

  return (
    <section className={styles.insights} aria-labelledby="insights">
      <div className={styles.head}>
        <h2 id="insights">What it adds up to</h2>
        <span>
          {done
            ? `${insights.length} conclusion${insights.length === 1 ? '' : 's'}`
            : 'Adding it up…'}
        </span>
      </div>
      <p className={styles.intro}>
        Drawn only from what the cards below found, worst last. Each one shows
        the cards it comes from.
      </p>
      {done && (
        <div className={styles.list}>
          {insights.map((insight) => (
            <article
              key={insight.id}
              className={styles.insight}
              data-level={insight.level}
              data-plain={insight.plain ? '' : undefined}
            >
              {insight.level === 'red' && <Cracks />}
              <span className={styles.tag}>
                <i aria-hidden="true" />
                {LEVELS[insight.level]}
              </span>
              <h3>{insight.title}</h3>
              <p className={styles.text}>{insight.text}</p>
              {insight.fix && (
                <p className={styles.fix}>
                  <b>What to do:</b> {insight.fix}
                </p>
              )}
              <div className={styles.from}>
                <button
                  type="button"
                  aria-pressed={focus === insight.id}
                  onClick={() => toggle(insight.id)}
                >
                  {focus === insight.id
                    ? 'Show every card'
                    : `Show ${insight.sources.length === 1 ? 'the card' : `the ${insight.sources.length} cards`}`}
                </button>
                <span>
                  {insight.sources.map((id) => TITLES.get(id)).join(' · ')}
                </span>
              </div>
            </article>
          ))}
          <article className={styles.verdict} data-level={verdict.level}>
            {verdict.level === 'red' && <Cracks />}
            <div className={styles.score}>
              <p>
                <b>{verdict.score}</b>
                <span>/100</span>
              </p>
              <p className={styles.label}>{verdict.label}</p>
              <div
                className={styles.meter}
                role="img"
                aria-label={`${verdict.score} out of 100`}
              >
                <i style={{ '--at': `${verdict.score}%` } as CSSProperties} />
              </div>
            </div>
            <div className={styles.file}>
              <h3>The file on you</h3>
              <p className={styles.dossier}>{verdict.text}</p>
              <p className={styles.how}>
                A rough score of our own. A fingerprint that stays the same, an
                IP that names a city and every yellow and red conclusion add to
                it; protections take away.
              </p>
              {canTry && (
                <button
                  type="button"
                  className={styles.try}
                  aria-pressed={focus === 'try'}
                  onClick={() => toggle('try')}
                >
                  {focus === 'try'
                    ? 'Show every card'
                    : 'Hand it a photo, a document or a folder, and this gets worse'}
                </button>
              )}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
