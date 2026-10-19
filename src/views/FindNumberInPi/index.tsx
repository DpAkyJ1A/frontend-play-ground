'use client';

import {
  type ChangeEvent,
  type CSSProperties,
  type SubmitEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Icon from '@/components/Icon';
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
  ShareIcon,
} from 'lucide-react';
import styles from './index.module.css';
import { Header } from '@/layout';
import { Typewriter } from '@/components';
import { prefersReducedMotion } from '@/utils/helpers';
import { withBasePath } from '@/lib/site';
import { PRINTOUT_FONT } from '@/lib/fonts/printout';
import Viewer, { type Match, type ViewerHandle } from './Viewer';
import About from './About';
import { createDigitStore, TOTAL_DIGITS } from './digitStore';
import {
  countOccurrences,
  findLocal,
  knownTotal,
  lookup,
  SEARCH_DEPTH,
} from './piSearch';

const TITLE = 'Find your number in 5\u00a0billion digits of π';
const PAGE_TITLE = 'Find Your Number in Pi · Frontend Play Ground';
const LOCAL_URL = withBasePath('/pi/digits-5m.txt');
const MAX_QUERY_LENGTH = 30;
const MAX_PLACE_LENGTH = String(TOTAL_DIGITS).length;
const MAX_PLACE_INPUT = TOTAL_DIGITS.toLocaleString('en-US').length;
const PLACE_SYNC_DELAY = 600;
const COPIED_DURATION = 1800;

type SearchBase = {
  id: number;
  query: string;
  /** 0-based; shown as `occurrence + 1`. */
  occurrence: number;
  /** Occurrences in the first SEARCH_DEPTH digits; `null` until counted. */
  total: number | null;
  /** 0-based decimal place of the occurrence on screen, once one was found. */
  start?: number;
};

// One member per status so a status check narrows `start` once found.
type Search = SearchBase &
  (
    | { status: 'found'; start: number }
    | { status: 'searching' }
    | { status: 'missing' }
    | { status: 'failed' }
  );

/** A search that has put an occurrence on screen, so it can step from it. */
type LocatedSearch = Search & { start: number };

type SearchUpdate = { status: 'missing' | 'failed' };

type UrlParams = Record<string, string>;

type PlaceForm = HTMLFormElement & {
  readonly elements: HTMLFormControlsCollection & { place: HTMLInputElement };
};

const formatCount = (value: number) => value.toLocaleString('en-US');

const digitsOnly = (value: string | null, maxLength: number) =>
  (value ?? '').replace(/\D/g, '').slice(0, maxLength);

const toSearch = (params: UrlParams) => {
  const search = new URLSearchParams(params).toString();
  return search ? `?${search}` : '';
};

const resultParams = (query: string, occurrence: number): UrlParams =>
  occurrence > 0 ? { q: query, n: String(occurrence + 1) } : { q: query };

const isLocated = (search: Search | null): search is LocatedSearch =>
  search?.start !== undefined;

