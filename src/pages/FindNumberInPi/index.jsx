import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { IonIcon } from '@ionic/react';
import {
  arrowUp,
  chevronBack,
  chevronForward,
  informationCircleOutline,
} from 'ionicons/icons';
import styles from './index.module.css';
import { Header } from '@/layout';
import { Typewriter } from '@/components';
import { prefersReducedMotion } from '@/utils/helpers';
import Viewer from './Viewer';
import About from './About';
import { createDigitStore, TOTAL_DIGITS } from './digitStore';
import { findLocal, lookup, SEARCH_DEPTH } from './piSearch';

const TITLE = 'Find your number in 5\u00a0billion digits of π';
const LOCAL_URL = `${import.meta.env.BASE_URL}pi/digits-5m.txt`;
const MAX_QUERY_LENGTH = 30;
const MAX_PLACE_LENGTH = String(TOTAL_DIGITS).length;

const formatCount = (value) => value.toLocaleString('en-US');

export default function FindNumberInPi() {
  const [store] = useState(createDigitStore);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(null);
  const [match, setMatch] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [place, setPlace] = useState(1);
  const [placeDraft, setPlaceDraft] = useState(null);
  const [barHeight, setBarHeight] = useState(0);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const offline = useSyncExternalStore(store.subscribe, store.isOffline);
  const viewerRef = useRef(null);
  const barRef = useRef(null);
  const inputRef = useRef(null);
  const aboutButtonRef = useRef(null);
  const searchCount = useRef(0);
  const searchController = useRef(null);

  useEffect(() => {
    store.loadLocal(LOCAL_URL).catch(() => {});
    return () => {
      searchController.current?.abort();
      store.dispose();
    };
  }, [store]);

  useEffect(() => {
    const bar = barRef.current;
    const resizeObserver = new ResizeObserver(() =>
      setBarHeight(bar.offsetHeight)
    );
    resizeObserver.observe(bar);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > window.innerHeight);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!match) return;

    let cancelled = false;
    Promise.all([
      viewerRef.current.scrollToIndex(match.start, {
        smooth: !prefersReducedMotion(),
      }),
      store.ensure(match.start, match.length),
    ]).then(() => {
      if (!cancelled) setRevealed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [match, store]);

  const showOccurrence = (id, searchQuery, occurrence, start, total) => {
    setSearch({
      id,
      query: searchQuery,
      status: 'found',
      occurrence,
      start,
      total,
    });
    setMatch({ id, start, length: searchQuery.length });
    setRevealed(false);
  };

  const updateSearch = (id, changes) =>
    setSearch((prev) => (prev?.id === id ? { ...prev, ...changes } : prev));

  const locate = async (searchQuery, occurrence, current) => {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    searchCount.current += 1;
    const id = searchCount.current;
    const total = current?.total ?? null;

    setSearch(
      current
        ? { ...current, id, status: 'searching', occurrence }
        : { id, query: searchQuery, status: 'searching', occurrence, total }
    );

    const localIndex = findLocal(
      store.getLocal(),
      searchQuery,
      occurrence,
      current
    );

    if (localIndex >= 0) {
      showOccurrence(id, searchQuery, occurrence, localIndex, total);
      if (total === null) {
        lookup(searchQuery, 0, controller.signal)
          .then((counted) => updateSearch(id, { total: counted.total }))
          .catch(() => {});
      }
      return;
    }

    try {
      const result = await lookup(searchQuery, occurrence, controller.signal);
      if (result.index !== null) {
        showOccurrence(id, searchQuery, occurrence, result.index, result.total);
        return;
      }
      updateSearch(id, { status: 'missing' });
    } catch {
      if (controller.signal.aborted) return;
      updateSearch(id, { status: 'failed' });
    }

    if (!current) {
      setMatch(null);
      setIsShaking(true);
    }
  };

  const changeHandler = (e) => {
    setQuery(e.target.value.replace(/\D/g, '').slice(0, MAX_QUERY_LENGTH));
  };

  const submitHandler = (e) => {
    e.preventDefault();
    if (query) locate(query, 0, null);
  };

  const stepOccurrence = (step) => {
    locate(search.query, search.occurrence + step, search);
  };

  const placeSubmitHandler = (e) => {
    e.preventDefault();
    const target = Math.min(Math.max(Number(placeDraft) || 1, 1), TOTAL_DIGITS);
    viewerRef.current.scrollToIndex(target - 1, { align: 'top' });
    e.currentTarget.elements.place.blur();
  };

  const closeAbout = (reason) => {
    setIsAboutOpen(false);
    (reason === 'start' ? inputRef : aboutButtonRef).current?.focus();
  };

  const scrollToTop = () => {
    viewerRef.current.scrollToStart(!prefersReducedMotion());
  };

  const status = (() => {
    if (!search) return 'Tip: every date written as DDMMYYYY is in here.';

    const { query: searched, status: state, occurrence, start } = search;
    if (state === 'searching' && occurrence > 0) {
      return `Looking for occurrence ${formatCount(occurrence + 1)}…`;
    }
    if (state === 'searching') {
      return `Searching ${formatCount(SEARCH_DEPTH)} digits for ${searched}…`;
    }
    if (state === 'missing') {
      return `${searched} isn’t in the first ${formatCount(
        SEARCH_DEPTH
      )} digits.`;
    }
    if (state === 'failed') {
      return 'The search service isn’t responding. Try again in a moment.';
    }
    return `${searched} at decimal place ${formatCount(start + 1)}`;
  })();

  const hasOccurrences = search?.start !== undefined;
  const isSearching = search?.status === 'searching';
  const isLastOccurrence =
    search?.total !== null && search?.occurrence + 1 >= search?.total;
  const placeValue = placeDraft ?? formatCount(place);

  return (
    <div className={styles.findNumberInPiPage}>
      <Header>
        <h2 className={styles.pageTitle}>Find Your Number in Pi</h2>
        <button
          ref={aboutButtonRef}
          className={styles.aboutButton}
          aria-label="About this experiment"
          onClick={() => setIsAboutOpen(true)}
        >
          <IonIcon icon={informationCircleOutline} aria-hidden="true" />
          <span className={styles.aboutLabel}>About</span>
        </button>
      </Header>
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.title}>
            <Typewriter text={TITLE} />
          </h1>
          <p className={styles.lede}>
            Birthdays, phone numbers, PINs — search five billion decimal places,
            see exactly where your number sits, then keep scrolling through up
            to 100 trillion digits.
          </p>
        </section>
        <div ref={barRef} className={styles.searchBar}>
          <form className={styles.search} onSubmit={submitHandler}>
            <input
              ref={inputRef}
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
            <button className={styles.button} type="submit" disabled={!query}>
              Find me!
            </button>
          </form>
          <div className={styles.result}>
            <p
              className={`${styles.status} ${
                search?.status === 'missing' || search?.status === 'failed'
                  ? styles.status__error
                  : ''
              }`}
              role="status"
            >
              {status}
            </p>
            {hasOccurrences && (
              <div className={styles.occurrences}>
                <button
                  className={styles.stepButton}
                  aria-label="Previous occurrence"
                  title="Previous occurrence"
                  disabled={isSearching || search.occurrence === 0}
                  onClick={() => stepOccurrence(-1)}
                >
                  <IonIcon icon={chevronBack} />
                </button>
                <span
                  className={styles.counter}
                  title={`Occurrences in the first ${formatCount(
                    SEARCH_DEPTH
                  )} digits`}
                >
                  {formatCount(search.occurrence + 1)} of{' '}
                  {search.total === null ? '…' : formatCount(search.total)}
                </span>
                <button
                  className={styles.stepButton}
                  aria-label="Next occurrence"
                  title="Next occurrence"
                  disabled={isSearching || isLastOccurrence}
                  onClick={() => stepOccurrence(1)}
                >
                  <IonIcon icon={chevronForward} />
                </button>
              </div>
            )}
          </div>
          {offline && (
            <p className={styles.notice}>
              pi.delivery isn’t responding — digits past the first five million
              may not load right now.
            </p>
          )}
        </div>
        <Viewer
          ref={viewerRef}
          store={store}
          match={match}
          revealed={revealed}
          topInset={barHeight}
          onPlaceChange={setPlace}
        />
      </main>
      <form className={styles.place} onSubmit={placeSubmitHandler}>
        <label className={styles.placeLabel} htmlFor="place">
          Place
        </label>
        <input
          id="place"
          name="place"
          className={styles.placeInput}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          title="Jump to any decimal place up to 100 trillion"
          value={placeValue}
          style={{ width: `${placeValue.length + 1}ch` }}
          onFocus={(e) => {
            const input = e.currentTarget;
            setPlaceDraft(String(place));
            requestAnimationFrame(() => input.select());
          }}
          onBlur={() => setPlaceDraft(null)}
          onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
          onChange={(e) =>
            setPlaceDraft(
              e.target.value.replace(/\D/g, '').slice(0, MAX_PLACE_LENGTH)
            )
          }
        />
      </form>
      <button
        className={`${styles.toTop} ${isScrolled ? styles.toTop__visible : ''}`}
        aria-label="Back to top"
        title="Back to top"
        onClick={scrollToTop}
      >
        <IonIcon icon={arrowUp} />
      </button>
      <About open={isAboutOpen} onClose={closeAbout} />
    </div>
  );
}
