import { createOneEuro } from './oneEuro';
import { predictRidge } from './ridge';

const FACE_LOST_RESET_MS = 500;
const MOUSE_INTERVAL_MS = 33;

// Where the viewport sits on the physical screen. The model maps eyes to screen
// coordinates, so a calibration survives leaving fullscreen or moving the window.
export function viewportOrigin() {
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
// output and the One Euro–filtered point, both in viewport coordinates.
export function createGazeEngine() {
  const listeners = new Set();
  const filterX = createOneEuro();
  const filterY = createOneEuro();
  const frameTimes = [];
  let model = null;
  let source = null;
  let sourceToken = 0;
  let point = null;
  let lastFaceTime = 0;
  let noise = 60;
  let blinkThreshold = 0.5;

  const resetFilter = () => {
    filterX.reset();
    filterY.reset();
    point = null;
  };

  const emit = (sample) => {
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
    if (raw && !holding) {
      const seconds = sample.time / 1000;
      point = {
        x: filterX.filter(raw.x, seconds),
        y: filterY.filter(raw.y, seconds),
      };
    }

    const frame = {
      ...sample,
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
    const onMove = (e) => {
      mouse = { x: e.clientX, y: e.clientY };
    };
    const onKey = (e) => {
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
    resetFilter();
  };

  return {
    async startCamera(video) {
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
      return true;
    },
    startMouse() {
      stop();
      source = createMouseSource();
    },
    stop,
    setModel(next) {
      model = next;
      resetFilter();
    },
    setFilter(params) {
      filterX.set(params);
      filterY.set(params);
    },
    setNoise(value) {
      noise = value;
    },
    setBlinkThreshold(value) {
      blinkThreshold = value;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
