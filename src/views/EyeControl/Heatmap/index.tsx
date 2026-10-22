import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/utils/helpers';
import styles from './index.module.css';

// One heat cell per 6 × 6 px; the browser scales the canvas up smoothly.
const CELL = 6;
// heat a resting pointer adds per frame, and how fast it cools
const DWELL_HEAT = 0.018;
const POINTER_SIGMA = 42;
const COOLING = 0.994;
// a blob stops at 3 sigma, in a circle; its falloff is shifted down to reach
// exactly 0 there, so stacked blobs leave no seam
const REACH = 3;
const EDGE = Math.exp(-(REACH * REACH) / 2);

// the ramp eye-tracking heatmaps use: green, yellow, then orange where the
// eyes stayed longest
const RAMP: [at: number, r: number, g: number, b: number, a: number][] = [
  [0, 43, 212, 125, 0],
  [0.18, 43, 212, 125, 0.32],
  [0.5, 242, 212, 58, 0.48],
  [0.85, 255, 106, 61, 0.62],
  [1, 255, 106, 61, 0.7],
];

// the ramp as 256 RGBA entries, looked up per cell
const LUT = new Uint8ClampedArray(256 * 4);
for (let n = 0; n < 256; n++) {
  const v = n / 255;
  let i = 1;
  while (i < RAMP.length - 1 && RAMP[i][0] < v) i++;
  const [from, r0, g0, b0, a0] = RAMP[i - 1];
  const [to, r1, g1, b1, a1] = RAMP[i];
  const t = Math.min(Math.max((v - from) / (to - from), 0), 1);
  LUT.set(
    [
      r0 + (r1 - r0) * t,
      g0 + (g1 - g0) * t,
      b0 + (b1 - b0) * t,
      (a0 + (a1 - a0) * t) * 255,
    ],
    n * 4
  );
}

/**
 * A gaze heatmap behind the landing: seeded from the elements marked with
 * `data-heat` (their weight, 0–1), and warmed wherever a mouse rests, the way
 * fixations warm a real one. With touch or reduced motion only the seed shows.
 */
export default function Heatmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const host = canvas.parentElement!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const follow =
      window.matchMedia('(pointer: fine)').matches && !prefersReducedMotion();

    let cols = 0;
    let rows = 0;
    let seed = new Float32Array(0);
    let warm = new Float32Array(0);
    let image: ImageData | null = null;
    let pointer: { x: number; y: number } | null = null;
    let frameId = 0;
    let disposed = false;

    const addBlob = (
      field: Float32Array,
      x: number,
      y: number,
      sigma: number,
      amount: number
    ) => {
      const cx = x / CELL;
      const cy = y / CELL;
      const s = sigma / CELL;
      const reach = Math.ceil(s * REACH);
      for (let row = Math.max(Math.floor(cy - reach), 0); row < Math.min(cy + reach, rows); row++) {
        for (let col = Math.max(Math.floor(cx - reach), 0); col < Math.min(cx + reach, cols); col++) {
          const d2 = (col - cx) ** 2 + (row - cy) ** 2;
          const falloff = (Math.exp(-d2 / (2 * s * s)) - EDGE) / (1 - EDGE);
          if (falloff <= 0) continue;
          const i = row * cols + col;
          field[i] = Math.min(field[i] + amount * falloff, 1);
        }
      }
    };

    const render = () => {
      if (!image) return;
      const { data } = image;
      for (let i = 0; i < seed.length; i++) {
        const n = Math.round(Math.max(seed[i], warm[i]) * 255) * 4;
        data[i * 4] = LUT[n];
        data[i * 4 + 1] = LUT[n + 1];
        data[i * 4 + 2] = LUT[n + 2];
        data[i * 4 + 3] = LUT[n + 3];
      }
      ctx.putImageData(image, 0, 0);
    };

    const reseed = () => {
      if (disposed) return;
      const box = host.getBoundingClientRect();
      cols = Math.ceil(box.width / CELL);
      rows = Math.ceil(box.height / CELL);
      if (!cols || !rows) return;
      canvas.width = cols;
      canvas.height = rows;
      image = ctx.createImageData(cols, rows);
      if (warm.length !== cols * rows) warm = new Float32Array(cols * rows);
      seed = new Float32Array(cols * rows);
      host.querySelectorAll<HTMLElement>('[data-heat]').forEach((element) => {
        const rect = element.getBoundingClientRect();
        const weight = Number(element.dataset.heat) || 0.5;
        addBlob(
          seed,
          rect.left - box.left + rect.width / 2,
          rect.top - box.top + rect.height / 2,
          Math.min(Math.max(rect.width, rect.height) * 0.35, 120),
          weight
        );
      });
      render();
    };

    const tick = () => {
      let hottest = 0;
      for (let i = 0; i < warm.length; i++) {
        warm[i] *= COOLING;
        if (warm[i] > hottest) hottest = warm[i];
      }
      if (pointer) addBlob(warm, pointer.x, pointer.y, POINTER_SIGMA, DWELL_HEAT);
      render();
      frameId =
        pointer || hottest > 0.01 ? requestAnimationFrame(tick) : 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const box = host.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      pointer = x >= 0 && y >= 0 && x < box.width && y < box.height ? { x, y } : null;
      if (pointer && !frameId) frameId = requestAnimationFrame(tick);
    };
    const onPointerLeave = () => {
      pointer = null;
    };

    const resizeObserver = new ResizeObserver(reseed);
    resizeObserver.observe(host);
    document.fonts.ready.then(reseed);
    if (follow) {
      window.addEventListener('pointermove', onPointerMove);
      document.documentElement.addEventListener('pointerleave', onPointerLeave);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.heatmap} aria-hidden="true" />;
}
