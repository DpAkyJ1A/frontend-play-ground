import { useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { close } from 'ionicons/icons';
import { createPerfSample, getTimerResolution, readPerfSample } from './meter';
import styles from './index.module.css';

const READ_INTERVAL = 250;

const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const formatRate = (value) =>
  value < 100 ? value.toFixed(1) : compact.format(Math.round(value));

const formatDuration = (ms) => {
  if (ms >= 10) return `${Math.round(ms)} ms`;
  if (ms >= 1) return `${ms.toFixed(1)} ms`;
  const us = ms * 1000;
  if (us >= 10) return `${Math.round(us)} µs`;
  if (us >= 1) return `${us.toFixed(1)} µs`;
  return `${us.toFixed(2)} µs`;
};

const roundUp = (value) => {
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
};

const formatMeasured = (ms, floor) =>
  ms < floor ? `< ${formatDuration(roundUp(floor))}` : formatDuration(ms);

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
};

const getVerdict = (reading, running, budget) => {
  if (!running) {
    return { key: 'paused', title: 'Paused', note: 'Press play to measure.' };
  }
  if (!reading) {
    return { key: 'measuring', title: 'Measuring', note: 'Numbers in a moment.' };
  }
  if (reading.cappedShare < 0.5) {
    return {
      key: 'speed',
      title: 'Speed setting',
      note: 'The engine keeps up with the speed you set.',
      limit: true,
    };
  }
  if (reading.frame.paint > reading.frame.step) {
    return {
      key: 'paint',
      title: 'Paint',
      note: 'Drawing the field takes longer than simulating it.',
      limit: true,
    };
  }
  return {
    key: 'simulation',
    title: 'Simulation',
    note: `Generations use the whole ${budget} ms budget every frame.`,
    limit: true,
  };
};

export default function PerformanceHud({
  perfRef,
  running,
  targetSpeed,
  budget,
  resetKey,
  memory,
  pixelBytes,
  onClose,
}) {
  const [reading, setReading] = useState(null);

  useEffect(() => {
    const resolution = getTimerResolution();
    const sample = createPerfSample();
    perfRef.current = sample;
    setReading(null);
    const timer = setInterval(() => {
      const next = readPerfSample(sample, resolution, budget);
      if (next) setReading(next);
    }, READ_INTERVAL);
    return () => {
      clearInterval(timer);
      perfRef.current = null;
    };
  }, [perfRef, budget, resetKey]);

  const verdict = getVerdict(reading, running, budget);
  const frame = reading?.frame;
  const stepShare = frame ? Math.min(100, (frame.step / frame.total) * 100) : 0;
  const paintShare = frame
    ? Math.min(100 - stepShare, (frame.paint / frame.total) * 100)
    : 0;
  const measured = reading?.hasSteps;
  const approx = memory.estimated ? '≈ ' : '';
  const budgetPercent = reading ? reading.budget * 100 : 0;

  return (
    <section className={styles.hud} aria-label="Performance">
      <div className={styles.head}>
        <h3 className={styles.title}>Performance</h3>
        <button
          className={styles.close}
          aria-label="Hide performance stats"
          title="Hide (`)"
          onClick={onClose}
        >
          <IonIcon icon={close} aria-hidden="true" />
        </button>
      </div>
      <p className={styles.verdict} data-verdict={verdict.key}>
        {verdict.limit && <span className={styles.verdictLabel}>Limited by</span>}
        <strong className={styles.verdictTitle}>{verdict.title}</strong>
        <span className={styles.verdictNote}>{verdict.note}</span>
      </p>
      <div className={styles.frameBar} aria-hidden="true">
        <span className={styles.barStep} style={{ width: `${stepShare}%` }} />
        <span className={styles.barPaint} style={{ width: `${paintShare}%` }} />
      </div>
      <dl className={styles.metrics}>
        <div>
          <dt>Gen/s</dt>
          <dd>
            {reading ? formatRate(reading.genPerSecond) : '—'}{' '}
            <small>of {compact.format(targetSpeed)}</small>
          </dd>
        </div>
        <div>
          <dt>
            <span className={styles.swatchStep} aria-hidden="true" />
            Simulation
          </dt>
          <dd>
            {measured ? (
              <>
                {formatMeasured(reading.stepCost, reading.stepCostFloor)}{' '}
                <small>per gen</small>
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt>Budget used</dt>
          <dd>
            {!reading
              ? '—'
              : budgetPercent < 1
              ? '< 1%'
              : `${Math.round(budgetPercent)}%`}{' '}
            <small>of {budget} ms</small>
          </dd>
        </div>
        <div>
          <dt>
            <span className={styles.swatchPaint} aria-hidden="true" />
            Paint
          </dt>
          <dd>
            {measured
              ? formatMeasured(reading.paintCost, reading.paintCostFloor)
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Frame rate</dt>
          <dd>
            {reading ? (
              <>
                {Math.round(reading.fps)} <small>fps</small>
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className={styles.groupStart}>
          <dt>Field</dt>
          <dd>
            {approx}
            {formatBytes(memory.bytes)}
          </dd>
        </div>
        <div>
          <dt>Allocated</dt>
          <dd>
            {reading ? (
              <>
                {memory.perStep ? approx : ''}
                {formatBytes(memory.perStep * reading.genPerSecond)}
                <small>/s</small>
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt>Pixels</dt>
          <dd>{formatBytes(pixelBytes)}</dd>
        </div>
      </dl>
    </section>
  );
}
