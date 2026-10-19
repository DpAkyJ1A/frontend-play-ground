import {
  type CSSProperties,
  type ReactElement,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { flushSync } from 'react-dom';
import styles from './index.module.css';
import Callout from '../Callout';
import { TOTAL_DIGITS, blocksOf, type DigitStore } from '../digitStore';

/** The digits to highlight; `start` is a 0-based index into the decimals. */
export type Match = { id: number; start: number; length: number };

type ScrollToIndexOptions = { smooth?: boolean; align?: 'center' | 'top' };

export type ViewerHandle = {
  scrollToIndex: (
    index: number,
    options?: ScrollToIndexOptions
  ) => Promise<void>;
  scrollToStart: (smooth?: boolean) => Promise<void>;
};

type Props = {
  store: DigitStore;
  match: Match | null;
  revealed: boolean;
  topInset: number;
  onPlaceChange: (place: number) => void;
};

/** The rendered slice of the scroll window, in rows. */
type Frame = {
  start: number;
  end: number;
  baseRow: number;
  cols: number;
  rowHeight: number;
  windowRows: number;
};

type Highlight = {
  id: number;
  from: number;
  to: number;
  isEnd: boolean;
  position: number;
  revealed: boolean;
};

type RowProps = {
  digits: string | null;
  length: number;
  isFirst: boolean;
  highlight: Highlight | null;
};

const WINDOW_HEIGHT = 4000000;
const EDGE_SHARE = 0.1;
const OVERSCAN_ROWS = 10;
const PROBE = '0'.repeat(100);
const SCROLL_IDLE = 150;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const waitForScrollEnd = (callback: () => void) => {
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

const renderDigits = (
  digits: string | null,
  length: number,
  highlight: Highlight | null
) => {
  if (digits === null) return '·'.repeat(length);
  if (!highlight) return digits;

  const { id, from, to, isEnd, position, revealed } = highlight;
  return (
    <>
      {digits.slice(0, from)}
      <mark key={id} className={styles.mark} data-revealed={revealed}>
        {digits.slice(from, to)}
      </mark>
      {isEnd && revealed && (
        <Callout key={`callout-${id}`} position={position} />
      )}
      {digits.slice(to)}
    </>
  );
};

const Row = memo(function Row({
  digits,
  length,
  isFirst,
  highlight,
}: RowProps) {
  return (
    <div
      className={`${styles.row} ${isFirst ? styles.firstRow : ''}`}
      data-pending={digits === null}
    >
      {isFirst && <span className={styles.integer}>3.</span>}
      {renderDigits(digits, length, highlight)}
    </div>
  );
});

const Viewer = memo(
  forwardRef<ViewerHandle, Props>(function Viewer(
    { store, match, revealed, topInset, onPlaceChange },
    ref
  ) {
    const rootRef = useRef<HTMLDivElement>(null);
    const spacerRef = useRef<HTMLDivElement>(null);
    const probeRef = useRef<HTMLSpanElement>(null);
    const insetRef = useRef(topInset);
    const stopSettling = useRef<(() => void) | null>(null);
    const model = useRef({
      cols: 0,
      rowHeight: 0,
      totalRows: 0,
      windowRows: 0,
      baseRow: 0,
      place: 0,
      settling: false,
    });
    const [frame, setFrame] = useState<Frame | null>(null);
    const [ready] = useState(() => {
      let resolve!: () => void;
      const promise = new Promise<void>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    });

    useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);

    const visibleRows = useCallback(() => {
      const m = model.current;
      const top = spacerRef.current!.getBoundingClientRect().top;
      const first = clamp(
        Math.floor((insetRef.current - top) / m.rowHeight),
        0,
        m.windowRows - 1
      );
      const last = clamp(
        Math.ceil((window.innerHeight - top) / m.rowHeight),
        first + 1,
        m.windowRows
      );
      return { first: m.baseRow + first, last: m.baseRow + last };
    }, []);

    const refresh = useCallback(() => {
      const m = model.current;
      if (!m.cols) return;

      const { first, last } = visibleRows();
      const start = Math.max(first - OVERSCAN_ROWS, m.baseRow);
      const end = Math.min(last + OVERSCAN_ROWS, m.baseRow + m.windowRows);
      const { cols, rowHeight, baseRow, windowRows } = m;

      setFrame((prev) =>
        prev &&
        prev.start === start &&
        prev.end === end &&
        prev.baseRow === baseRow &&
        prev.cols === cols &&
        prev.rowHeight === rowHeight
          ? prev
          : { start, end, baseRow, cols, rowHeight, windowRows }
      );

      const place = first * cols + 1;
      if (place !== m.place) {
        m.place = place;
        onPlaceChange(place);
      }

      const screen = last - first;
      const blocksIn = (fromRow: number, toRow: number) => {
        const from = clamp(fromRow, 0, m.totalRows) * cols;
        const to = Math.min(clamp(toRow, 0, m.totalRows) * cols, TOTAL_DIGITS);
        return to > from ? blocksOf(from, to - from) : [];
      };
      store.want([
        ...blocksIn(first, last),
        ...blocksIn(last, last + screen),
        ...blocksIn(first - Math.ceil(screen / 2), first),
      ]);
    }, [store, onPlaceChange, visibleRows]);

    const moveWindow = useCallback((row: number) => {
      const m = model.current;
      const baseRow = clamp(
        row - Math.floor(m.windowRows / 2),
        0,
        m.totalRows - m.windowRows
      );
      const shift = (m.baseRow - baseRow) * m.rowHeight;
      m.baseRow = baseRow;
      return shift;
    }, []);

    const update = useCallback(() => {
      const m = model.current;
      if (!m.cols) return;

      if (!m.settling) {
        const { first, last } = visibleRows();
        const edge = Math.floor(m.windowRows * EDGE_SHARE);
        const nearTop = m.baseRow > 0 && first - m.baseRow < edge;
        const nearBottom =
          m.baseRow + m.windowRows < m.totalRows &&
          m.baseRow + m.windowRows - last < edge;

        if (nearTop || nearBottom) {
          const shift = moveWindow(first);
          window.scrollTo({ top: window.scrollY + shift, behavior: 'instant' });
          flushSync(refresh);
          return;
        }
      }

      refresh();
    }, [moveWindow, refresh, visibleRows]);

    const measure = useCallback(() => {
      const m = model.current;
      const rowHeight = parseFloat(
        getComputedStyle(rootRef.current!).getPropertyValue('--row-height')
      );
      const charWidth =
        probeRef.current!.getBoundingClientRect().width / PROBE.length;
      const cols = Math.max(
        Math.floor(spacerRef.current!.clientWidth / charWidth + 1e-6),
        1
      );
      if (!charWidth || (cols === m.cols && rowHeight === m.rowHeight)) return;

      const spacerTop = spacerRef.current!.getBoundingClientRect().top;
      const anchor =
        m.cols && spacerTop < insetRef.current
          ? visibleRows().first * m.cols
          : null;

      m.cols = cols;
      m.rowHeight = rowHeight;
      m.totalRows = Math.ceil(TOTAL_DIGITS / cols);
      m.windowRows = Math.min(
        Math.floor(WINDOW_HEIGHT / rowHeight),
        m.totalRows
      );

      if (anchor === null) {
        m.baseRow = 0;
        flushSync(refresh);
        ready.resolve();
        return;
      }

      const row = Math.floor(anchor / cols);
      moveWindow(row);
      flushSync(refresh);
      const top =
        spacerRef.current!.getBoundingClientRect().top +
        window.scrollY +
        (row - m.baseRow) * rowHeight -
        insetRef.current;
      window.scrollTo({ top, behavior: 'instant' });
      flushSync(refresh);
    }, [moveWindow, ready, refresh, visibleRows]);

    const glide = useCallback(
      (top: number, smooth: boolean) =>
        new Promise<void>((resolve) => {
          const m = model.current;
          stopSettling.current?.();
          m.settling = true;
          window.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' });
          flushSync(refresh);
          stopSettling.current = waitForScrollEnd(() => {
            stopSettling.current = null;
            m.settling = false;
            update();
            resolve();
          });
        }),
      [refresh, update]
    );

    useImperativeHandle(
      ref,
      () => ({
        scrollToIndex: async (
          index,
          { smooth = false, align = 'center' } = {}
        ) => {
          await ready.promise;
          return new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              const m = model.current;
              const row = Math.floor(index / m.cols);
              const inWindow =
                row >= m.baseRow && row < m.baseRow + m.windowRows;
              if (!inWindow) {
                moveWindow(row);
                flushSync(refresh);
              }

              const inset = insetRef.current;
              const rowTop =
                spacerRef.current!.getBoundingClientRect().top +
                window.scrollY +
                (row - m.baseRow) * m.rowHeight;
              const offset =
                align === 'top'
                  ? inset
                  : inset + (window.innerHeight - inset - m.rowHeight) / 2;

              glide(rowTop - offset, smooth && inWindow).then(resolve);
            });
          });
        },

        scrollToStart: (smooth = false) =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              const m = model.current;
              const far = m.baseRow > 0;
              if (far) {
                m.baseRow = 0;
                flushSync(refresh);
              }
              glide(0, smooth && !far).then(resolve);
            });
          }),
      }),
      [glide, moveWindow, ready, refresh]
    );

    useLayoutEffect(() => {
      let frameId = 0;
      const resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(measure);
      });
      resizeObserver.observe(spacerRef.current!);
      resizeObserver.observe(probeRef.current!);
      return () => {
        cancelAnimationFrame(frameId);
        resizeObserver.disconnect();
      };
    }, [measure]);

    useEffect(() => {
      insetRef.current = topInset;
      refresh();
    }, [topInset, refresh]);

    useEffect(() => {
      let frameId = 0;
      const schedule = () => {
        if (frameId) return;
        frameId = requestAnimationFrame(() => {
          frameId = 0;
          update();
        });
      };

      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        stopSettling.current?.();
      };
    }, [update]);

    const highlightFor = (start: number, length: number) => {
      if (!match) return null;
      const end = match.start + match.length;
      if (match.start >= start + length || end <= start) return null;

      return {
        id: match.id,
        from: Math.max(match.start - start, 0),
        to: Math.min(end - start, length),
        isEnd: end <= start + length,
        position: match.start + 1,
        revealed,
      };
    };

    const rows: ReactElement[] = [];
    if (frame) {
      for (let row = frame.start; row < frame.end; row++) {
        const start = row * frame.cols;
        const length = Math.min(frame.cols, TOTAL_DIGITS - start);
        rows.push(
          <Row
            key={row}
            digits={store.read(start, length)}
            length={length}
            isFirst={row === 0}
            highlight={highlightFor(start, length)}
          />
        );
      }
    }

    return (
      <div
        ref={rootRef}
        className={styles.viewer}
        role="region"
        aria-label="Digits of pi"
      >
        <span className={styles.probeBox} aria-hidden="true">
          <span ref={probeRef} className={styles.probe}>
            {PROBE}
          </span>
        </span>
        <div
          ref={spacerRef}
          className={styles.spacer}
          style={
            {
              height: frame ? frame.windowRows * frame.rowHeight : 0,
              // the spacer starts at baseRow; shift the green bars to match
              '--bar-offset': frame
                ? `${-(frame.baseRow % 6) * frame.rowHeight}px`
                : undefined,
            } as CSSProperties
          }
        >
          {frame && (
            <div
              className={styles.rows}
              style={{
                transform: `translateY(${
                  (frame.start - frame.baseRow) * frame.rowHeight
                }px)`,
              }}
            >
              {rows}
            </div>
          )}
        </div>
      </div>
    );
  })
);

export default Viewer;
