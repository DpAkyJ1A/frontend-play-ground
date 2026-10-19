import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { Features } from './features';
import { createFixationFilter } from './fixation';
import type { GestureLevels } from './gestures';
import { createOneEuro } from './oneEuro';
import { predictRidge, type RidgeModel } from './ridge';
import { createTrainer, type TrainingSample } from './trainer';

// a point in viewport (or, for the model, screen) coordinates
export type Point = { x: number; y: number };

export type GazeSource = 'camera' | 'mouse';
export type Smoothing = 'fixation' | 'oneEuro';

// One frame from a source: the camera tracker, or the mouse, which hands over
// the point itself as `raw`.
export type GazeSample = {
  time: number;
  face: boolean;
  landmarks: NormalizedLandmark[] | null;
  features: Features | null;
  blinkLeft: number;
  blinkRight: number;
  gestures: GestureLevels | null;
  raw?: Point;
};

// What subscribers get: the sample plus the model's point and the smoothed one.
export type GazeFrame = Omit<GazeSample, 'raw'> & {
  raw: Point | null;
  point: Point | null;
  blink: number;
  holding: boolean;
  blinkThreshold: number;
  fps: number;
};

export type FilterSettings = {
  mode: Smoothing;
  minCutoff: number;
  beta: number;
  radius: number;
  windowMs: number;
};

export type GazeEngine = ReturnType<typeof createGazeEngine>;

const FACE_LOST_RESET_MS = 500;
const MOUSE_INTERVAL_MS = 33;

// Where the viewport sits on the physical screen. The model maps eyes to screen
// coordinates, so a calibration survives leaving fullscreen or moving the window.
export function viewportOrigin(): Point {
  return {
    x: window.screenX + (window.outerWidth - window.innerWidth) / 2,
    y: window.screenY + window.outerHeight - window.innerHeight,
  };
}

const gaussian = () =>
  Math.sqrt(-2 * Math.log(1 - Math.random())) *
  Math.cos(2 * Math.PI * Math.random());

