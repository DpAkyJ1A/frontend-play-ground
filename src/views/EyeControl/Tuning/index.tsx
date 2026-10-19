import type { CSSProperties } from 'react';
import Icon from '@/components/Icon';
import { SlidersHorizontalIcon } from 'lucide-react';
import styles from './index.module.css';
import type { Settings } from '..';
import type { GazeEngine, GazeSource, Smoothing } from '../gazeEngine';
import GestureMeters from './GestureMeters';

const LOUPE_ZOOMS = [2, 3, 4];
const SMOOTHING_MODES: [Smoothing, string][] = [
  ['fixation', 'Fixation average'],
  ['oneEuro', 'One Euro'],
];

type SwitchProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function Switch({ label, checked, onChange }: SwitchProps) {
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

type RangeProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
};

function Range({ label, value, min, max, step, format, onChange }: RangeProps) {
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
        style={
          {
            '--fill': `${((value - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

type Props = {
  engine: GazeEngine;
  settings: Settings;
  source: GazeSource | null;
  reach: number;
  learnedClicks: number;
  onForget: () => void;
  onChange: (patch: Partial<Settings>) => void;
};

export default function Tuning({
  engine,
  settings,
  source,
  reach,
  learnedClicks,
  onForget,
  onChange,
}: Props) {
  const set =
    <K extends keyof Settings>(key: K) =>
    (value: Settings[K]) =>
      onChange({ [key]: value } as Pick<Settings, K>);

  return (
    <details className={styles.tuning}>
      <summary className={styles.summary}>
        <Icon icon={SlidersHorizontalIcon} aria-hidden="true" />
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
          {settings.dwell && (
            <Switch
              label="Loupe — magnify, then pick"
              checked={settings.loupe}
              onChange={set('loupe')}
            />
          )}
          {settings.dwell && settings.loupe && (
            <>
              <div
                className={styles.segmented}
                role="group"
                aria-label="Loupe zoom"
              >
                {LOUPE_ZOOMS.map((zoom) => (
                  <button
                    key={zoom}
                    type="button"
                    aria-pressed={settings.loupeZoom === zoom}
                    onClick={() => onChange({ loupeZoom: zoom })}
                  >
                    ×{zoom}
                  </button>
                ))}
              </div>
              <Switch
                label="Only where buttons are crowded"
                checked={settings.loupeOnlyCrowded}
                onChange={set('loupeOnlyCrowded')}
              />
              <p className={styles.note}>
                Shows ±{reach} px around your gaze —{' '}
                {source === 'mouse'
                  ? 'twice the simulated error'
                  : '1.5× your calibration error'}
                , zoomed less if that won’t fit the screen.
              </p>
            </>
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
          <h3>Nudge</h3>
          <Switch
            label="Nudge with face gestures"
            checked={settings.nudge}
            onChange={set('nudge')}
          />
          {settings.nudge && (
            <>
              <Range
                label="Gesture sensitivity"
                value={settings.nudgeSensitivity}
                min={0.5}
                max={2}
                step={0.1}
                format={(v) => `×${v.toFixed(1)}`}
                onChange={set('nudgeSensitivity')}
              />
              <GestureMeters
                engine={engine}
                sensitivity={settings.nudgeSensitivity}
              />
              <p className={styles.note}>
                When the pointer lands next to what you look at, push it there:
                one gesture moves it one button (a small step without snapping),
                hold to repeat. Then click as usual, and the corrected spot is
                learned.
                {source === 'mouse' && ' With the mouse: arrow keys.'}
              </p>
            </>
          )}
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
          <h3>{source === 'mouse' ? 'Source' : 'Camera'}</h3>
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
            <>
              <Switch
                label="Learn from clicks"
                checked={settings.learn}
                onChange={set('learn')}
              />
              <p className={styles.note}>
                Every button you press with your eyes becomes a calibration
                point, so the model keeps up when you shift in the chair.
              </p>
              <button
                type="button"
                className={styles.forget}
                onClick={onForget}
                disabled={!learnedClicks}
              >
                Forget {learnedClicks} learned{' '}
                {learnedClicks === 1 ? 'click' : 'clicks'}
              </button>
              <Switch
                label="Camera preview"
                checked={settings.showPreview}
                onChange={set('showPreview')}
              />
            </>
          )}
        </section>
      </div>
    </details>
  );
}
