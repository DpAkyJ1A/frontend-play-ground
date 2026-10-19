import { useEffect, useRef, type RefObject } from 'react';
import styles from './index.module.css';
import { DEBUG_POINTS } from '../features';
import type { GazeEngine } from '../gazeEngine';

const WIDTH = 192;
const HEIGHT = 108;

// A thumbnail of the camera with the eye corners and irises the model sees, plus
// live blink levels against the threshold — the first place to look when tracking
// is off. Small and in the toolbar, so it never covers a target.
type Props = {
  engine: GazeEngine;
  videoRef: RefObject<HTMLVideoElement | null>;
};

export default function Preview({ engine, videoRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const leftRef = useRef<HTMLSpanElement>(null);
  const rightRef = useRef<HTMLSpanElement>(null);
  const thresholdRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d');
    if (!ctx) return;
    return engine.subscribe((frame) => {
      const video = videoRef.current;
      if (!video?.videoWidth) return;

      // cover-crop the camera into the thumbnail, mirrored like a mirror
      const scale = Math.max(WIDTH / video.videoWidth, HEIGHT / video.videoHeight);
      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;
      const left = (WIDTH - width) / 2;
      const top = (HEIGHT - height) / 2;
      ctx.setTransform(-1, 0, 0, 1, WIDTH, 0);
      ctx.drawImage(video, left, top, width, height);
      if (frame.landmarks) {
        ctx.fillStyle = '#ff6a3d';
        for (const index of DEBUG_POINTS) {
          const { x, y } = frame.landmarks[index];
          ctx.beginPath();
          ctx.arc(left + x * width, top + y * height, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const status = statusRef.current!;
      status.textContent = frame.face ? `${frame.fps} fps` : 'No face';
      status.dataset.ok = String(frame.face);
      leftRef.current!.style.setProperty('--level', String(frame.blinkLeft));
      rightRef.current!.style.setProperty('--level', String(frame.blinkRight));
      thresholdRef.current!.style.setProperty(
        '--level',
        String(frame.blinkThreshold)
      );
    });
  }, [engine, videoRef]);

  return (
    <div className={styles.preview}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={WIDTH}
        height={HEIGHT}
        aria-label="Camera preview with tracked eye points"
      />
      <div className={styles.meta}>
        <span ref={statusRef} className={styles.status}>
          …
        </span>
        <span className={styles.blink} title="Blink level, left and right eye">
          <span ref={leftRef} className={styles.level} />
          <span ref={rightRef} className={styles.level} />
          <span ref={thresholdRef} className={styles.threshold} />
        </span>
      </div>
    </div>
  );
}
