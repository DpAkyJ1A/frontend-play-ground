'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { ExpandIcon, ShrinkIcon } from 'lucide-react';
import styles from './index.module.css';
import { Header } from '@/layout';
import {
  createGazeEngine,
  type GazeSource,
  type Smoothing,
} from './gazeEngine';
import type { LearningStats } from './trainer';
import Arena from './Arena';
import Calibration, {
  type CalibrationMode,
  type ValidationResult,
} from './Calibration';
import DriftCheck from './Calibration/DriftCheck';
import Preview from './Preview';
import Tuning from './Tuning';

const DEFAULT_SETTINGS = {
  snap: true,
  snapRadius: 120,
  showRaw: false,
  dwell: true,
  dwellMs: 900,
  loupe: true,
  loupeZoom: 3,
  loupeOnlyCrowded: true,
  nudge: true,
  nudgeSensitivity: 1,
  blinks: true,
  blinkThreshold: 0.5,
  learn: true,
  calibrationMode: 'pursuit' as CalibrationMode,
  smoothing: 'fixation' as Smoothing,
  fixationRadius: 100,
  fixationWindow: 1000,
  minCutoff: 0.6,
  beta: 0.003,
  noise: 40,
  showPreview: true,
};

export type Settings = typeof DEFAULT_SETTINGS;

// A saccade has to clear twice the raw jitter measured at the check points, so
// noise alone almost never breaks a fixation.
const fixationRadiusFor = (spread: number) =>
  Math.min(Math.max(Math.round((spread * 2) / 5) * 5, 40), 200);

// How far from the gaze point the button you mean can be: the calibration's
// error with half again as slack, or 2σ of the simulated error with the mouse.
// The loupe shows this much around the gaze.
const reachFor = (
  source: GazeSource | null,
  accuracy: ValidationResult | null,
  noise: number
) => {
  const reach =
    source === 'mouse' ? noise * 2 : (accuracy?.error ?? 80) * 1.5;
  return Math.round(Math.min(Math.max(reach, 60), 240));
};

// getUserMedia rejects with a DOMException (an Error), MediaPipe with anything
const describeCameraError = (error: unknown) => {
  const name = error instanceof Error ? error.name : undefined;
  if (name === 'NotAllowedError')
    return 'Camera access is blocked. Allow it in the address bar and try again.';
  if (name === 'NotFoundError') return 'No camera found.';
  return `Couldn’t start the face tracker: ${
    error instanceof Error ? error.message : error
  }`;
};