// One stream of gaze frames from either the webcam or the mouse (with webcam-like
// noise added, to tune the pointer without a camera). Frames carry the raw model
// output and the smoothed point (fixation average or One Euro), both in viewport
// coordinates.
export function createGazeEngine() {
  const listeners = new Set<(frame: GazeFrame) => void>();
  const filterX = createOneEuro();
  const filterY = createOneEuro();
  const fixation = createFixationFilter();
  const trainer = createTrainer();
  let smoothing: Smoothing = 'fixation';
  const frameTimes: number[] = [];
  let model: RidgeModel | null = null;
  let source: { stop(): void } | null = null;
  let sourceToken = 0;
  let point: Point | null = null;
  let lastFaceTime = 0;
  let noise = 60;
  let blinkThreshold = 0.5;

  const resetFilter = () => {
    filterX.reset();
    filterY.reset();
    fixation.reset();
    point = null;
  };

  const smooth = (raw: Point, time: number): Point => {
    if (smoothing === 'fixation') return fixation.filter(raw, time);
    return {
      x: filterX.filter(raw.x, time / 1000),
      y: filterY.filter(raw.y, time / 1000),
    };
  };

  // Arrow keys stand in for the face gestures that nudge the pointer, with either
  // source: to try nudging with the mouse, or as a fallback when a gesture
  // won't register.
  const arrows = new Set<string>();
  const onArrow = (e: KeyboardEvent) => {
    if (
      !e.key.startsWith('Arrow') ||
      (e.target instanceof Element && e.target.closest('input, select'))
    ) {
      return;
    }
    if (e.type === 'keydown') arrows.add(e.key);
    else arrows.delete(e.key);
  };
  const releaseArrows = () => arrows.clear();
  const listenToArrows = (on: boolean) => {
    const method = on ? 'addEventListener' : 'removeEventListener';
    // either method by name only resolves to the untyped (Event) overload
    window[method]('keydown', onArrow as EventListener);
    window[method]('keyup', onArrow as EventListener);
    window[method]('blur', releaseArrows);
    arrows.clear();
  };
  const withArrows = (gestures: GestureLevels | null) => {
    if (!arrows.size) return gestures;
    const left = arrows.has('ArrowLeft');
    const right = arrows.has('ArrowRight');
    return {
      brows: arrows.has('ArrowUp') ? 1 : 0,
      jaw: arrows.has('ArrowDown') ? 1 : 0,
      side: left || right ? 1 : 0,
      // the same direction convention as the face: positive is the person's left
      shift: (gestures?.shift ?? 0) + (left ? 0.1 : 0) - (right ? 0.1 : 0),
    };
  };

  const emit = (sample: GazeSample) => {
    frameTimes.push(sample.time);
    while (frameTimes[0] < sample.time - 1000) frameTimes.shift();

    const blink = Math.min(sample.blinkLeft, sample.blinkRight);
    // one eye closing already wrecks its iris points: hold the last point
    const holding =
      Math.max(sample.blinkLeft, sample.blinkRight) > blinkThreshold - 0.1;

    let raw = sample.raw ?? null;
    if (!raw && model && sample.features) {
      const screen = predictRidge(model, sample.features);
      const origin = viewportOrigin();
      raw = { x: screen.x - origin.x, y: screen.y - origin.y };
    }

    if (sample.face) {
      if (sample.time - lastFaceTime > FACE_LOST_RESET_MS) resetFilter();
      lastFaceTime = sample.time;
    }
    if (raw && !holding) point = smooth(raw, sample.time);

    const frame: GazeFrame = {
      ...sample,
      gestures: withArrows(sample.gestures),
      raw,
      point: sample.face ? point : null,
      blink,
      holding,
      blinkThreshold,
      fps: frameTimes.length,
    };
    listeners.forEach((listener) => listener(frame));
  };

  const createMouseSource = () => {
    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let eyesClosed = false;
    const onMove = (e: PointerEvent) => {
      mouse = { x: e.clientX, y: e.clientY };
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyB' && !e.repeat) eyesClosed = e.type === 'keydown';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    const timer = setInterval(() => {
      emit({
        time: performance.now(),
        face: true,
        landmarks: null,
        features: null,
        blinkLeft: eyesClosed ? 1 : 0,
        blinkRight: eyesClosed ? 1 : 0,
        gestures: null,
        raw: {
          x: mouse.x + gaussian() * noise,
          y: mouse.y + gaussian() * noise,
        },
      });
    }, MOUSE_INTERVAL_MS);

    return {
      stop() {
        clearInterval(timer);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
      },
    };
  };

  const stop = () => {
    sourceToken += 1;
    source?.stop();
    source = null;
    listenToArrows(false);
    resetFilter();
  };

  return {
    async startCamera(video: HTMLVideoElement) {
      stop();
      const token = sourceToken;
      // MediaPipe is heavy: load it only when someone actually starts the camera
      const { startCameraTracker } = await import('./tracker');
      const tracker = await startCameraTracker(video, emit);
      // another source was picked while the model loaded
      if (token !== sourceToken) {
        tracker.stop();
        return false;
      }
      source = tracker;
      listenToArrows(true);
      return true;
    },
    startMouse() {
      stop();
      source = createMouseSource();
      listenToArrows(true);
    },
    stop,
    calibrate(samples: TrainingSample[], lambda?: number) {
      model = trainer.calibrate(samples, lambda);
      resetFilter();
    },
    // a drift check moves everything at once, so the filter starts over
    recentre(features: Features[], target: Point) {
      if (!model) return trainer.stats();
      model = trainer.recentre(features, target);
      resetFilter();
      return trainer.stats();
    },
    // swaps the model under the running filter: a refit is a nudge, not a jump
    learnFromClick(features: Features[], target: Point, miss: number) {
      if (!model) return trainer.stats();
      model = trainer.learn(features, target, miss);
      return trainer.stats();
    },
    forgetClicks() {
      model = trainer.forget() ?? model;
      return trainer.stats();
    },
    learningStats() {
      return trainer.stats();
    },
    setFilter({ mode, minCutoff, beta, radius, windowMs }: FilterSettings) {
      if (mode !== smoothing) {
        smoothing = mode;
        resetFilter();
      }
      filterX.set({ minCutoff, beta });
      filterY.set({ minCutoff, beta });
      fixation.set({ radius, windowMs });
    },
    setNoise(value: number) {
      noise = value;
    },
    setBlinkThreshold(value: number) {
      blinkThreshold = value;
    },
    subscribe(listener: (frame: GazeFrame) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
