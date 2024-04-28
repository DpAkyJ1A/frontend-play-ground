import { useRef } from 'react';
import styles from './index.module.css';
import { Link } from 'react-router-dom';
import { THE_GAME_OF_LIFE_ULTIMATE_ROUTE } from '@/utils/constants/routes';
import { Header } from '@/layout';

export default function Home() {
  const cardsData = [
    {
      name: 'The Game Of Life Ultimate',
      description: 'The Game Of Life, but with all possible features!',
      src: THE_GAME_OF_LIFE_ULTIMATE_ROUTE,
      ref: useRef(),
    },
  ];

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
    <div className={styles.homePage}>
      <Header />
      <main>
        <h1 className={styles.header}>Frontend Play Ground</h1>
        <div className={styles.cardList} onMouseMove={mouseMoveHandler}>
          {cardsData.map((card, i) => (
            <div ref={card.ref} key={i} className={styles.card}>
              <div className={styles.cardContent}>
                <div className={styles.cardInfo}>
                  <h3>{card.name}</h3>
                  <h4>{card.description}</h4>
                </div>
              </div>
              <Link to={card.src} className={styles.link} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
