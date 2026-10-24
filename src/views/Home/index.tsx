'use client';

import {
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import styles from './index.module.css';
import Link from 'next/link';
import { ArrowUpRightIcon } from 'lucide-react';
import {
  THE_GAME_OF_LIFE_ULTIMATE_ROUTE,
  FIND_NUMBER_IN_PI_ROUTE,
  EYE_CONTROL_ROUTE,
} from '@/utils/constants/routes';
import { Header } from '@/layout';
import {
  GazeField,
  LifeField,
  NoteField,
  PiField,
  RigField,
} from '@/components';
import Icon from '@/components/Icon';
import ProjectInfo, { type ProjectInfoProps } from './ProjectInfo';

type Card = {
  name: string;
  description: string;
  year: string;
  tags: string[];
  glow: string;
  renderPreview: (running: boolean) => ReactNode;
  src: string;
  about?: Pick<ProjectInfoProps, 'what' | 'why' | 'stack'>;
};

const cardsData: Card[] = [
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
    year: '2025',
    tags: ['Search', 'React'],
    glow: '#ff7cbd',
    renderPreview: (running: boolean) => <PiField running={running} />,
    src: FIND_NUMBER_IN_PI_ROUTE,
  },
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
];

// standalone apps with their own deploys; the cards open them in a new tab
const otherProjectsData: Card[] = [
  {
    name: 'Fadey',
    description:
      'Notes that burn after reading: write one, share the link, and it’s gone after the first read — or after a timer or a set number of views.',
    year: '2024',
    tags: ['Next.js', 'MongoDB'],
    glow: '#97ddeb',
    renderPreview: (running: boolean) => <NoteField running={running} />,
    src: 'https://fadey.vercel.app',
    about: {
      what:
        'An encrypted note you share as a link. It deletes itself once read.',
      why:
        'To pass on a password or a secret without it sitting in a chat forever.',
      stack: ['Next.js', 'TypeScript', 'MongoDB', 'Tailwind', 'GSAP', 'WebGL'],
    },
  },
  {
    name: 'motionrig',
    description:
      'Devs rig it, designers play it: a 3 kB panel to tune durations, curves and distances on the live site, then send the values back to code.',
    year: '2026',
    tags: ['npm', 'TypeScript'],
    glow: '#ffd400',
    renderPreview: (running: boolean) => <RigField running={running} />,
    src: 'https://motionrig.vercel.app',
    about: {
      what:
        'An open-source library that puts a site’s motion on a live panel.',
      why:
        'So designers tune motion on the real page instead of describing it.',
      stack: ['TypeScript', 'React', 'Vitest', 'tsdown', 'Next.js', 'GSAP'],
    },
  },
];

export default function Home() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [activeCard, setActiveCard] = useState<string | null>(null);

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
    for (const card of e.currentTarget.children) {
      const rect = card.getBoundingClientRect(),
        x = e.clientX - rect.left,
        y = e.clientY - rect.top;

      (card as HTMLElement).style.setProperty('--mouse-x', `${x}px`);
      (card as HTMLElement).style.setProperty('--mouse-y', `${y}px`);
    }
  };

  const renderCards = (cards: Card[]) => (
    <div className={styles.cardList} onMouseMove={mouseMoveHandler}>
      {cards.map((card) => {
        const external = card.src.startsWith('https://');
        const linkProps = {
          className: styles.link,
          onFocus: () => setActiveCard(card.name),
          onBlur: () => setActiveCard(null),
        };

        return (
          <div
            key={card.name}
            className={`${styles.card} ${card.about ? styles.withInfo : ''}`}
            style={{ '--glow': card.glow } as CSSProperties}
            onMouseEnter={() => setActiveCard(card.name)}
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
                {card.renderPreview(activeCard === card.name)}
              </div>
              <div className={styles.cardInfo}>
                <h3>
                  {card.name}
                  {external && (
                    <Icon icon={ArrowUpRightIcon} className={styles.external} />
                  )}
                </h3>
                <p>{card.description}</p>
              </div>
            </div>
            {external ? (
              <a
                {...linkProps}
                href={card.src}
                target="_blank"
                rel="noreferrer"
                aria-label={`${card.name} (opens in a new tab)`}
              />
            ) : (
              <Link {...linkProps} href={card.src} aria-label={card.name} />
            )}
            {card.about && (
              <ProjectInfo name={card.name} href={card.src} {...card.about} />
            )}
          </div>
        );
      })}
    </div>
  );

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
        <section className={styles.section} aria-labelledby="experiments">
          <div className={styles.sectionHead}>
            <h2 id="experiments">Experiments</h2>
            <span className={styles.count}>{cardsData.length}</span>
          </div>
          {renderCards(cardsData)}
        </section>
        <section className={styles.section} aria-labelledby="other-projects">
          <div className={styles.sectionHead}>
            <h2 id="other-projects">Other projects</h2>
            <span className={styles.count}>{otherProjectsData.length}</span>
            <span className={styles.sectionNote}>
              Standalone apps · open in a new tab
            </span>
          </div>
          {renderCards(otherProjectsData)}
        </section>
      </main>
    </div>
  );
}
