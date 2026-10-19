import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from 'react';
import styles from './index.module.css';
import type { Settings } from '..';
import type { Features } from '../features';
import {
  createAim,
  createBlinkGestures,
  createDwell,
  hitTarget,
  NUDGE_STEPS,
  nearestTarget,
  neighborIn,
  snapTarget,
  targetsWithin,
} from '../pointer';
import {
  viewportOrigin,
  type GazeEngine,
  type GazeFrame,
  type Point,
} from '../gazeEngine';
import type { LearningStats } from '../trainer';
import { createFaceGestures, isGesturing } from '../gestures';
import { trimOutliers } from '../Calibration/samples';
import {
  insideLoupe,
  layoutLoupe,
  loupeTransform,
  visibleInLoupe,
  type LoupeLayout,
} from '../loupe';

type Size = 'large' | 'regular' | 'small';
type Density = 'sparse' | 'regular' | 'dense';
type Run = {
  goals: string[];
  index: number;
  shownAt: number;
  hits: number;
  misses: number;
  timeouts: number;
  times: number[];
  done: boolean;
  label: string;
};
// the open loupe, plus where the grid sits so its copy lines up
type Loupe = LoupeLayout & {
  grid: { left: number; top: number; width: number; height: number };
};
// a spot the gaze settled on, for a dwell that isn't on a button
type Area = Point & { since?: number };
// a correction made with face gestures, described in the frame loop
type Nudge = {
  anchor: Point;
  offset: Point;
  target: HTMLElement | null;
  since: number;
};
// what the frame loop remembers of the last few seconds
type RecentFrame = {
  time: number;
  features: Features | null;
  raw: Point | null;
  aimed: HTMLElement | null;
  holding: boolean;
  gesturing: boolean;
};
// a frame the model can learn from
type LearnFrame = RecentFrame & { features: Features; raw: Point };

const SIZES: Record<Size, { label: string; width: number; height: number }> = {
  large: { label: 'Large', width: 160, height: 56 },
  regular: { label: 'Regular', width: 120, height: 40 },
  small: { label: 'Link-sized', width: 84, height: 24 },
};
const DENSITIES: Record<
  Density,
  { label: string; cols: number; rows: number }
> = {
  sparse: { label: 'Sparse', cols: 4, rows: 3 },
  regular: { label: 'Regular', cols: 6, rows: 4 },
  dense: { label: 'Dense', cols: 8, rows: 6 },
};
const TARGET_SELECTOR = '[data-gaze-target]';
const COPY_SELECTOR = '[data-loupe-id]';
const TEST_LENGTH = 10;
const GOAL_TIMEOUT_MS = 8000;
const CURSOR_RADIUS = 14;
const SNAP_PADDING = 6;
// frames before a click that count as "looking at the button"; a blink sequence
// takes longer, and its own frames are dropped as blinks anyway
const DWELL_LEARN_MS = 1000;
const BLINK_LEARN_MS = 2000;
const MIN_LEARN_FRAMES = 5;
// with the loupe on, a dwell is on a spot: the gaze has to stay this close to it
const AREA_RADIUS = 60;
// looking away from the loupe this long closes it; a look at a copy near its
// edge may land just outside for a moment
const LOUPE_EXIT_MS = 600;
const LOUPE_EXIT_MARGIN = 30;
// the eyes need a moment to find the button again once it's magnified: until
// then the gaze is still on the old spot, likely between two copies
const LOUPE_SETTLE_MS = 300;
// a copy cut down to a sliver by the loupe's edge is too thin to look at
const MIN_VISIBLE_PX = 32;
// a nudge without a button to jump to moves the pointer this far
const NUDGE_STEP_PX = 24;
// a nudge holds until the gaze has clearly gone somewhere else: this far from
// where it was and from the nudged spot, this long, with the face relaxed (a
// gesture can drag the gaze estimate around)
const NUDGE_RELEASE_PX = 160;
const NUDGE_RELEASE_MS = 400;
const GESTURE_SETTLE_MS = 300;
// how far back a corrected click reaches for frames of the eyes on its target
const NUDGE_LEARN_MS = 3000;

const centerOf = (element: Element): Point => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

const pickGoals = (ids: string[]) => {
  const goals: string[] = [];
  while (goals.length < TEST_LENGTH) {
    const id = ids[Math.floor(Math.random() * ids.length)];
    if (id !== goals[goals.length - 1]) goals.push(id);
  }
  return goals;
};

