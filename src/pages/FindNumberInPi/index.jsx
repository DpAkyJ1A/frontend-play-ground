import { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { arrowUp } from 'ionicons/icons';
import styles from './index.module.css';
import { Header } from '@/layout';
import { Typewriter } from '@/components';
import { prefersReducedMotion } from '@/utils/helpers';
import Digits from './Digits';

const DIGITS_URL = `${import.meta.env.BASE_URL}pi/digits-5m.txt`;
const DIGITS_COUNT = 5000000;
const MAX_QUERY_LENGTH = 30;
const SCROLL_IDLE = 150;

const formatCount = (value) => value.toLocaleString('en-US');

const waitForScrollEnd = (callback) => {
  let timeout = setTimeout(finish, SCROLL_IDLE * 2);

  function onScroll() {
    clearTimeout(timeout);
    timeout = setTimeout(finish, SCROLL_IDLE);
  }

  function finish() {
    window.removeEventListener('scroll', onScroll);
    callback();
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    clearTimeout(timeout);
    window.removeEventListener('scroll', onScroll);
  };
};

export default function FindNumberInPi() {
  const [digits, setDigits] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const markRef = useRef(null);
  const barRef = useRef(null);
  const searchCount = useRef(0);

  const match = result && result.start >= 0 ? result : null;

  useEffect(() => {
    const controller = new AbortController();

    fetch(DIGITS_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(response.statusText);
        return response.text();
      })
      .then(setDigits)
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError(true);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > window.innerHeight);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!match) return;

    const mark = markRef.current;
    const { top, bottom } = mark.getBoundingClientRect();
    const visibleTop = barRef.current.getBoundingClientRect().bottom;

    if (top >= visibleTop && bottom <= window.innerHeight) {
      setRevealed(true);
      return;
    }

    mark.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'center',
    });

    return waitForScrollEnd(() => setRevealed(true));
  }, [match]);

  const changeHandler = (e) => {
    setQuery(e.target.value.replace(/\D/g, '').slice(0, MAX_QUERY_LENGTH));
  };

  const submitHandler = (e) => {
    e.preventDefault();
    if (!digits || !query) return;

    searchCount.current += 1;
    const start = digits.indexOf(query);

    setRevealed(false);
    setResult({
      id: searchCount.current,
      query,
      start,
      length: query.length,
    });
    if (start === -1) setIsShaking(true);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  const status = (() => {
    if (loadError) return 'Couldn’t load the digits. Refresh to try again.';
    if (!digits) return `Loading ${formatCount(DIGITS_COUNT)} digits…`;
    if (!result)
      return 'Tip: six digits are almost always here — try a birthday as DDMMYY.';
    if (result.start === -1)
      return `${result.query} isn’t in the first ${formatCount(
        DIGITS_COUNT
      )} digits.`;
    return `${result.query} starts at decimal place ${formatCount(
      result.start + 1
    )}.`;
  })();

  return (
    <div className={styles.findNumberInPiPage}>
      <Header>
        <h2 className={styles.pageTitle}>Find Your Number in Pi</h2>
      </Header>
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.title}>
            <Typewriter text="Find your number in the first 5M digits of π" />
          </h1>
          <p className={styles.lede}>
            Birthdays, phone numbers, PINs — search the first five million
            decimal places and see exactly where your number sits among them.
          </p>
        </section>
        <div ref={barRef} className={styles.searchBar}>
          <form className={styles.search} onSubmit={submitHandler}>
            <input
              className={`${styles.input} ${isShaking ? styles.shake : ''}`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Search…"
              aria-label="Number to find in pi"
              value={query}
              onChange={changeHandler}
              onAnimationEnd={() => setIsShaking(false)}
            />
            <button
              className={styles.button}
              type="submit"
              disabled={!digits || !query}
            >
              Find me!
            </button>
          </form>
          <p
            className={`${styles.status} ${
              result?.start === -1 ? styles.status__missing : ''
            }`}
            role="status"
          >
            {status}
          </p>
        </div>
        {digits && (
          <Digits
            digits={digits}
            match={match}
            revealed={revealed}
            markRef={markRef}
          />
        )}
      </main>
      <button
        className={`${styles.toTop} ${isScrolled ? styles.toTop__visible : ''}`}
        aria-label="Back to top"
        title="Back to top"
        onClick={scrollToTop}
      >
        <IonIcon icon={arrowUp} />
      </button>
    </div>
  );
}
