import { useEffect, useState } from 'react';
import styles from './index.module.css';
import { viewportOrigin } from '../gazeEngine';

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

const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

// drop frames where the eyes were elsewhere (a glance away, a late saccade)
const trimOutliers = (samples) => {
  if (samples.length < 4) return samples;
  const axes = [0, 1].map((axis) => {
    const values = samples.map((sample) => sample.features[axis]);
    const center = median(values);
    const spread = median(values.map((value) => Math.abs(value - center)));
    return { center, limit: spread * 3 + 1e-4 };
  });
  return samples.filter((sample) =>
    axes.every(
      ({ center, limit }, axis) =>
        Math.abs(sample.features[axis] - center) <= limit
    )
  );
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const average = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// pairs of eye features and the dot they looked at, in screen coordinates
function trainingSamples(points) {
  const samples = [];
  for (const { target, samples: frames } of points) {
    for (const frame of trimOutliers(frames)) {
      samples.push({
        features: frame.features,
        target: {
          x: target.x + frame.origin.x,
          y: target.y + frame.origin.y,
        },
      });
    }
  }
  return samples.length >= MIN_TOTAL_SAMPLES ? samples : null;
}

const centroid = (points) => ({
  x: average(points.map((point) => point.x)),
  y: average(points.map((point) => point.y)),
});

// RMS distance from the centroid: how much the point trembles while you stare
const jitter = (points) => {
  const center = centroid(points);
  return Math.sqrt(average(points.map((point) => distance(point, center) ** 2)));
};

// The miss is measured on the raw model output; jitter both raw and after the
// smoothing that is currently on, to see what the filter buys.
function scoreValidation(points) {
  const scored = points.map(({ target, samples }) => {
    if (!samples.length) return { target, mean: null };
    const raw = samples.map((sample) => sample.raw);
    const smoothed = samples.map((sample) => sample.point).filter(Boolean);
    const mean = centroid(raw);
    return {
      target,
      mean,
      error: distance(mean, target),
      spread: jitter(raw),
      smoothedSpread: smoothed.length ? jitter(smoothed) : null,
    };
  });
  const measured = scored.filter((point) => point.mean);
  const smoothed = measured.filter((point) => point.smoothedSpread !== null);
  return {
    points: scored,
    error: measured.length ? average(measured.map((p) => p.error)) : null,
    spread: measured.length ? average(measured.map((p) => p.spread)) : null,
    smoothedSpread: smoothed.length
      ? average(smoothed.map((p) => p.smoothedSpread))
      : null,
  };
}

export default function Calibration({ engine, onDone, onCancel }) {
  const [step, setStep] = useState('intro');
  const [dot, setDot] = useState(null);
  const [faceVisible, setFaceVisible] = useState(true);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  useEffect(() => {
    if (step !== 'calibrate' && step !== 'validate') return;

    const isCalibration = step === 'calibrate';
    const layout = isCalibration
      ? shuffle(CALIBRATION_POINTS)
      : VALIDATION_POINTS;
    const points = [];
    let current = null;
    let shownAt = 0;
    let collecting = false;
    let faceShown = true;
    let finished = false;

    const show = (index, time) => {
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
        const samples = trainingSamples(points);
        if (!samples) {
          setMessage(
            'Couldn’t see your eyes well enough. Face the camera, add some light and try again.'
          );
          setStep('intro');
          return;
        }
        engine.calibrate(samples);
        setStep('validate');
      } else {
        setResult(scoreValidation(points));
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
        setDot((prev) => ({ ...prev, collecting }));
      }

      if (frame.face && !frame.holding) {
        if (isCalibration && frame.features) {
          current.samples.push({
            features: frame.features,
            origin: viewportOrigin(),
          });
        } else if (!isCalibration && frame.raw) {
          current.samples.push({ raw: frame.raw, point: frame.point });
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

  const start = async () => {
    setMessage(null);
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.().catch(() => {});
    }
    setStep('calibrate');
  };

  const isRunning = step === 'calibrate' || step === 'validate';

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
          <p>
            A dot will jump around the screen 13 times. Look straight at it until
            its ring closes — keep your head still and sit the way you will use
            it. Then 5 more dots check how accurate the result is. About 30
            seconds, Esc to cancel.
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
          {step === 'calibrate' ? 'Calibrating' : 'Checking accuracy'}
          {!faceVisible && (
            <span className={styles.warning}> · can’t see your face</span>
          )}
        </p>
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
            {result.points.map(({ target, mean }, i) => (
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
                : `Average miss at the five check points (hollow rings → filled dots). The raw point trembles by ${Math.round(
                    result.spread
                  )} px${
                    result.smoothedSpread === null
                      ? ''
                      : `, ${Math.round(result.smoothedSpread)} px once smoothed`
                  }. For reference, WebGazer is usually 100–200 px off.`}
            </p>
            <div className={styles.actions}>
              <button
                className={styles.primary}
                onClick={() => onDone(result)}
                autoFocus
              >
                Use it
              </button>
              <button
                className={styles.ghost}
                onClick={() => setStep('calibrate')}
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
