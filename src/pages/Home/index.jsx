import { useRef, useState } from 'react';
import styles from './index.module.css';
import { Link } from 'react-router-dom';
import { THE_GAME_OF_LIFE_ULTIMATE_ROUTE } from '@/utils/constants/routes';
import { Header } from '@/layout';
import { LifeField } from '@/components';

export default function Home() {
  const titleRef = useRef();
  const [activeCard, setActiveCard] = useState(null);

  const cardsData = [
    {
      name: 'The Game of Life Ultimate',
      description:
        'Conway’s Life with custom rules, wrap-around edges, color presets and speeds up to 1000 generations a second.',
      year: '2024',
      tags: ['Canvas', 'React'],
      pattern: 'gosperGun',
      src: THE_GAME_OF_LIFE_ULTIMATE_ROUTE,
      ref: useRef(),
    },
  ];

  const titleMouseMoveHandler = (e) => {
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

  const mouseMoveHandler = (e) => {
    for (const card of cardsData) {
      const ref = card.ref;
      const rect = ref.current.getBoundingClientRect(),
        x = e.clientX - rect.left,
        y = e.clientY - rect.top;

      ref.current.style.setProperty('--mouse-x', `${x}px`);
      ref.current.style.setProperty('--mouse-y', `${y}px`);
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
                ref={card.ref}
                key={i}
                className={styles.card}
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
                    <LifeField
                      pattern={card.pattern}
                      running={activeCard === i}
                    />
                  </div>
                  <div className={styles.cardInfo}>
                    <h3>{card.name}</h3>
                    <p>{card.description}</p>
                  </div>
                </div>
                <Link
                  to={card.src}
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
