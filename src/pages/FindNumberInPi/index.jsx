import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { IonIcon } from '@ionic/react';
import {
  arrowUp,
  checkmark,
  chevronBack,
  chevronForward,
  informationCircleOutline,
  shareOutline,
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
const PAGE_TITLE = 'Find Your Number in Pi · Frontend Play Ground';
const LOCAL_URL = `${import.meta.env.BASE_URL}pi/digits-5m.txt`;
const MAX_QUERY_LENGTH = 30;
const MAX_PLACE_LENGTH = String(TOTAL_DIGITS).length;
const MAX_PLACE_INPUT = TOTAL_DIGITS.toLocaleString('en-US').length;
const PLACE_SYNC_DELAY = 600;
const COPIED_DURATION = 1800;

const formatCount = (value) => value.toLocaleString('en-US');

const digitsOnly = (value, maxLength) =>
  (value ?? '').replace(/\D/g, '').slice(0, maxLength);

const toSearch = (params) => {
  const search = new URLSearchParams(params).toString();
  return search ? `?${search}` : '';
};

const resultParams = (query, occurrence) =>
  occurrence > 0 ? { q: query, n: occurrence + 1 } : { q: query };

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
  const [isCopied, setIsCopied] = useState(false);
  const offline = useSyncExternalStore(store.subscribe, store.isOffline);
  const viewerRef = useRef(null);
  const barRef = useRef(null);
  const inputRef = useRef(null);
  const aboutButtonRef = useRef(null);
  const searchCount = useRef(0);
  const searchController = useRef(null);
  const placeSynced = useRef(false);
  const isMounted = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  const writeUrl = useCallback(
    (params, replace = false) => {
      const next = toSearch(params);
      if (next !== window.location.search) {
        navigate({ search: next }, { replace });
      }
    },
    [navigate]
  );

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
    const { scrollRestoration } = window.history;
    const previousTitle = document.title;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = scrollRestoration;
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    document.title =
      search?.status === 'found'
        ? `${search.query} in π — decimal place ${formatCount(
            search.start + 1
          )}`
        : PAGE_TITLE;
  }, [search]);

  useEffect(() => {
    if (!placeSynced.current) return;
    const timeout = setTimeout(() => {
      if (new URLSearchParams(window.location.search).has('q')) return;
      writeUrl(place > 1 ? { place } : {}, true);
    }, PLACE_SYNC_DELAY);
    return () => clearTimeout(timeout);
  }, [place, writeUrl]);

  useEffect(() => {
    if (!isCopied) return;
    const timeout = setTimeout(() => setIsCopied(false), COPIED_DURATION);
    return () => clearTimeout(timeout);
  }, [isCopied]);

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
      if (occurrence > 0 && !current) {
        locate(searchQuery, 0, null);
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

  const applyUrl = (urlSearch, initial) => {
    const params = new URLSearchParams(urlSearch);
    const linkedQuery = digitsOnly(params.get('q'), MAX_QUERY_LENGTH);
    const linkedPlace = Math.min(
      Number(digitsOnly(params.get('place'), MAX_PLACE_LENGTH)),
      TOTAL_DIGITS
    );

    if (linkedQuery) {
      const occurrence = Math.max(
        Number(digitsOnly(params.get('n'), 9)) - 1,
        0
      );
      placeSynced.current = true;
      setQuery(linkedQuery);
      locate(linkedQuery, occurrence, null);
      return;
    }

    searchController.current?.abort();
    setQuery('');
    setSearch(null);
    setMatch(null);
    setRevealed(false);

    if (linkedPlace > 0) {
      placeSynced.current = false;
      viewerRef.current
        .scrollToIndex(linkedPlace - 1, { align: 'top' })
        .then(() => {
          placeSynced.current = true;
        });
      return;
    }

    placeSynced.current = true;
    if (!initial) viewerRef.current.scrollToStart();
  };

  const applyUrlRef = useRef(applyUrl);

  useEffect(() => {
    applyUrlRef.current = applyUrl;
  });

  useEffect(() => {
    if (isMounted.current && navigationType !== 'POP') return;
    applyUrlRef.current(location.search, !isMounted.current);
    isMounted.current = true;
  }, [location.key, location.search, navigationType]);

  const changeHandler = (e) => {
    setQuery(e.target.value.replace(/\D/g, '').slice(0, MAX_QUERY_LENGTH));
  };

  const submitHandler = (e) => {
    e.preventDefault();
    if (!query) return;
    writeUrl({ q: query });
    locate(query, 0, null);
  };

  const stepOccurrence = (step) => {
    const occurrence = search.occurrence + step;
    writeUrl(resultParams(search.query, occurrence), true);
    locate(search.query, occurrence, search);
  };

  const shareResult = () => {
    const url = new URL(window.location.href);
    url.search = toSearch(resultParams(search.query, search.occurrence));

    if (navigator.share && window.matchMedia('(hover: none)').matches) {
      navigator.share({ title: document.title, url: url.href }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(url.href).then(
      () => setIsCopied(true),
      () => {}
    );
  };

  const placeSubmitHandler = (e) => {
    e.preventDefault();
    const target = Math.min(
      Math.max(Number(digitsOnly(placeDraft, MAX_PLACE_INPUT)) || 1, 1),
      TOTAL_DIGITS
    );
    writeUrl({ place: target });
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
                <button
                  className={styles.shareButton}
                  disabled={search.status !== 'found'}
                  onClick={shareResult}
                >
                  <IonIcon
                    icon={isCopied ? checkmark : shareOutline}
                    aria-hidden="true"
                  />
                  <span aria-live="polite">
                    {isCopied ? 'Link copied' : 'Share'}
                  </span>
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
          onMouseDown={(e) => {
            if (document.activeElement === e.currentTarget) return;
            e.preventDefault();
            e.currentTarget.focus();
          }}
          onFocus={(e) => {
            setPlaceDraft(formatCount(place));
            e.currentTarget.select();
          }}
          onBlur={() => setPlaceDraft(null)}
          onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
          onChange={(e) =>
            setPlaceDraft(
              e.target.value.replace(/[^\d,]/g, '').slice(0, MAX_PLACE_INPUT)
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
