import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './index.module.css';
import {
  createAim,
  createBlinkGestures,
  createDwell,
  hitTarget,
  snapTarget,
} from '../pointer';

const SIZES = {
  large: { label: 'Large', width: 160, height: 56 },
  regular: { label: 'Regular', width: 120, height: 40 },
  small: { label: 'Link-sized', width: 84, height: 24 },
};
const DENSITIES = {
  sparse: { label: 'Sparse', cols: 4, rows: 3 },
  regular: { label: 'Regular', cols: 6, rows: 4 },
  dense: { label: 'Dense', cols: 8, rows: 6 },
};
const TARGET_SELECTOR = '[data-gaze-target]';
const TEST_LENGTH = 10;
const GOAL_TIMEOUT_MS = 8000;
const CURSOR_RADIUS = 14;
const SNAP_PADDING = 6;

const pickGoals = (ids) => {
  const goals = [];
  while (goals.length < TEST_LENGTH) {
    const id = ids[Math.floor(Math.random() * ids.length)];
    if (id !== goals[goals.length - 1]) goals.push(id);
  }
  return goals;
};

function advanceRun(run, outcome, time) {
  if (outcome === 'miss') return { ...run, misses: run.misses + 1 };
  const next = {
    ...run,
    index: run.index + 1,
    shownAt: time,
    hits: run.hits + (outcome === 'hit' ? 1 : 0),
    timeouts: run.timeouts + (outcome === 'timeout' ? 1 : 0),
    times: outcome === 'hit' ? [...run.times, time - run.shownAt] : run.times,
  };
  next.done = next.index >= run.goals.length;
  return next;
}

const medianSeconds = (times) => {
  if (!times.length) return '—';
  const sorted = [...times].sort((a, b) => a - b);
  return `${(sorted[Math.floor(sorted.length / 2)] / 1000).toFixed(1)} s`;
};