export default function FindNumberInPi() {
  const [store] = useState(createDigitStore);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<Search | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [place, setPlace] = useState(1);
  const [placeDraft, setPlaceDraft] = useState<string | null>(null);
  const [barHeight, setBarHeight] = useState(0);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const offline = useSyncExternalStore(
    store.subscribe,
    store.isOffline,
    store.isOffline
  );
  const viewerRef = useRef<ViewerHandle>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aboutButtonRef = useRef<HTMLButtonElement>(null);
  const searchCount = useRef(0);
  const searchController = useRef<AbortController | null>(null);
  const placeSynced = useRef(false);
  const localLoad = useRef<Promise<unknown>>(null);

  const writeUrl = useCallback((params: UrlParams, replace = false) => {
    const next = toSearch(params);
    if (next !== window.location.search) {
      const url = `${window.location.pathname}${next}`;
      if (replace) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    }
  }, []);

  useEffect(() => {
    localLoad.current = store.loadLocal(LOCAL_URL).catch(() => {});
    return () => {
      searchController.current?.abort();
      store.dispose();
    };
  }, [store]);

  useEffect(() => {
    const bar = barRef.current!;
    const resizeObserver = new ResizeObserver(() =>
      setBarHeight(bar.offsetHeight)
    );
    resizeObserver.observe(bar);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const { scrollRestoration } = window.history;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = scrollRestoration;
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
      writeUrl(place > 1 ? { place: String(place) } : {}, true);
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
      viewerRef.current!.scrollToIndex(match.start, {
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

  // A hit in the local digits comes without a count, so it's asked for here,
  // once per query: stepping through the occurrences doesn't restart it.
  const countQuery =
    search?.start !== undefined && search.total === null ? search.query : null;

  useEffect(() => {
    if (countQuery === null) return;
    const controller = new AbortController();
    countOccurrences(countQuery, controller.signal)
      .then((total) =>
        setSearch((prev) =>
          prev?.query === countQuery && prev.total === null
            ? { ...prev, total }
            : prev
        )
      )
      .catch(() => {});
    return () => controller.abort();
  }, [countQuery]);

  const showOccurrence = (
    id: number,
    searchQuery: string,
    occurrence: number,
    start: number,
    total: number | null
  ) => {
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

  const updateSearch = (id: number, changes: SearchUpdate) =>
    setSearch((prev) => (prev?.id === id ? { ...prev, ...changes } : prev));

  const locate = async (
    searchQuery: string,
    occurrence: number,
    current: LocatedSearch | null
  ) => {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    searchCount.current += 1;
    const id = searchCount.current;
    const total = current?.total ?? knownTotal(searchQuery);

    setSearch(
      current
        ? { ...current, id, status: 'searching', occurrence }
        : { id, query: searchQuery, status: 'searching', occurrence, total }
    );

    // PiSearch needs 4–45 s to place a one- or two-digit number, and the local
    // digits have every one of them near the start, so wait for those instead.
    if (store.getLocal() === null && knownTotal(searchQuery) !== null) {
      await localLoad.current;
      if (controller.signal.aborted) return;
    }

    const localIndex = findLocal(
      store.getLocal(),
      searchQuery,
      occurrence,
      current
    );

    if (localIndex >= 0) {
      showOccurrence(id, searchQuery, occurrence, localIndex, total);
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

  const applyUrl = (urlSearch: string, initial: boolean) => {
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
      viewerRef.current!
        .scrollToIndex(linkedPlace - 1, { align: 'top' })
        .then(() => {
          placeSynced.current = true;
        });
      return;
    }

    placeSynced.current = true;
    if (!initial) viewerRef.current!.scrollToStart();
  };

  const applyUrlRef = useRef(applyUrl);

  useEffect(() => {
    applyUrlRef.current = applyUrl;
  });

  useEffect(() => {
    applyUrlRef.current(window.location.search, true);
    const onPopState = () => applyUrlRef.current(window.location.search, false);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const changeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value.replace(/\D/g, '').slice(0, MAX_QUERY_LENGTH));
  };

  const submitHandler = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!query) return;
    writeUrl({ q: query });
    locate(query, 0, null);
  };

  const stepOccurrence = (step: number) => {
    if (!isLocated(search)) return;
    const occurrence = search.occurrence + step;
    writeUrl(resultParams(search.query, occurrence), true);
    locate(search.query, occurrence, search);
  };

  const shareResult = () => {
    if (!search) return;
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

  const placeSubmitHandler = (e: SubmitEvent<PlaceForm>) => {
    e.preventDefault();
    const target = Math.min(
      Math.max(Number(digitsOnly(placeDraft, MAX_PLACE_INPUT)) || 1, 1),
      TOTAL_DIGITS
    );
    writeUrl({ place: String(target) });
    viewerRef.current?.scrollToIndex(target - 1, { align: 'top' });
    e.currentTarget.elements.place.blur();
  };

  const closeAbout = (reason: string) => {
    setIsAboutOpen(false);
    (reason === 'start' ? inputRef : aboutButtonRef).current?.focus();
  };

  const scrollToTop = () => {
    viewerRef.current?.scrollToStart(!prefersReducedMotion());
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
    search !== null &&
    search.total !== null &&
    search.occurrence + 1 >= search.total;
  const placeValue = placeDraft ?? formatCount(place);

  return (
    <div
      className={styles.findNumberInPiPage}
      style={{ '--font-printout': PRINTOUT_FONT } as CSSProperties}
    >
      <Header>
        <h2 className={styles.pageTitle}>Find Your Number in Pi</h2>
        <button
          ref={aboutButtonRef}
          className={styles.aboutButton}
          aria-label="About this experiment"
          onClick={() => setIsAboutOpen(true)}
        >
          <Icon icon={InfoIcon} aria-hidden="true" />
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
                  <Icon icon={ChevronLeftIcon} />
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
                  <Icon icon={ChevronRightIcon} />
                </button>
                <button
                  className={styles.shareButton}
                  disabled={search.status !== 'found'}
                  onClick={shareResult}
                >
                  <Icon
                    icon={isCopied ? CheckIcon : ShareIcon}
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
        <Icon icon={ArrowUpIcon} />
      </button>
      <About open={isAboutOpen} onClose={closeAbout} />
    </div>
  );
}
