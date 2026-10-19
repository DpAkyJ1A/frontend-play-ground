import { useEffect, useRef, useState } from 'react';
import styles from './index.module.css';
import type { Features } from '../features';
import { viewportOrigin, type GazeEngine, type Point } from '../gazeEngine';
import { regionMisses, selectModel } from '../crossValidation';
import {
  PURSUIT_HOLD_MS,
  createPursuitPath,
  pursuitSamples,
  type PursuitFrame,
  type PursuitPath,
} from './pursuit';
import {
  fixationSamples,
  type CalibrationSample,
  type EyeFrame,
} from './samples';

export type CalibrationMode = 'pursuit' | 'points';
type Step = CalibrationMode | 'intro' | 'fitting' | 'validate' | 'result';

// a dot on screen and the frames collected while it was looked at
type Dot<S> = { target: Point; samples: S[] };
// a check dot's frame: the model's point (raw and smoothed), and the eyes,
// which are learned from too if the result is accepted
type CheckSample = {
  raw: Point;
  point: Point | null;
  features: Features | null;
  origin: Point;
};
type PendingFit =
  | { kind: 'pursuit'; frames: PursuitFrame[]; path: PursuitPath }
  | { kind: 'points'; points: Dot<EyeFrame>[] };

type MeasuredPoint = {
  target: Point;
  mean: Point;
  error: number;
  spread: number;
  smoothedSpread: number | null;
};
// a check dot without a single frame has nothing to score
type ValidationPoint =
  | MeasuredPoint
  | { target: Point; mean: null; error?: undefined };
export type ValidationResult = ReturnType<typeof scoreValidation>;

// fractions of the viewport: a 3×3 grid near the edges plus four inner points
const CALIBRATION_POINTS = [
  [0.06, 0.08],
  [0.5, 0.08],
  [0.94, 0.08],
  [0.06, 0.5],
  [0.5, 0.5],
  [0.94, 0.5],
  [0.06, 0.92],
  [0.5, 0.92],
  [0.94, 0.92],
  [0.28, 0.29],
  [0.72, 0.29],
  [0.28, 0.71],
  [0.72, 0.71],
];
// away from the calibration points, so the score isn't flattered
const VALIDATION_POINTS = [
  [0.17, 0.5],
  [0.5, 0.18],
  [0.83, 0.5],
  [0.5, 0.82],
  [0.62, 0.4],
];
const SETTLE_MS = 700;
const COLLECT_MS = 1000;
const MAX_POINT_MS = 4000;
const MIN_POINT_SAMPLES = 8;
const MIN_TOTAL_SAMPLES = 60;
// how far behind the dot the eye may be, camera delay included
const PURSUIT_LAGS = [0, 50, 100, 150, 200, 250, 300, 350, 400];
// a head that turns this much with the dot is doing the eyes' job
const HEAD_FOLLOW_R = 0.5;
const HEAD_FOLLOW_DEGREES = 2;

const MODES: [CalibrationMode, string][] = [
  ['pursuit', 'Smooth path'],
  ['points', '13 points'],
];
const PHASES: Partial<Record<Step, string>> = {
  pursuit: 'Follow the dot',
  points: 'Calibrating',
  fitting: 'Fitting',
  validate: 'Checking accuracy',
};

const tone = (px: number) => (px < 60 ? 'good' : px < 120 ? 'fair' : 'poor');

const shuffle = <T,>(items: T[]) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// each point is its own cross-validation group
const pointSamples = (points: Dot<EyeFrame>[]) =>
  points.flatMap(({ target, samples }, group) =>
    fixationSamples(target, samples, group)
  );

// How much the head turned along with the dot: the correlation between where the
// face points and where the dot was, and the turn that adds up to across the
// screen. A head that follows the dot teaches the model to read the head instead
// of the eyes, which fails the moment you look without turning.
function headFollow(
  samples: CalibrationSample[],
  width: number,
  height: number
) {
  const axis = (feature: number, coordinate: 'x' | 'y', extent: number) => {
    const angles = samples.map(
      (sample) =>
        (Math.asin(Math.max(-1, Math.min(1, sample.features[feature]))) * 180) /
        Math.PI
    );
    const positions = samples.map((sample) => sample.client[coordinate]);
    const meanAngle = average(angles);
    const meanPosition = average(positions);
    let covariance = 0;
    let angleVariance = 0;
    let positionVariance = 0;
    angles.forEach((angle, i) => {
      covariance += (angle - meanAngle) * (positions[i] - meanPosition);
      angleVariance += (angle - meanAngle) ** 2;
      positionVariance += (positions[i] - meanPosition) ** 2;
    });
    if (!angleVariance || !positionVariance) return { r: 0, degrees: 0 };
    return {
      r: Math.abs(covariance / Math.sqrt(angleVariance * positionVariance)),
      degrees: Math.abs((covariance / positionVariance) * extent),
    };
  };
  // the face's forward axis: x leans with a turn, y with a nod
  const turn = axis(6, 'x', width);
  const nod = axis(7, 'y', height);
  return turn.r >= nod.r ? turn : nod;
}