const describeSettings = (settings, size, density) =>
  [
    settings.snap ? `snap ${settings.snapRadius} px` : 'no snap',
    settings.dwell && `dwell ${settings.dwellMs} ms`,
    settings.blinks && 'blinks',
    `${SIZES[size].label.toLowerCase()} · ${DENSITIES[
      density
    ].label.toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(' · ');

export default function Arena({ engine, settings, active }) {
  const [size, setSize] = useState('regular');
  const [density, setDensity] = useState('regular');
  const [pressed, setPressed] = useState(() => new Set());
  const [flagged, setFlagged] = useState(() => new Set());
  const [run, setRun] = useState(null);
  const [history, setHistory] = useState([]);
  const gridRef = useRef(null);
  const cursorRef = useRef(null);
  const rawRef = useRef(null);
  const pipsRef = useRef(null);
  const settingsRef = useRef(settings);

  const { cols, rows } = DENSITIES[density];
  const ids = useMemo(
    () =>
      Array.from(
        { length: cols * rows },
        (_, i) => `${String.fromCharCode(65 + (i % cols))}${Math.floor(i / cols) + 1}`
      ),
    [cols, rows]
  );
  const goal = run && !run.done ? run.goals[run.index] : null;
  const goalKey = goal ? run.index : null;

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!active) return;

    const cursor = cursorRef.current;
    const rawDot = rawRef.current;
    const pips = pipsRef.current;
    const aim = createAim();
    const dwell = createDwell();
    const blinks = createBlinkGestures();
    let aimed = null;

    const clearFlash = () =>
      cursor.classList.remove(styles.flash, styles.flashRight);
    const flash = (className) => {
      clearFlash();
      void cursor.offsetWidth;
      cursor.classList.add(className);
    };
    cursor.addEventListener('animationend', clearFlash);

    const setAimed = (next) => {
      if (next === aimed) return;
      aimed?.removeAttribute('data-aimed');
      next?.setAttribute('data-aimed', '');
      aimed = next;
    };

    const unsubscribe = engine.subscribe((frame) => {
      const current = settingsRef.current;
      const { point } = frame;
      const targets = gridRef.current.querySelectorAll(TARGET_SELECTOR);

      let candidate = null;
      if (point && current.snap) {
        candidate = snapTarget(targets, point, aimed, current.snapRadius);
      } else if (point) {
        candidate = hitTarget(point, TARGET_SELECTOR);
      }
      setAimed(aim.update(candidate, frame.time));

      cursor.style.opacity = point ? 1 : 0;
      if (point && aimed && current.snap) {
        const rect = aimed.getBoundingClientRect();
        cursor.classList.add(styles.cursor__snapped);
        cursor.style.transform = `translate(${rect.left - SNAP_PADDING}px, ${
          rect.top - SNAP_PADDING
        }px)`;
        cursor.style.width = `${rect.width + SNAP_PADDING * 2}px`;
        cursor.style.height = `${rect.height + SNAP_PADDING * 2}px`;
      } else if (point) {
        cursor.classList.remove(styles.cursor__snapped);
        cursor.style.transform = `translate(${point.x - CURSOR_RADIUS}px, ${
          point.y - CURSOR_RADIUS
        }px)`;
        cursor.style.width = `${CURSOR_RADIUS * 2}px`;
        cursor.style.height = `${CURSOR_RADIUS * 2}px`;
      }

      const showRaw = current.showRaw && frame.raw;
      rawDot.style.opacity = showRaw ? 1 : 0;
      if (showRaw) {
        rawDot.style.transform = `translate(${frame.raw.x}px, ${frame.raw.y}px)`;
      }

      const { progress, fire } = dwell.update(
        current.dwell ? aimed : null,
        frame.time,
        current.dwellMs,
        frame.holding
      );
      cursor.style.setProperty('--progress', progress);
      if (fire) {
        fire.click();
        flash(styles.flash);
      }

      const { gesture, pending } = blinks.update(
        current.blinks ? frame.blink : 0,
        frame.blinkThreshold,
        frame.time,
        aimed
      );
      pips.dataset.count = Math.min(pending, 3);
      if (gesture?.target?.isConnected) {
        if (gesture.count === 2) {
          gesture.target.click();
          flash(styles.flash);
        } else if (gesture.count === 3) {
          gesture.target.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
          );
          flash(styles.flashRight);
        }
      }
    });

    return () => {
      unsubscribe();
      cursor.removeEventListener('animationend', clearFlash);
      clearFlash();
      setAimed(null);
      cursor.style.opacity = 0;
      rawDot.style.opacity = 0;
    };
  }, [active, engine]);

  useEffect(() => {
    if (goalKey === null) return;
    const timer = setTimeout(
      () => setRun((prev) => advanceRun(prev, 'timeout', performance.now())),
      GOAL_TIMEOUT_MS
    );
    return () => clearTimeout(timer);
  }, [goalKey]);

  useEffect(() => {
    if (run?.done) setHistory((prev) => [run, ...prev].slice(0, 5));
  }, [run]);

  const resetTargets = () => {
    setPressed(new Set());
    setFlagged(new Set());
    setRun(null);
  };

  const toggle = (setter, id) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const targetClickHandler = (id, e) => {
    if (!goal) {
      toggle(setPressed, id);
      return;
    }
    // the test only counts clicks made with the eyes, not with the mouse
    if (e.isTrusted) return;
    setRun((prev) =>
      advanceRun(prev, id === goal ? 'hit' : 'miss', performance.now())
    );
  };

  const contextMenuHandler = (id, e) => {
    e.preventDefault();
    toggle(setFlagged, id);
  };

  const startRun = () => {
    setPressed(new Set());
    setFlagged(new Set());
    setRun({
      goals: pickGoals(ids),
      index: 0,
      shownAt: performance.now(),
      hits: 0,
      misses: 0,
      timeouts: 0,
      times: [],
      done: false,
      label: describeSettings(settings, size, density),
    });
  };

  const hint = [
    settings.dwell && 'hold your gaze on a button to click',
    settings.blinks && 'blink twice to click, three times to flag',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className={styles.arena} aria-label="Targets">
      <div className={styles.bar}>
        <label className={styles.select}>
          <span>Size</span>
          <select
            value={size}
            onChange={(e) => {
              setSize(e.target.value);
              resetTargets();
            }}
          >
            {Object.entries(SIZES).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.select}>
          <span>Density</span>
          <select
            value={density}
            onChange={(e) => {
              setDensity(e.target.value);
              resetTargets();
            }}
          >
            {Object.entries(DENSITIES).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {goal ? (
          <p className={styles.progress} role="status">
            Target {run.index + 1} of {TEST_LENGTH} · {run.hits} hit
            {run.misses > 0 && ` · ${run.misses} wrong`}
            <button className={styles.link} onClick={() => setRun(null)}>
              Stop
            </button>
          </p>
        ) : (
          <button className={styles.button} onClick={startRun}>
            Start test
          </button>
        )}
        <p className={styles.hint}>{hint || 'Turn on a click method in Tuning'}</p>
      </div>

      <div
        ref={gridRef}
        className={styles.grid}
        style={{
          '--cols': cols,
          '--rows': rows,
          '--target-width': `${SIZES[size].width}px`,
          '--target-height': `${SIZES[size].height}px`,
        }}
      >
        {ids.map((id) => (
          <div key={id} className={styles.cell}>
            <button
              className={styles.target}
              data-gaze-target=""
              data-goal={id === goal ? '' : undefined}
              data-flagged={flagged.has(id) ? '' : undefined}
              aria-pressed={pressed.has(id)}
              onClick={(e) => targetClickHandler(id, e)}
              onContextMenu={(e) => contextMenuHandler(id, e)}
            >
              {id}
            </button>
          </div>
        ))}
      </div>

      {run?.done && (
        <div className={styles.results} role="dialog" aria-label="Test results">
          <h3>
            {run.hits} / {TEST_LENGTH} hit
          </h3>
          <p>
            {run.misses} wrong {run.misses === 1 ? 'click' : 'clicks'} ·{' '}
            {run.timeouts} timed out · median {medianSeconds(run.times)} to
            click
          </p>
          <ol className={styles.history}>
            {history.map((entry, i) => (
              <li key={history.length - i}>
                <strong>
                  {entry.hits}/{TEST_LENGTH}
                </strong>{' '}
                · {entry.misses} wrong · {medianSeconds(entry.times)}
                <span>{entry.label}</span>
              </li>
            ))}
          </ol>
          <div className={styles.resultActions}>
            <button className={styles.button} onClick={startRun}>
              Run again
            </button>
            <button className={styles.ghost} onClick={() => setRun(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      <div ref={cursorRef} className={styles.cursor} aria-hidden="true">
        <span ref={pipsRef} className={styles.pips} data-count="0">
          <i />
          <i />
          <i />
        </span>
      </div>
      <div ref={rawRef} className={styles.raw} aria-hidden="true" />
    </section>
  );
}
