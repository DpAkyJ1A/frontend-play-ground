import { useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { arrowForward, play, refresh } from 'ionicons/icons';
import Dialog from '@/components/Dialog';
import { LifeField } from '@/components';
import { patternGroups } from '../PatternLibrary/library';
import styles from './index.module.css';

const CENTER = 4;

const RULES = [
  {
    title: 'Birth',
    text: 'A dead cell with exactly 3 live neighbors comes alive.',
    alive: false,
    neighbors: [1, 5, 6],
    next: true,
  },
  {
    title: 'Survival',
    text: 'A live cell with 2 or 3 live neighbors stays alive.',
    alive: true,
    neighbors: [0, 8],
    next: true,
  },
  {
    title: 'Loneliness',
    text: 'A live cell with fewer than 2 live neighbors dies.',
    alive: true,
    neighbors: [2],
    next: false,
  },
  {
    title: 'Overcrowding',
    text: 'A live cell with more than 3 live neighbors dies.',
    alive: true,
    neighbors: [1, 3, 5, 7],
    next: false,
  },
];

const READING = [
  {
    href: 'https://conwaylife.com/wiki/Conway%27s_Game_of_Life',
    label: 'LifeWiki',
    note: 'a page for nearly every known pattern',
  },
  {
    href: 'https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life',
    label: 'Wikipedia',
    note: 'the history, the rules and the math behind them',
  },
  {
    href: 'https://web.stanford.edu/class/sts145/Library/life.pdf',
    label: 'Martin Gardner’s 1970 column',
    note: 'the Scientific American article that started it, as a PDF',
  },
  {
    href: 'https://www.youtube.com/watch?v=R9Plq-D1gEk',
    label: 'Inventing Game of Life',
    note: 'Conway tells the story himself, on Numberphile',
  },
  {
    href: 'https://golly.sourceforge.io/',
    label: 'Golly',
    note: 'a free app for huge patterns and other rules',
  },
];

const PATTERN_COUNT = patternGroups.reduce(
  (sum, group) => sum + group.patterns.length,
  0
);

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Neighborhood({ rule, after }) {
  return (
    <span className={`${styles.cells} ${after ? styles.after : ''}`}>
      {Array.from({ length: 9 }, (_, i) => {
        const alive =
          i === CENTER
            ? after
              ? rule.next
              : rule.alive
            : rule.neighbors.includes(i);
        return (
          <span
            key={i}
            className={`${alive ? styles.alive : ''} ${
              i === CENTER ? styles.center : ''
            }`}
          />
        );
      })}
    </span>
  );
}

export default function AboutDialog({
  open,
  onClose,
  onBrowsePatterns,
  onStartTour,
}) {
  const [running, setRunning] = useState(false);
  const canRun = !prefersReducedMotion();

  useEffect(() => {
    if (!open) setRunning(false);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className={styles.dialog}
      title="What is the Game of Life?"
      description="A game with no players, invented by John Conway in 1970"
    >
      <div className={styles.body}>
        <p className={styles.lead}>
          The field is a grid of cells, and each cell is either alive or dead.
          You draw a starting pattern and press play. From then on, four rules
          decide everything, and you just watch what grows.
        </p>
        <p className={styles.text}>
          The British mathematician John Conway came up with it in 1970. Martin
          Gardner described it in his Mathematical Games column in Scientific
          American that October, and readers started mailing in the patterns
          they found.
        </p>

        <section className={styles.section} aria-labelledby="about-rules">
          <h3 id="about-rules">The rules</h3>
          <p className={styles.text}>
            Every generation, each cell counts its 8 neighbors, the cells
            touching it on the sides and corners. Then all cells change at once.
          </p>
          <ul className={styles.rules}>
            {RULES.map((rule) => (
              <li key={rule.title} className={styles.rule}>
                <span className={styles.demo} aria-hidden="true">
                  <Neighborhood rule={rule} />
                  <IonIcon icon={arrowForward} />
                  <Neighborhood rule={rule} after />
                </span>
                <h4>{rule.title}</h4>
                <p>{rule.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="about-notation">
          <h3 id="about-notation">What B3/S23 means</h3>
          <p className={styles.text}>
            It’s the same rules written short: a cell is <strong>B</strong>orn
            with 3 neighbors and <strong>S</strong>urvives with 2 or 3. Change
            the numbers and you get a different world. The Rule menu in Settings
            has a few to try. HighLife (B36/S23) has a pattern that copies
            itself, Seeds (B2/S) explodes into noise, and Day &amp; Night
            (B3678/S34678) looks the same if you swap alive and dead.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="about-why">
          <h3 id="about-why">Why people still study it</h3>
          <p className={styles.text}>
            Those four rules are enough for patterns that move, blink and build.
            Gliders crawl across the field, oscillators repeat forever, and guns
            fire gliders without end. Life is even Turing complete: with enough
            room, you can build a working computer inside it.
          </p>
          <figure className={styles.gun}>
            <div className={styles.gunField}>
              {open && (
                <LifeField pattern="gosperGun" cellSize={6} running={running} />
              )}
              {canRun && (
                <button
                  className={styles.runButton}
                  onClick={() => setRunning((prev) => !prev)}
                >
                  <IonIcon icon={running ? refresh : play} aria-hidden="true" />
                  {running ? 'Reset' : 'Run it'}
                </button>
              )}
            </div>
            <figcaption>
              The Gosper glider gun. Conway offered $50 to the first person who
              could find a pattern that grows forever. Bill Gosper’s team at MIT
              won it in 1970 with this gun, which fires a new glider every 30
              generations.
            </figcaption>
          </figure>
          <p className={styles.text}>
            The Patterns tab has {PATTERN_COUNT} patterns like this one, ready
            to place on the field.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="about-reading">
          <h3 id="about-reading">Read more</h3>
          <ul className={styles.reading}>
            {READING.map((item) => (
              <li key={item.href}>
                <a href={item.href} target="_blank" rel="noreferrer">
                  {item.label}
                </a>
                <span>{item.note}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <footer className={styles.foot}>
        <button className={styles.button} onClick={onBrowsePatterns}>
          Browse patterns
        </button>
        <button
          className={`${styles.button} ${styles.buttonPrimary}`}
          onClick={onStartTour}
        >
          Show me around
        </button>
      </footer>
    </Dialog>
  );
}
