import {
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
import { TOTAL_DIGITS, blocksOf } from '../digitStore';

const WINDOW_HEIGHT = 4000000;
const EDGE_SHARE = 0.1;
const OVERSCAN_ROWS = 10;
const PROBE = '0'.repeat(100);
const SCROLL_IDLE = 150;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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

const renderDigits = (digits, length, highlight) => {
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

const Row = memo(function Row({ digits, length, isFirst, highlight }) {
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
  forwardRef(function Viewer(
    { store, match, revealed, topInset, onPlaceChange },
    ref
  ) {
    const rootRef = useRef(null);
    const spacerRef = useRef(null);
    const probeRef = useRef(null);
    const insetRef = useRef(topInset);
    const stopSettling = useRef(null);
    const model = useRef({
      cols: 0,
      rowHeight: 0,
      totalRows: 0,
      windowRows: 0,
      baseRow: 0,
      place: 0,
      settling: false,
    });
    const [frame, setFrame] = useState(null);

    useSyncExternalStore(store.subscribe, store.getVersion);

    const visibleRows = useCallback(() => {
      const m = model.current;
      const top = spacerRef.current.getBoundingClientRect().top;
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
      const blocksIn = (fromRow, toRow) => {
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

    const moveWindow = useCallback((row) => {
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
        getComputedStyle(rootRef.current).getPropertyValue('--row-height')
      );
      const charWidth =
        probeRef.current.getBoundingClientRect().width / PROBE.length;
      const cols = Math.max(
        Math.floor(spacerRef.current.clientWidth / charWidth + 1e-6),
        1
      );
      if (!charWidth || (cols === m.cols && rowHeight === m.rowHeight)) return;

      const spacerTop = spacerRef.current.getBoundingClientRect().top;
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
        return;
      }

      const row = Math.floor(anchor / cols);
      moveWindow(row);
      flushSync(refresh);
      const top =
        spacerRef.current.getBoundingClientRect().top +
        window.scrollY +
        (row - m.baseRow) * rowHeight -
        insetRef.current;
      window.scrollTo({ top, behavior: 'instant' });
      flushSync(refresh);
    }, [moveWindow, refresh, visibleRows]);

    const glide = useCallback(
      (top, smooth) =>
        new Promise((resolve) => {
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
        scrollToIndex: (index, { smooth = false, align = 'center' } = {}) =>
          new Promise((resolve) => {
            requestAnimationFrame(() => {
              const m = model.current;
              if (!m.cols) return resolve();

              const row = Math.floor(index / m.cols);
              const inWindow =
                row >= m.baseRow && row < m.baseRow + m.windowRows;
              if (!inWindow) {
                moveWindow(row);
                flushSync(refresh);
              }

              const inset = insetRef.current;
              const rowTop =
                spacerRef.current.getBoundingClientRect().top +
                window.scrollY +
                (row - m.baseRow) * m.rowHeight;
              const offset =
                align === 'top'
                  ? inset
                  : inset + (window.innerHeight - inset - m.rowHeight) / 2;

              glide(rowTop - offset, smooth && inWindow).then(resolve);
            });
          }),

        scrollToStart: (smooth = false) =>
          new Promise((resolve) => {
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
      [glide, moveWindow, refresh]
    );

    useLayoutEffect(() => {
      const resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(spacerRef.current);
      resizeObserver.observe(probeRef.current);
      return () => resizeObserver.disconnect();
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

    const highlightFor = (start, length) => {
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

    const rows = [];
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
          style={{ height: frame ? frame.windowRows * frame.rowHeight : 0 }}
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