export default function EyeControl() {
  const [engine] = useState(createGazeEngine);
  const [status, setStatus] = useState<'idle' | 'starting' | 'running'>(
    'idle'
  );
  const [source, setSource] = useState<GazeSource | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [accuracy, setAccuracy] = useState<ValidationResult | null>(null);
  const [learning, setLearning] = useState<LearningStats | null>(null);
  // a drift check on screen, and what to do once it's done
  const [recentring, setRecentring] = useState<{ next?: () => void } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => () => engine.stop(), [engine]);

  useEffect(() => {
    engine.setFilter({
      mode: settings.smoothing,
      radius: settings.fixationRadius,
      windowMs: settings.fixationWindow,
      minCutoff: settings.minCutoff,
      beta: settings.beta,
    });
    engine.setNoise(settings.noise);
    engine.setBlinkThreshold(settings.blinkThreshold);
  }, [
    engine,
    settings.smoothing,
    settings.fixationRadius,
    settings.fixationWindow,
    settings.minCutoff,
    settings.beta,
    settings.noise,
    settings.blinkThreshold,
  ]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const startCamera = async () => {
    setStatus('starting');
    setError(null);
    try {
      if (!(await engine.startCamera(videoRef.current!))) return;
      setSource('camera');
      setStatus('running');
      setCalibrating(true);
    } catch (cameraError) {
      // starting the camera stopped the previous source: bring the mouse back
      if (source === 'mouse') {
        engine.startMouse();
        setStatus('running');
      } else {
        setStatus('idle');
      }
      setError(describeCameraError(cameraError));
    }
  };

  const startMouse = () => {
    engine.startMouse();
    setSource('mouse');
    setStatus('running');
    setCalibrating(false);
    setError(null);
  };

  const stop = () => {
    engine.stop();
    setSource(null);
    setStatus('idle');
    setCalibrating(false);
    setAccuracy(null);
  };

  // a calibration starts the click memory over
  const finishCalibration = useCallback((result: ValidationResult) => {
    setAccuracy(result);
    setLearning(engine.learningStats());
    setCalibrating(false);
    if (result.spread !== null) {
      setSettings((prev) => ({
        ...prev,
        fixationRadius: fixationRadiusFor(result.spread!),
      }));
    }
  }, [engine]);

  const cancelCalibration = useCallback(() => {
    setLearning(engine.learningStats());
    setCalibrating(false);
  }, [engine]);

  const finishRecentre = useCallback(() => {
    setLearning(engine.learningStats());
    setRecentring(null);
    recentring?.next?.();
  }, [engine, recentring]);

  const cancelRecentre = useCallback(() => setRecentring(null), []);

  // with a calibrated camera every test starts with a drift check, the way lab
  // eye trackers re-check between trials
  const startTest = (begin: () => void) => {
    if (source === 'camera' && accuracy) setRecentring({ next: begin });
    else begin();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  // switching mouse → camera keeps the workspace up while the model loads
  const reach = reachFor(source, accuracy, settings.noise);

  const isRunning =
    status === 'running' || (status === 'starting' && source !== null);

  return (
    <div
      className={`${styles.eyeControlPage} ${
        isRunning ? styles.eyeControlPage__running : ''
      }`}
    >
      <Header>
        <h2 className={styles.pageTitle}>Eye Control</h2>
      </Header>

      {isRunning ? (
        <main className={styles.workspace}>
          <div className={styles.toolbar}>
            <div
              className={styles.segmented}
              role="group"
              aria-label="Gaze source"
            >
              <button
                aria-pressed={source === 'camera'}
                onClick={() => source !== 'camera' && startCamera()}
              >
                Camera
              </button>
              <button
                aria-pressed={source === 'mouse'}
                onClick={() => source !== 'mouse' && startMouse()}
              >
                Mouse
              </button>
            </div>
            {source === 'camera' && (
              <>
                <span className={styles.chip}>
                  {accuracy?.error
                    ? `±${Math.round(accuracy.error)} px · jitter ${Math.round(
                        accuracy.smoothedSpread ?? accuracy.spread!
                      )} px`
                    : 'Not calibrated'}
                  {learning?.recentred != null &&
                    ` · drift ${Math.round(learning.recentred)} px fixed`}
                  {learning?.recentMiss != null &&
                    ` · last clicks ±${Math.round(learning.recentMiss)} px`}
                </span>
                {accuracy && (
                  <button
                    className={styles.toolButton}
                    onClick={() => setRecentring({})}
                    title="Look at one dot to correct drift since calibration"
                  >
                    Recentre
                  </button>
                )}
                <button
                  className={styles.toolButton}
                  onClick={() => setCalibrating(true)}
                >
                  Calibrate
                </button>
                {settings.showPreview && (
                  <Preview engine={engine} videoRef={videoRef} />
                )}
              </>
            )}
            {source === 'mouse' && (
              <span className={styles.chip}>
                Mouse + σ {settings.noise} px of webcam-like error
              </span>
            )}
            {status === 'starting' && (
              <span className={styles.chip}>Loading face model…</span>
            )}
            {error && (
              <span className={styles.error} role="alert">
                {error}
              </span>
            )}
            <div className={styles.toolbarEnd}>
              <button
                className={styles.iconButton}
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                <Icon icon={isFullscreen ? ShrinkIcon : ExpandIcon} />
              </button>
              <Tuning
                engine={engine}
                settings={settings}
                source={source}
                reach={reach}
                learnedClicks={learning?.clicks ?? 0}
                onForget={() => setLearning(engine.forgetClicks())}
                onChange={(patch) =>
                  setSettings((prev) => ({ ...prev, ...patch }))
                }
              />
              <button className={styles.toolButton} onClick={stop}>
                Stop
              </button>
            </div>
          </div>
          <Arena
            engine={engine}
            settings={settings}
            reach={reach}
            active={!calibrating && !recentring}
            onLearn={setLearning}
            onStartTest={startTest}
          />
        </main>
      ) : (
        <main className={styles.main}>
          <section className={styles.hero}>
            <h1 className={styles.title}>Click with your eyes.</h1>
            <p className={styles.lede}>
              A webcam, a 30-second calibration and a cursor that sticks to the
              nearest button. A spike to find out whether webcam eye tracking is
              good enough to steer a real page.
            </p>
            <div className={styles.actions}>
              <button
                className={styles.button}
                onClick={startCamera}
                disabled={status === 'starting'}
              >
                {status === 'starting' ? 'Loading face model…' : 'Start camera'}
              </button>
              <button className={styles.buttonGhost} onClick={startMouse}>
                Try with the mouse
              </button>
            </div>
            {error && (
              <p className={styles.heroError} role="alert">
                {error}
              </p>
            )}
            <ol className={styles.steps}>
              <li>
                <strong>Calibrate.</strong> Follow a dot gliding across the
                screen, then 5 more dots measure the error.
              </li>
              <li>
                <strong>Aim.</strong> The ring follows your gaze and snaps to the
                closest button. Landed next to it? Raise your brows, drop your
                jaw or pull your mouth sideways to nudge it over.
              </li>
              <li>
                <strong>Click.</strong> Hold your gaze — where buttons are
                crowded, a ×3 loupe opens and you pick inside it. Or blink
                twice; three times flags a button, like a right click.
              </li>
            </ol>
            <p className={styles.note}>
              Video never leaves this tab: frames go to a face model running in
              your browser.
            </p>
          </section>
        </main>
      )}

      {/* the tracker's frame source; the toolbar preview draws from it */}
      <video ref={videoRef} className={styles.video} playsInline muted />

      {recentring && (
        <DriftCheck
          engine={engine}
          onDone={finishRecentre}
          onCancel={cancelRecentre}
        />
      )}

      {calibrating && (
        <Calibration
          engine={engine}
          mode={settings.calibrationMode}
          onModeChange={(calibrationMode) =>
            setSettings((prev) => ({ ...prev, calibrationMode }))
          }
          onDone={finishCalibration}
          onCancel={cancelCalibration}
        />
      )}
    </div>
  );
}
