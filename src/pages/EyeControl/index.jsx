import { useCallback, useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { contractOutline, expandOutline } from 'ionicons/icons';
import styles from './index.module.css';
import { Header } from '@/layout';
import { createGazeEngine } from './gazeEngine';
import Arena from './Arena';
import Calibration from './Calibration';
import Preview from './Preview';
import Tuning from './Tuning';

const DEFAULT_SETTINGS = {
  snap: true,
  snapRadius: 120,
  showRaw: false,
  dwell: true,
  dwellMs: 900,
  blinks: true,
  blinkThreshold: 0.5,
  minCutoff: 0.6,
  beta: 0.003,
  noise: 60,
  showPreview: true,
};

const describeCameraError = (error) => {
  if (error?.name === 'NotAllowedError')
    return 'Camera access is blocked. Allow it in the address bar and try again.';
  if (error?.name === 'NotFoundError') return 'No camera found.';
  return `Couldn’t start the face tracker: ${error?.message ?? error}`;
};

export default function EyeControl() {
  const [engine] = useState(createGazeEngine);
  const [status, setStatus] = useState('idle');
  const [source, setSource] = useState(null);
  const [calibrating, setCalibrating] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => () => engine.stop(), [engine]);

  useEffect(() => {
    engine.setFilter({ minCutoff: settings.minCutoff, beta: settings.beta });
    engine.setNoise(settings.noise);
    engine.setBlinkThreshold(settings.blinkThreshold);
  }, [
    engine,
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
      if (!(await engine.startCamera(videoRef.current))) return;
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

  const finishCalibration = useCallback((result) => {
    setAccuracy(result);
    setCalibrating(false);
  }, []);

  const cancelCalibration = useCallback(() => setCalibrating(false), []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  // switching mouse → camera keeps the workspace up while the model loads
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
                        accuracy.spread
                      )} px`
                    : 'Not calibrated'}
                </span>
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
                <IonIcon icon={isFullscreen ? contractOutline : expandOutline} />
              </button>
              <Tuning
                settings={settings}
                source={source}
                onChange={(patch) =>
                  setSettings((prev) => ({ ...prev, ...patch }))
                }
              />
              <button className={styles.toolButton} onClick={stop}>
                Stop
              </button>
            </div>
          </div>
          <Arena engine={engine} settings={settings} active={!calibrating} />
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
                <strong>Calibrate.</strong> Follow 13 dots with your eyes, then
                5 more to measure the error.
              </li>
              <li>
                <strong>Aim.</strong> The ring follows your gaze and snaps to the
                closest button.
              </li>
              <li>
                <strong>Click.</strong> Hold your gaze, or blink twice — three
                times flags a button, like a right click.
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

      {calibrating && (
        <Calibration
          engine={engine}
          onDone={finishCalibration}
          onCancel={cancelCalibration}
        />
      )}
    </div>
  );
}