function advanceRun(
  run: Run,
  outcome: 'hit' | 'miss' | 'timeout',
  time: number
): Run {
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

const medianSeconds = (times: number[]) => {
  if (!times.length) return '—';
  const sorted = [...times].sort((a, b) => a - b);
  return `${(sorted[Math.floor(sorted.length / 2)] / 1000).toFixed(1)} s`;
};

const describeSettings = (settings: Settings, size: Size, density: Density) =>
  [
    settings.snap ? `snap ${settings.snapRadius} px` : 'no snap',
    settings.dwell && `dwell ${settings.dwellMs} ms`,
    settings.dwell && settings.loupe && `loupe ×${settings.loupeZoom}`,
    settings.nudge && 'nudge',
    settings.blinks && 'blinks',
    `${SIZES[size].label.toLowerCase()} · ${DENSITIES[
      density
    ].label.toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(' · ');

type Props = {
  engine: GazeEngine;
  settings: Settings;
  reach: number;
  active: boolean;
  onLearn?: (stats: LearningStats) => void;
  onStartTest?: (begin: () => void) => void;
};

export default function Arena({
  engine,
  settings,
  reach,
  active,
  onLearn,
  onStartTest,
}: Props) {
  const [size, setSize] = useState<Size>('regular');
  const [density, setDensity] = useState<Density>('regular');
  const [pressed, setPressed] = useState(() => new Set<string>());
  const [flagged, setFlagged] = useState(() => new Set<string>());
  const [run, setRun] = useState<Run | null>(null);
  const [history, setHistory] = useState<Run[]>([]);
  const [lastRun, setLastRun] = useState<Run | null>(null);
  const [loupe, setLoupe] = useState<Loupe | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // the open loupe's layout, read by the frame loop; the state above renders it
  const loupeRef = useRef<Loupe | null>(null);
  const loupeElementRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const rawRef = useRef<HTMLDivElement>(null);
  const pipsRef = useRef<HTMLSpanElement>(null);
  const settingsRef = useRef(settings);
  const onLearnRef = useRef(onLearn);
  const reachRef = useRef(reach);

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
  const goalKey = run && goal ? run.index : null;

  useEffect(() => {
    settingsRef.current = settings;
    onLearnRef.current = onLearn;
    reachRef.current = reach;
  }, [settings, onLearn, reach]);

  useEffect(() => {
    if (!active) return;

    const cursor = cursorRef.current!;
    const rawDot = rawRef.current!;
    const pips = pipsRef.current!;
    let aim = createAim();
    const dwell = createDwell<HTMLElement | Area>();
    const blinks = createBlinkGestures();
    let aimed: HTMLElement | null = null;
    let recent: RecentFrame[] = [];
    // where the gaze settled, for a dwell on a spot rather than a button
    let area: Area | null = null;
    // the frames that opened the loupe, and since when the gaze has been off it
    let opening: LearnFrame[] = [];
    let openedAt = 0;
    let outsideSince: number | null = null;
    const faceGestures = createFaceGestures();
    // A correction made with face gestures: the gaze point it started from, how
    // far it has been pushed, the button it was pushed onto (when snapping) and
    // since when the eyes have been on it. While it holds, the eyes don't steer.
    let nudge: Nudge | null = null;
    let lastGestureAt = -Infinity;
    let awaySince: number | null = null;

    const clearFlash = () =>
      cursor.classList.remove(styles.flash, styles.flashRight);
    const flash = (className: string) => {
      clearFlash();
      void cursor.offsetWidth;
      cursor.classList.add(className);
    };
    cursor.addEventListener('animationend', clearFlash);

    const setAimed = (next: HTMLElement | null) => {
      if (next === aimed) return;
      aimed?.removeAttribute('data-aimed');
      next?.setAttribute('data-aimed', '');
      aimed = next;
    };

    const press = (target: HTMLElement, contextMenu: boolean) => {
      if (contextMenu) {
        target.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
        );
        flash(styles.flashRight);
      } else {
        target.click();
        flash(styles.flash);
      }
    };

    // Opening or closing the loupe swaps the buttons for their copies or back, so
    // the aim starts over instead of clinging to an element that's out of play.
    const showLoupe = (layout: Loupe | null) => {
      loupeRef.current = layout;
      setLoupe(layout);
      outsideSince = null;
      nudge = null;
      aim = createAim();
      setAimed(null);
    };

    // the copies that show in the loupe: it holds a whole grid, clipped
    const copies = () => {
      const layout = loupeRef.current;
      const element = loupeElementRef.current;
      if (!layout || !element) return [];
      return [
        ...element.querySelectorAll<HTMLElement>(COPY_SELECTOR),
      ].filter((copy) => {
        const visible = visibleInLoupe(layout, copy.getBoundingClientRect());
        return (
          visible.width >= MIN_VISIBLE_PX && visible.height >= MIN_VISIBLE_PX
        );
      });
    };

    const framesOn = (element: HTMLElement, time: number, windowMs: number) =>
      recent.filter(
        (frame): frame is LearnFrame =>
          frame.aimed === element &&
          !frame.holding &&
          frame.features !== null &&
          frame.raw !== null &&
          frame.time > time - windowMs
      );

    // Teach the model that these frames were looking at `element`'s centre (or at
    // `at`). With `candidates`, only if the model already put the gaze nearest
    // that element — otherwise the snap may have picked a neighbour you never meant.
    const teach = (
      frames: LearnFrame[],
      element: HTMLElement,
      candidates: Iterable<HTMLElement> | null,
      at = centerOf(element)
    ) => {
      if (!settingsRef.current.learn || frames.length < MIN_LEARN_FRAMES) return;
      const seen = {
        x: frames.reduce((sum, frame) => sum + frame.raw.x, 0) / frames.length,
        y: frames.reduce((sum, frame) => sum + frame.raw.y, 0) / frames.length,
      };
      if (candidates && nearestTarget(candidates, seen).target !== element) return;

      const center = at;
      const origin = viewportOrigin();
      const stats = engine.learnFromClick(
        frames.map((frame) => frame.features),
        { x: center.x + origin.x, y: center.y + origin.y },
        Math.hypot(seen.x - center.x, seen.y - center.y)
      );
      onLearnRef.current?.(stats);
    };

    // Turn a click into a training sample: the frames spent on the button before
    // it, answered with the button's centre. During a test the answer is the goal
    // even on a miss — that's where you were trying to look.
    const learn = (target: HTMLElement, time: number, windowMs: number) => {
      const goal = gridRef.current!.querySelector<HTMLElement>('[data-goal]');
      teach(
        framesOn(target, time, windowMs),
        goal ?? target,
        goal
          ? null
          : gridRef.current!.querySelectorAll<HTMLElement>(TARGET_SELECTOR)
      );
    };

    // A corrected click: the gestures pushed the pointer onto what the eyes were
    // on all along, so every frame since the gaze settled is answered with it —
    // no nearest-button check, the correction is the confirmation. Frames
    // mid-gesture are left out, and so are glances away (the outlier trim).
    const learnNudged = (
      element: HTMLElement,
      time: number,
      at = centerOf(element)
    ) => {
      const frames = recent.filter(
        (frame): frame is LearnFrame =>
          // only called while a nudge holds
          frame.time >= nudge!.since &&
          frame.time > time - NUDGE_LEARN_MS &&
          !frame.holding &&
          !frame.gesturing &&
          frame.features !== null &&
          frame.raw !== null
      );
      teach(trimOutliers(frames), element, null, at);
    };

    // the label for a corrected click: the test goal if there is one, else the
    // button pushed onto, else (no snapping) the spot the pointer was pushed to
    const learnClick = (
      target: HTMLElement,
      time: number,
      windowMs: number,
      at: Point | null
    ) => {
      if (!nudge) {
        learn(target, time, windowMs);
        return;
      }
      const goal = gridRef.current!.querySelector<HTMLElement>('[data-goal]');
      if (goal) learnNudged(goal, time);
      else if (nudge.target || !at) learnNudged(target, time);
      else learnNudged(target, time, at);
    };

    // A pick in the loupe teaches twice: the frames inside it are answered with
    // the copy's centre — that's where the eyes were — and the frames that opened
    // it with the button itself, unchecked: the magnified pick just confirmed it.
    const learnFromLoupe = (
      copy: HTMLElement,
      target: HTMLElement,
      time: number,
      windowMs: number
    ) => {
      const goal = gridRef.current!.querySelector<HTMLElement>('[data-goal]');
      const shown = copies();
      const answer = shown.find(
        (candidate) => candidate.dataset.loupeId === (goal ?? target).dataset.id
      );
      if (!answer) return;
      if (nudge) learnNudged(answer, time);
      else teach(framesOn(copy, time, windowMs), answer, goal ? null : shown);
      teach(opening, goal ?? target, null);
    };

    const openLoupe = (anchor: Point, near: HTMLElement[], time: number) => {
      const current = settingsRef.current;
      const grid = gridRef.current!.getBoundingClientRect();
      const settledMs = Math.min(current.dwellMs, DWELL_LEARN_MS);
      openedAt = time;
      opening = recent.filter(
        (frame): frame is LearnFrame =>
          !frame.holding &&
          frame.features !== null &&
          frame.raw !== null &&
          frame.time > time - settledMs
      );
      showLoupe({
        ...layoutLoupe(
          anchor,
          reachRef.current,
          near.map((target) => target.getBoundingClientRect()),
          current.loupeZoom,
          { width: window.innerWidth, height: window.innerHeight }
        ),
        grid: {
          left: grid.left,
          top: grid.top,
          width: grid.width,
          height: grid.height,
        },
      });
    };

    // A pick in the loupe presses the real button behind the copy. The spot the
    // gaze is on then counts as used, so the loupe doesn't reopen right there.
    const pick = (
      copy: HTMLElement,
      frame: GazeFrame,
      windowMs: number,
      contextMenu: boolean
    ) => {
      const target = gridRef.current!.querySelector<HTMLElement>(
        `[data-id="${copy.dataset.loupeId}"]`
      );
      if (!target) return;
      // learn first: the click moves the test goal on to the next button
      learnFromLoupe(copy, target, frame.time, windowMs);
      showLoupe(null);
      area = frame.point && { x: frame.point.x, y: frame.point.y };
      dwell.hold(area);
      press(target, contextMenu);
    };

    const unsubscribe = engine.subscribe((frame) => {
      const current = settingsRef.current;
      const { point } = frame;
      const targets =
        gridRef.current!.querySelectorAll<HTMLElement>(TARGET_SELECTOR);

      let loupe = loupeRef.current;
      if (loupe && point) {
        if (insideLoupe(loupe, point, LOUPE_EXIT_MARGIN)) {
          outsideSince = null;
        } else if (outsideSince === null) {
          outsideSince = frame.time;
        } else if (frame.time - outsideSince > LOUPE_EXIT_MS) {
          showLoupe(null);
          loupe = null;
        }
      }

      if (
        point &&
        (!area || Math.hypot(point.x - area.x, point.y - area.y) > AREA_RADIUS)
      ) {
        area = { x: point.x, y: point.y, since: frame.time };
      }

      // Face gestures nudge the pointer: onto the next button that way when
      // snapping, else a small step. The nudge holds until the gaze clearly moves
      // on — far from where it was and from the nudged spot, with the face calm.
      const face = current.nudge ? frame.gestures : null;
      const gesturing =
        face !== null && isGesturing(face, current.nudgeSensitivity);
      if (gesturing) lastGestureAt = frame.time;
      const direction =
        point && face
          ? faceGestures.update(face, frame.time, current.nudgeSensitivity)
          : null;
      if (direction && point) {
        nudge ??= {
          anchor: { x: point.x, y: point.y },
          offset: { x: 0, y: 0 },
          target: null,
          since: area?.since ?? frame.time,
        };
        const from = nudge.target ?? aimed;
        if (current.snap && from?.isConnected) {
          nudge.target =
            neighborIn(loupe ? copies() : targets, from, direction) ?? from;
        } else {
          const step = NUDGE_STEPS[direction];
          nudge.offset = {
            x: nudge.offset.x + step.x * NUDGE_STEP_PX,
            y: nudge.offset.y + step.y * NUDGE_STEP_PX,
          };
          nudge.target = null;
        }
      }
      // null only without a point and a nudge: where it's read, one is there
      const effective = nudge
        ? { x: nudge.anchor.x + nudge.offset.x, y: nudge.anchor.y + nudge.offset.y }
        : point;
      if (nudge && point) {
        const nudgedTo = nudge.target ? centerOf(nudge.target) : effective!;
        const away =
          Math.hypot(point.x - nudge.anchor.x, point.y - nudge.anchor.y) >
            NUDGE_RELEASE_PX &&
          Math.hypot(point.x - nudgedTo.x, point.y - nudgedTo.y) >
            NUDGE_RELEASE_PX &&
          frame.time - lastGestureAt > GESTURE_SETTLE_MS;
        if (!away) awaySince = null;
        else if (awaySince === null) awaySince = frame.time;
        else if (frame.time - awaySince > NUDGE_RELEASE_MS) {
          nudge = null;
          awaySince = null;
          aim = createAim();
        }
      }

      // while the loupe is open its copies stand in for the buttons; they ignore
      // the pointer, so even an unsnapped aim goes by their rects
      let candidate = null;
      if (nudge?.target?.isConnected) {
        candidate = nudge.target;
      } else if (point && loupe) {
        candidate = snapTarget(
          copies(),
          nudge ? effective! : point,
          aimed,
          current.snap ? current.snapRadius : 0
        );
      } else if (point && current.snap) {
        candidate = snapTarget(
          targets,
          nudge ? effective! : point,
          aimed,
          current.snapRadius
        );
      } else if (point) {
        candidate = hitTarget(nudge ? effective! : point, TARGET_SELECTOR);
      }
      // a nudge is deliberate: it takes effect at once, without the aim's delay
      setAimed(nudge ? candidate : aim.update(candidate, frame.time));

      recent.push({
        time: frame.time,
        features: frame.features,
        raw: frame.raw,
        aimed,
        holding: frame.holding,
        gesturing,
      });
      recent = recent.filter(
        (past) =>
          past.time > frame.time - Math.max(BLINK_LEARN_MS, NUDGE_LEARN_MS)
      );

      cursor.style.opacity = point ? '1' : '0';
      cursor.classList.toggle(styles.cursor__nudged, Boolean(nudge));
      if (point && aimed && current.snap) {
        // a copy is framed only as far as it shows
        const rect = loupe
          ? visibleInLoupe(loupe, aimed.getBoundingClientRect())
          : aimed.getBoundingClientRect();
        cursor.classList.add(styles.cursor__snapped);
        cursor.style.transform = `translate(${rect.left - SNAP_PADDING}px, ${
          rect.top - SNAP_PADDING
        }px)`;
        cursor.style.width = `${rect.width + SNAP_PADDING * 2}px`;
        cursor.style.height = `${rect.height + SNAP_PADDING * 2}px`;
      } else if (point) {
        cursor.classList.remove(styles.cursor__snapped);
        cursor.style.transform = `translate(${effective!.x - CURSOR_RADIUS}px, ${
          effective!.y - CURSOR_RADIUS
        }px)`;
        cursor.style.width = `${CURSOR_RADIUS * 2}px`;
        cursor.style.height = `${CURSOR_RADIUS * 2}px`;
      }

      const showRaw = current.showRaw && frame.raw;
      rawDot.style.opacity = showRaw ? '1' : '0';
      if (showRaw) {
        rawDot.style.transform = `translate(${frame.raw!.x}px, ${
          frame.raw!.y
        }px)`;
      }

      // With the loupe on, the dwell that opens it is on a spot, not a button:
      // the button you mean may not be the one the snap picked. A nudge has
      // already said which one it is, so then the dwell clicks it directly.
      const onSpot = current.loupe && !loupe && !nudge;
      const { progress, fire } = dwell.update(
        current.dwell ? (onSpot ? point && area : aimed) : null,
        frame.time,
        current.dwellMs,
        // a gesture on its way pauses the dwell, so a wrong button isn't clicked
        // while you're correcting it
        frame.holding ||
          gesturing ||
          (loupe && frame.time - openedAt < LOUPE_SETTLE_MS)
      );
      cursor.style.setProperty('--progress', String(progress));
      // off the spot the dwell runs on `aimed`, a button (or its copy); on the
      // spot it fires only with a point
      if (fire && loupe) {
        pick(fire as HTMLElement, frame, DWELL_LEARN_MS, false);
      } else if (fire && onSpot) {
        const near = targetsWithin(targets, point!, reachRef.current);
        // a lone button in reach has nothing to be told apart from
        if (near.length === 1 && current.loupeOnlyCrowded) {
          learn(near[0], frame.time, DWELL_LEARN_MS);
          press(near[0], false);
        } else if (near.length) {
          openLoupe(point!, near, frame.time);
        }
      } else if (fire) {
        // learn first: the click moves the test goal on to the next button
        learnClick(
          fire as HTMLElement,
          frame.time,
          DWELL_LEARN_MS,
          nudge && effective
        );
        press(fire as HTMLElement, false);
      }

      const { gesture, pending } = blinks.update(
        current.blinks ? frame.blink : 0,
        frame.blinkThreshold,
        frame.time,
        aimed
      );
      pips.dataset.count = String(Math.min(pending, 3));
      if (
        gesture?.target?.isConnected &&
        (gesture.count === 2 || gesture.count === 3)
      ) {
        const contextMenu = gesture.count === 3;
        if (gesture.target.dataset.loupeId) {
          pick(gesture.target, frame, BLINK_LEARN_MS, contextMenu);
        } else {
          learnClick(
            gesture.target,
            frame.time,
            BLINK_LEARN_MS,
            nudge && effective
          );
          press(gesture.target, contextMenu);
        }
      }
    });

    return () => {
      unsubscribe();
      cursor.removeEventListener('animationend', clearFlash);
      clearFlash();
      showLoupe(null);
      cursor.style.opacity = '0';
      rawDot.style.opacity = '0';
    };
  }, [active, engine]);

  useEffect(() => {
    if (goalKey === null) return;
    const timer = setTimeout(
      () =>
        setRun(
          (prev) => prev && advanceRun(prev, 'timeout', performance.now())
        ),
      GOAL_TIMEOUT_MS
    );
    return () => clearTimeout(timer);
  }, [goalKey]);

  // A finished run goes to the history once, when it first shows up.
  if (run !== lastRun) {
    setLastRun(run);
    if (run?.done) setHistory((prev) => [run, ...prev].slice(0, 5));
  }

  const closeLoupe = () => {
    loupeRef.current = null;
    setLoupe(null);
  };

  const resetTargets = () => {
    closeLoupe();
    setPressed(new Set());
    setFlagged(new Set());
    setRun(null);
  };

  const toggle = (setter: Dispatch<SetStateAction<Set<string>>>, id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const targetClickHandler = (id: string, e: ReactMouseEvent) => {
    if (!goal) {
      toggle(setPressed, id);
      return;
    }
    // the test only counts clicks made with the eyes, not with the mouse
    if (e.isTrusted) return;
    setRun(
      (prev) =>
        prev &&
        advanceRun(prev, id === goal ? 'hit' : 'miss', performance.now())
    );
  };

  const contextMenuHandler = (id: string, e: ReactMouseEvent) => {
    e.preventDefault();
    toggle(setFlagged, id);
  };

  const beginRun = () => {
    closeLoupe();
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

  // the page may run a drift check first
  const startRun = () => (onStartTest ? onStartTest(beginRun) : beginRun());

  const gridStyle = {
    '--cols': cols,
    '--rows': rows,
    '--target-width': `${SIZES[size].width}px`,
    '--target-height': `${SIZES[size].height}px`,
  } as CSSProperties;
  // shared by a button and its copy in the loupe
  const stateOf = (id: string) => ({
    'data-goal': id === goal ? '' : undefined,
    'data-flagged': flagged.has(id) ? '' : undefined,
    'aria-pressed': pressed.has(id),
  });

  const hint = [
    settings.dwell &&
      (!settings.loupe
        ? 'hold your gaze on a button to click'
        : settings.loupeOnlyCrowded
        ? 'hold your gaze to click — a loupe opens where buttons are crowded'
        : 'hold your gaze to open a loupe, then on a button inside'),
    settings.blinks && 'blink twice to click, three times to flag',
    settings.nudge && 'brows ↑ · jaw ↓ · mouth ← → to nudge',
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
              setSize(e.target.value as Size);
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
              setDensity(e.target.value as Density);
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
        {run && goal ? (
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

      <div ref={gridRef} className={styles.grid} style={gridStyle}>
        {ids.map((id) => (
          <div key={id} className={styles.cell}>
            <button
              className={styles.target}
              data-gaze-target=""
              data-id={id}
              {...stateOf(id)}
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

      {loupe && (
        <div
          ref={loupeElementRef}
          className={styles.loupe}
          style={{
            left: loupe.left,
            top: loupe.top,
            width: loupe.width,
            height: loupe.height,
            transformOrigin: `${loupe.anchor.x - loupe.left}px ${
              loupe.anchor.y - loupe.top
            }px`,
          }}
          aria-hidden="true"
        >
          <div
            className={styles.loupeContent}
            style={{ transform: loupeTransform(loupe) }}
          >
            <div
              className={`${styles.grid} ${styles.loupeGrid}`}
              style={{ ...gridStyle, ...loupe.grid }}
            >
              {ids.map((id) => (
                <div key={id} className={styles.cell}>
                  <button
                    type="button"
                    tabIndex={-1}
                    className={styles.target}
                    data-loupe-id={id}
                    {...stateOf(id)}
                  >
                    {id}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <span className={styles.loupeZoom}>
            ×{Number(loupe.zoom.toFixed(1))}
          </span>
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
