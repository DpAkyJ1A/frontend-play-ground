import { useEffect, useRef, useState } from 'react';
import styles from './index.module.css';
import { viewportOrigin } from '../gazeEngine';
import { trimOutliers } from './samples';

const SETTLE_MS = 700;
const COLLECT_MS = 1000;
const MAX_MS = 4000;
const MIN_SAMPLES = 8;

// One dot in the middle of the screen, looked at for a second: how far the model
// has drifted since calibration (a slump in the chair moves everything at once),
// corrected on the spot. Done reports the shift in px, or null if the eyes
// couldn't be read.
export default function DriftCheck({ engine, onDone, onCancel }) {
  const [collecting, setCollecting] = useState(false);
  const [faceVisible, setFaceVisible] = useState(true);
  const [target] = useState(() => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }));
  // the check runs once, whatever the parent re-renders with
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  useEffect(() => {
    const frames = [];
    let shownAt = null;
    let faceShown = true;
    let finished = false;

    const unsubscribe = engine.subscribe((frame) => {
      if (finished) return;
      if (shownAt === null) shownAt = frame.time;
      if (frame.face !== faceShown) {
        faceShown = frame.face;
        setFaceVisible(frame.face);
      }
      const elapsed = frame.time - shownAt;
      if (elapsed < SETTLE_MS) return;
      setCollecting(true);
      if (frame.face && !frame.holding && frame.features) {
        frames.push({ features: frame.features, origin: viewportOrigin() });
      }

      const enough =
        elapsed >= SETTLE_MS + COLLECT_MS && frames.length >= MIN_SAMPLES;
      if (!enough && elapsed < MAX_MS) return;
      finished = true;
      if (!enough) {
        onDoneRef.current(null);
        return;
      }
      const kept = trimOutliers(frames);
      const origin = kept[kept.length - 1].origin;
      const stats = engine.recentre(
        kept.map((sample) => sample.features),
        { x: target.x + origin.x, y: target.y + origin.y }
      );
      onDoneRef.current(stats.recentred);
    });
    return unsubscribe;
  }, [engine, target]);

  return (
    <div
      className={styles.calibration}
      role="dialog"
      aria-modal="true"
      aria-label="Drift check"
    >
      <p className={styles.phase}>
        Look at the dot
        {!faceVisible && (
          <span className={styles.warning}> · can’t see your face</span>
        )}
      </p>
      <div
        className={styles.dot}
        style={{ transform: `translate(${target.x}px, ${target.y}px)` }}
      >
        <span
          className={`${styles.ring} ${collecting ? styles.ring__closing : ''}`}
          style={{ animationDuration: `${COLLECT_MS}ms` }}
        />
      </div>
    </div>
  );
}