// picks lambda (and for the pursuit, the eye lag) by cross-validation
function fitCalibration(pending: PendingFit) {
  const candidates: { lag: number | null; samples: CalibrationSample[] }[] =
    pending.kind === 'pursuit'
      ? PURSUIT_LAGS.map((lag) => ({
          lag,
          samples: pursuitSamples(pending.frames, pending.path, lag),
        }))
      : [{ lag: null, samples: pointSamples(pending.points) }];
  const usable = candidates.filter(
    (candidate) => candidate.samples.length >= MIN_TOTAL_SAMPLES
  );
  if (!usable.length) return null;
  const best = selectModel(usable);
  if (!best) return null;
  return {
    samples: best.samples,
    lambda: best.lambda,
    lag: best.lag,
    regions: regionMisses(best.heldOut, window.innerWidth, window.innerHeight),
    head: headFollow(best.samples, window.innerWidth, window.innerHeight),
  };
}

const centroid = (points: Point[]) => ({
  x: average(points.map((point) => point.x)),
  y: average(points.map((point) => point.y)),
});

// RMS distance from the centroid: how much the point trembles while you stare
const jitter = (points: Point[]) => {
  const center = centroid(points);
  return Math.sqrt(average(points.map((point) => distance(point, center) ** 2)));
};

// The miss is measured on the raw model output; jitter both raw and after the
// smoothing that is currently on, to see what the filter buys.
function scoreValidation(points: Dot<CheckSample>[]) {
  const scored = points.map(({ target, samples }): ValidationPoint => {
    if (!samples.length) return { target, mean: null };
    const raw = samples.map((sample) => sample.raw);
    const smoothed = samples
      .map((sample) => sample.point)
      .filter((point): point is Point => Boolean(point));
    const mean = centroid(raw);
    return {
      target,
      mean,
      error: distance(mean, target),
      spread: jitter(raw),
      smoothedSpread: smoothed.length ? jitter(smoothed) : null,
    };
  });
  const measured = scored.filter(
    (point): point is MeasuredPoint => point.mean !== null
  );
  const smoothed = measured.filter(
    (point): point is MeasuredPoint & { smoothedSpread: number } =>
      point.smoothedSpread !== null
  );
  return {
    points: scored,
    error: measured.length ? average(measured.map((p) => p.error)) : null,
    spread: measured.length ? average(measured.map((p) => p.spread)) : null,
    smoothedSpread: smoothed.length
      ? average(smoothed.map((p) => p.smoothedSpread))
      : null,
  };
}

type Props = {
  engine: GazeEngine;
  mode: CalibrationMode;
  onModeChange: (mode: CalibrationMode) => void;
  onDone: (result: ValidationResult) => void;
  onCancel: () => void;
};

