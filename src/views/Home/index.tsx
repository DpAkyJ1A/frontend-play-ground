'use client';

import { useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import styles from './index.module.css';
import Link from 'next/link';
import {
  THE_GAME_OF_LIFE_ULTIMATE_ROUTE,
  FIND_NUMBER_IN_PI_ROUTE,
  EYE_CONTROL_ROUTE,
} from '@/utils/constants/routes';
import { Header } from '@/layout';
import { GazeField, LifeField, PiField } from '@/components';

const cardsData = [
  {
    name: 'Eye Control',
    description:
      'Steer a page with your eyes: a webcam, a 30-second calibration and a cursor that snaps to the nearest button. Hold your gaze or blink twice to click.',
    year: '2026',
    tags: ['MediaPipe', 'React'],
    glow: '#ff6a3d',
    renderPreview: (running: boolean) => <GazeField running={running} />,
    src: EYE_CONTROL_ROUTE,
  },
  {
    name: 'The Game of Life Ultimate',
    description:
      'Conway’s Life you can draw on, with custom rules, wrap-around edges and a bit-packed engine that runs tens of thousands of generations a second.',
    year: '2024',
    tags: ['Canvas', 'React'],
    glow: '#b69cff',
    renderPreview: (running: boolean) => (
      <LifeField pattern="gosperGun" running={running} />
    ),
    src: THE_GAME_OF_LIFE_ULTIMATE_ROUTE,
  },
  {
    name: 'Find Your Number in Pi',
    description:
      'Type a birthday or a phone number, find it in five billion digits of π and see the actual spot — then scroll on through 100 trillion of them.',
    year: '2023',
    tags: ['Search', 'React'],
    glow: '#ff7cbd',
    renderPreview: (running: boolean) => <PiField running={running} />,
    src: FIND_NUMBER_IN_PI_ROUTE,
  },
];

export default function Home() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeCard, setActiveCard] = useState<number | null>(null);

  const titleMouseMoveHandler = (e: MouseEvent<HTMLDivElement>) => {
    if (!titleRef.current) return;
    const rect = titleRef.current.getBoundingClientRect();
    titleRef.current.style.setProperty(
      '--light-x',
      `${e.clientX - rect.left}px`
    );
    titleRef.current.style.setProperty(
      '--light-y',
      `${e.clientY - rect.top}px`
    );
  };

  const mouseMoveHandler = (e: MouseEvent<HTMLDivElement>) => {
    for (const card of cardRefs.current) {
      if (!card) continue;
      const rect = card.getBoundingClientRect(),
        x = e.clientX - rect.left,
        y = e.clientY - rect.top;

      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    }
  };

  return (
    <div className={styles.homePage} onMouseMove={titleMouseMoveHandler}>
      <Header>
        <a
          className={styles.source}
          href="https://github.com/DpAkyJ1A/frontend-play-ground"
          target="_blank"
          rel="noreferrer"
        >
          Source on GitHub
        </a>
      </Header>
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 ref={titleRef} className={styles.header}>
            Frontend Play Ground
          </h1>
          <p className={styles.lede}>
            A place to learn new tech, build animations and small projects, and
            make things just for the fun of it.
          </p>
        </section>
        <section className={styles.experiments} aria-labelledby="experiments">
          <div className={styles.sectionHead}>
            <h2 id="experiments">Experiments</h2>
            <span className={styles.count}>{cardsData.length}</span>
          </div>
          <div className={styles.cardList} onMouseMove={mouseMoveHandler}>
            {cardsData.map((card, i) => (
              <div
                ref={(node) => {
                  cardRefs.current[i] = node;
                }}
                key={i}
                className={styles.card}
                style={{ '--glow': card.glow } as CSSProperties}
                onMouseEnter={() => setActiveCard(i)}
                onMouseLeave={() => setActiveCard(null)}
              >
                <div className={styles.cardContent}>
                  <div className={styles.cardMeta}>
                    <span>{card.year}</span>
                    <ul className={styles.tags}>
                      {card.tags.map((tag) => (
                        <li key={tag}>{tag}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={styles.cardPreview}>
                    {card.renderPreview(activeCard === i)}
                  </div>
                  <div className={styles.cardInfo}>
                    <h3>{card.name}</h3>
                    <p>{card.description}</p>
                  </div>
                </div>
                <Link
                  href={card.src}
                  className={styles.link}
                  aria-label={card.name}
                  onFocus={() => setActiveCard(i)}
                  onBlur={() => setActiveCard(null)}
                />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
