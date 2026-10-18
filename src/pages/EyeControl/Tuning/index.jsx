import { IonIcon } from '@ionic/react';
import { optionsOutline } from 'ionicons/icons';
import styles from './index.module.css';

const SMOOTHING_MODES = [
  ['fixation', 'Fixation average'],
  ['oneEuro', 'One Euro'],
];

function Switch({ label, checked, onChange }) {
  return (
    <label className={styles.switchField}>
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function Range({ label, value, min, max, step, format, onChange }) {
  return (
    <label className={styles.rangeField}>
      <span className={styles.rangeHead}>
        <span>{label}</span>
        <output>{format ? format(value) : value}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${((value - min) / (max - min)) * 100}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function Tuning({ settings, source, onChange }) {
  const set = (key) => (value) => onChange({ [key]: value });

  return (
    <details className={styles.tuning}>
      <summary className={styles.summary}>
        <IonIcon icon={optionsOutline} aria-hidden="true" />
        Tuning
      </summary>
      <div className={styles.panel}>
        <section className={styles.group}>
          <h3>Aim</h3>
          <Switch
            label="Snap to the nearest button"
            checked={settings.snap}
            onChange={set('snap')}
          />
          {settings.snap && (
            <Range
              label="Snap radius"
              value={settings.snapRadius}
              min={20}
              max={240}
              step={10}
              format={(v) => `${v} px`}
              onChange={set('snapRadius')}
            />
          )}
          <Switch
            label="Show raw gaze"
            checked={settings.showRaw}
            onChange={set('showRaw')}
          />
        </section>

        <section className={styles.group}>
          <h3>Click</h3>
          <Switch
            label="Dwell — hold your gaze"
            checked={settings.dwell}
            onChange={set('dwell')}
          />
          {settings.dwell && (
            <Range
              label="Dwell time"
              value={settings.dwellMs}
              min={300}
              max={2000}
              step={50}
              format={(v) => `${v} ms`}
              onChange={set('dwellMs')}
            />
          )}
          <Switch
            label="Blinks — 2 click, 3 flag"
            checked={settings.blinks}
            onChange={set('blinks')}
          />
          <Range
            label="Blink threshold"
            value={settings.blinkThreshold}
            min={0.2}
            max={0.9}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={set('blinkThreshold')}
          />
        </section>

        <section className={styles.group}>
          <h3>Smoothing</h3>
          <div className={styles.segmented} role="group" aria-label="Smoothing">
            {SMOOTHING_MODES.map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={settings.smoothing === mode}
                onClick={() => onChange({ smoothing: mode })}
              >
                {label}
              </button>
            ))}
          </div>
          {settings.smoothing === 'fixation' ? (
            <>
              <Range
                label="Saccade threshold"
                value={settings.fixationRadius}
                min={30}
                max={250}
                step={5}
                format={(v) => `${v} px`}
                onChange={set('fixationRadius')}
              />
              <Range
                label="Average over"
                value={settings.fixationWindow}
                min={200}
                max={2000}
                step={100}
                format={(v) => `${v} ms`}
                onChange={set('fixationWindow')}
              />
              <p className={styles.note}>
                The threshold is set from your jitter after calibration.
              </p>
            </>
          ) : (
            <>
              <Range
                label="Calm when still (min cutoff)"
                value={settings.minCutoff}
                min={0.05}
                max={3}
                step={0.05}
                format={(v) => `${v.toFixed(2)} Hz`}
                onChange={set('minCutoff')}
              />
              <Range
                label="Follow jumps (beta)"
                value={settings.beta}
                min={0}
                max={0.05}
                step={0.001}
                format={(v) => v.toFixed(3)}
                onChange={set('beta')}
              />
            </>
          )}
        </section>

        <section className={styles.group}>
          <h3>Source</h3>
          {source === 'mouse' ? (
            <>
              <Range
                label="Simulated webcam error"
                value={settings.noise}
                min={0}
                max={200}
                step={5}
                format={(v) => `σ ${v} px`}
                onChange={set('noise')}
              />
              <p className={styles.note}>
                Hold <kbd className={styles.kbd}>B</kbd> to fake a blink.
              </p>
            </>
          ) : (
            <Switch
              label="Camera preview"
              checked={settings.showPreview}
              onChange={set('showPreview')}
            />
          )}
        </section>
      </div>
    </details>
  );
}