export default function Calibration({
  engine,
  mode,
  onModeChange,
  onDone,
  onCancel,
}: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [dot, setDot] = useState<
    (Point & { key: string; collecting: boolean }) | null
  >(null);
  const [faceVisible, setFaceVisible] = useState(true);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [fit, setFit] = useState<ReturnType<typeof fitCalibration>>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pursuitDotRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PendingFit | null>(null);
  // the check dots' eye frames, learned from too once the result is accepted
  const checkRef = useRef<Dot<CheckSample>[] | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  useEffect(() => {
    if (step !== 'points' && step !== 'validate') return;

    const isCalibration = step === 'points';
    const layout = isCalibration
      ? shuffle(CALIBRATION_POINTS)
      : VALIDATION_POINTS;
    // calibration dots collect eye frames, check dots the gaze points as well
    const points: Dot<EyeFrame | CheckSample>[] = [];
    let current: Dot<EyeFrame | CheckSample> | null = null;
    let shownAt = 0;
    let collecting = false;
    let faceShown = true;
    let finished = false;

    const show = (index: number, time: number) => {
      const [fx, fy] = layout[index];
      current = {
        target: { x: fx * window.innerWidth, y: fy * window.innerHeight },
        samples: [],
      };
      points.push(current);
      shownAt = time;
      collecting = false;
      setDot({ ...current.target, key: `${step}-${index}`, collecting });
    };

    const finish = () => {
      finished = true;
      setDot(null);
      if (isCalibration) {
        pendingRef.current = {
          kind: 'points',
          points: points as Dot<EyeFrame>[],
        };
        setStep('fitting');
      } else {
        checkRef.current = points as Dot<CheckSample>[];
        setResult(scoreValidation(checkRef.current));
        setStep('result');
      }
    };

    const unsubscribe = engine.subscribe((frame) => {
      if (finished) return;
      if (!current) {
        show(0, frame.time);
        return;
      }
      if (frame.face !== faceShown) {
        faceShown = frame.face;
        setFaceVisible(frame.face);
      }

      const elapsed = frame.time - shownAt;
      if (elapsed < SETTLE_MS) return;
      if (!collecting) {
        collecting = true;
        setDot((prev) => prev && { ...prev, collecting });
      }

      if (frame.face && !frame.holding) {
        if (isCalibration && frame.features) {
          current.samples.push({
            features: frame.features,
            origin: viewportOrigin(),
          });
        } else if (!isCalibration && frame.raw) {
          current.samples.push({
            raw: frame.raw,
            point: frame.point,
            features: frame.features,
            origin: viewportOrigin(),
          });
        }
      }

      const done =
        elapsed >= SETTLE_MS + COLLECT_MS &&
        current.samples.length >= MIN_POINT_SAMPLES;
      if (done || elapsed >= MAX_POINT_MS) {
        if (points.length < layout.length) show(points.length, frame.time);
        else finish();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [step, engine]);

  // The dot glides along the path, drawn every animation frame; eye frames are
  // stored with their time on the path and paired with positions afterwards,
  // once the eye's lag is known.
  useEffect(() => {
    if (step !== 'pursuit') return;

    const path = createPursuitPath(window.innerWidth, window.innerHeight);
    const dotElement = pursuitDotRef.current!;
    const frames: PursuitFrame[] = [];
    let startedAt: number | null = null;
    let faceShown = true;
    let frameId = 0;

    const place = (ms: number) => {
      const { x, y } = path.at(ms);
      dotElement.style.transform = `translate(${x}px, ${y}px)`;
    };
    place(0);

    const animate = (now: number) => {
      if (startedAt === null) startedAt = now;
      const motion = now - startedAt - PURSUIT_HOLD_MS;
      place(motion);
      if (motion < path.duration) {
        frameId = requestAnimationFrame(animate);
      } else {
        pendingRef.current = { kind: 'pursuit', frames, path };
        setStep('fitting');
      }
    };
    frameId = requestAnimationFrame(animate);

    const unsubscribe = engine.subscribe((frame) => {
      if (frame.face !== faceShown) {
        faceShown = frame.face;
        setFaceVisible(frame.face);
      }
      if (startedAt === null || !frame.face || frame.holding) return;
      const motion = frame.time - startedAt - PURSUIT_HOLD_MS;
      if (motion < 0 || !frame.features) return;
      frames.push({ motion, features: frame.features, origin: viewportOrigin() });
    });

    return () => {
      cancelAnimationFrame(frameId);
      unsubscribe();
    };
  }, [step, engine]);

  // a beat for the "Fitting" label to paint before the cross-validation runs
  useEffect(() => {
    if (step !== 'fitting') return;
    const timer = setTimeout(() => {
      if (!pendingRef.current) return;
      const fitted = fitCalibration(pendingRef.current);
      pendingRef.current = null;
      if (!fitted) {
        setMessage(
          'Couldn’t see your eyes well enough. Face the camera, add some light and try again.'
        );
        setStep('intro');
        return;
      }
      engine.calibrate(fitted.samples, fitted.lambda);
      setFit(fitted);
      setStep('validate');
    }, 30);
    return () => clearTimeout(timer);
  }, [step, engine]);

  const start = async () => {
    setMessage(null);
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.().catch(() => {});
    }
    setStep(mode);
  };

  // The check dots were measured by a model that never saw them; once that number
  // is on screen they're simply the newest calibration data, taken while sitting
  // still and fixating — the way the pointer is used.
  const accept = () => {
    const extra = (checkRef.current ?? []).flatMap(({ target, samples }) =>
      fixationSamples(
        target,
        samples.filter(
          (sample): sample is CheckSample & { features: Features } =>
            sample.features !== null
        ),
        null
      )
    );
    if (fit && extra.length) {
      engine.calibrate([...fit.samples, ...extra], fit.lambda);
    }
    onDone(result!);
  };

  const isRunning = step in PHASES;

  return (
    <div
      className={styles.calibration}
      role="dialog"
      aria-modal="true"
      aria-label="Eye tracking calibration"
    >
      {step === 'intro' && (
        <div className={styles.card}>
          <h2>Calibrate</h2>
          <div className={styles.modes} role="group" aria-label="Calibration">
            {MODES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={() => onModeChange(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <p>
            {mode === 'pursuit'
              ? 'A dot glides slowly along the top of the screen, down a diagonal, along the bottom and back up. Follow it with your eyes only — about 20 seconds.'
              : 'A dot jumps around the screen 13 times. Look straight at it until its ring closes — about 20 seconds.'}{' '}
            Keep your head still and sit the way you will use it. Then 5 dots
            check how accurate the result is. Esc to cancel.
          </p>
          {message && (
            <p className={styles.message} role="alert">
              {message}
            </p>
          )}
          <div className={styles.actions}>
            <button className={styles.primary} onClick={start} autoFocus>
              Start
            </button>
            <button className={styles.ghost} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {isRunning && (
        <p className={styles.phase}>
          {PHASES[step]}
          {!faceVisible && (
            <span className={styles.warning}> · can’t see your face</span>
          )}
        </p>
      )}

      {step === 'pursuit' && (
        <div
          ref={pursuitDotRef}
          className={`${styles.dot} ${styles.dot__gliding}`}
        >
          <span className={styles.ring} />
        </div>
      )}

      {dot && (
        <div
          className={styles.dot}
          style={{ transform: `translate(${dot.x}px, ${dot.y}px)` }}
        >
          <span
            key={dot.key}
            className={`${styles.ring} ${
              dot.collecting ? styles.ring__closing : ''
            }`}
            style={{ animationDuration: `${COLLECT_MS}ms` }}
          />
        </div>
      )}

      {step === 'result' && result && (
        <>
          <svg className={styles.plot} aria-hidden="true">
            {result.points.map(({ target, mean, error }, i) => (
              <g key={i}>
                {mean && (
                  <line
                    x1={target.x}
                    y1={target.y}
                    x2={mean.x}
                    y2={mean.y}
                    className={styles.plotLine}
                  />
                )}
                <circle
                  cx={target.x}
                  cy={target.y}
                  r="10"
                  className={styles.plotTarget}
                />
                {mean && (
                  <circle
                    cx={mean.x}
                    cy={mean.y}
                    r="6"
                    className={styles.plotMean}
                  />
                )}
                {mean && (
                  <text
                    x={target.x + 16}
                    y={target.y - 14}
                    className={`${styles.plotLabel} ${
                      styles[`tone__${tone(error)}`]
                    }`}
                  >
                    {Math.round(error)} px
                  </text>
                )}
              </g>
            ))}
          </svg>
          <div className={`${styles.card} ${styles.card__corner}`}>
            <h2>
              {result.error === null
                ? 'No reading'
                : `±${Math.round(result.error)} px`}
            </h2>
            <p>
              {result.error === null
                ? 'The camera lost your face during the check.'
                : `Average miss at the five check points (rings → dots). Jitter ${Math.round(
                    result.spread!
                  )} px raw${
                    result.smoothedSpread === null
                      ? ''
                      : `, ${Math.round(result.smoothedSpread)} px smoothed`
                  }. “Use it” also learns from these five dots.`}
            </p>
            {fit &&
              fit.head.r >= HEAD_FOLLOW_R &&
              fit.head.degrees >= HEAD_FOLLOW_DEGREES && (
                <p className={styles.message}>
                  Your head followed the dot, so the model partly reads your
                  head instead of your eyes. Recalibrate keeping your head still
                  and moving only your eyes.
                </p>
              )}
            {fit && (
              <div className={styles.regions}>
                <div className={styles.regionGrid}>
                  {fit.regions.map((miss, i) => (
                    <span
                      key={i}
                      className={
                        miss === null ? '' : styles[`tone__${tone(miss)}`]
                      }
                    >
                      {miss === null ? '—' : Math.round(miss)}
                    </span>
                  ))}
                </div>
                <div className={styles.regionsText}>
                  <span className={styles.regionsTitle}>
                    Miss by screen region
                  </span>
                  <span className={styles.regionsNote}>
                    Each third of the screen predicted by a model that never saw
                    it · λ {fit.lambda}
                    {fit.lag !== null && ` · eye lag ${fit.lag} ms`} · head
                    turned {fit.head.degrees.toFixed(1)}° with the dot (r{' '}
                    {fit.head.r.toFixed(2)})
                  </span>
                </div>
              </div>
            )}
            <div className={styles.actions}>
              <button className={styles.primary} onClick={accept} autoFocus>
                Use it
              </button>
              <button
                className={styles.ghost}
                onClick={() => setStep(mode)}
              >
                Recalibrate
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
