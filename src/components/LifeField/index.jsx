import { useEffect, useRef } from 'react';
import styles from './index.module.css';
import { patterns } from './patterns';

const MAX_AGE = 90;
const MARGIN = 16;

const RAMP = [
  [1, [246, 242, 255]],
  [5, [196, 176, 255]],
  [14, [139, 92, 255]],
  [40, [86, 50, 206]],
  [MAX_AGE, [46, 28, 128]],
];

const TRAIL = 'rgb(112, 72, 255)';

const mix = (from, to, t) => Math.round(from + (to - from) * t);

const PALETTE = Array.from({ length: MAX_AGE + 1 }, (_, age) => {
  const stop = Math.max(
    RAMP.findIndex(([stopAge]) => stopAge >= age),
    1
  );
  const [fromAge, from] = RAMP[stop - 1];
  const [toAge, to] = RAMP[stop];
  const t = Math.min(Math.max((age - fromAge) / (toAge - fromAge), 0), 1);
  return `rgb(${mix(from[0], to[0], t)}, ${mix(from[1], to[1], t)}, ${mix(
    from[2],
    to[2],
    t
  )})`;
});

export default function LifeField({
  pattern,
  cellSize = 8,
  speed = 14,
  running = false,
  className = '',
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const animate =
      running && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const interval = 1000 / speed;
    const size = cellSize - 1;

    let cols = 0;
    let rows = 0;
    let gridCols = 0;
    let gridRows = 0;
    let cells = new Uint8Array(0);
    let next = new Uint8Array(0);
    let ages = new Uint8Array(0);
    let trail = new Float32Array(0);
    let seeded = false;
    let frameId = 0;

    const seed = () => {
      patterns[pattern].forEach(([x, y]) => {
        const i = (y + 2 + MARGIN) * gridCols + x + 3 + MARGIN;
        cells[i] = 1;
        ages[i] = 14;
      });
      seeded = true;
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < rows; y++) {
        const row = (y + MARGIN) * gridCols + MARGIN;
        for (let x = 0; x < cols; x++) {
          const i = row + x;
          if (cells[i]) {
            ctx.fillStyle = PALETTE[ages[i]];
            ctx.fillRect(x * cellSize, y * cellSize, size, size);
          } else if (trail[i] > 0.04) {
            ctx.globalAlpha = trail[i] * 0.4;
            ctx.fillStyle = TRAIL;
            ctx.fillRect(x * cellSize, y * cellSize, size, size);
            ctx.globalAlpha = 1;
          }
        }
      }
    };

    const step = () => {
      for (let y = 0; y < gridRows; y++) {
        for (let x = 0; x < gridCols; x++) {
          let neighbors = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= gridRows) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              if ((!dx && !dy) || nx < 0 || nx >= gridCols) continue;
              neighbors += cells[ny * gridCols + nx];
            }
          }
          const i = y * gridCols + x;
          const alive = cells[i];
          const lives = alive
            ? neighbors === 2 || neighbors === 3
            : neighbors === 3;
          next[i] = lives ? 1 : 0;
          if (lives) {
            ages[i] = alive ? Math.min(ages[i] + 1, MAX_AGE) : 1;
          } else {
            if (alive) trail[i] = 1;
            trail[i] *= 0.78;
            ages[i] = 0;
          }
        }
      }
      [cells, next] = [next, cells];
      for (let y = 0; y < gridRows; y++) {
        for (let x = 0; x < gridCols; x++) {
          if (
            x < MARGIN - 4 ||
            y < MARGIN - 4 ||
            x >= gridCols - MARGIN + 4 ||
            y >= gridRows - MARGIN + 4
          ) {
            cells[y * gridCols + x] = 0;
          }
        }
      }
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      const nextCols = Math.ceil(width / cellSize);
      const nextRows = Math.ceil(height / cellSize);
      const nextGridCols = nextCols + MARGIN * 2;
      const nextGridRows = nextRows + MARGIN * 2;
      const resizedCells = new Uint8Array(nextGridCols * nextGridRows);
      const resizedAges = new Uint8Array(resizedCells.length);
      for (let y = 0; y < Math.min(gridRows, nextGridRows); y++) {
        for (let x = 0; x < Math.min(gridCols, nextGridCols); x++) {
          resizedCells[y * nextGridCols + x] = cells[y * gridCols + x];
          resizedAges[y * nextGridCols + x] = ages[y * gridCols + x];
        }
      }
      cols = nextCols;
      rows = nextRows;
      gridCols = nextGridCols;
      gridRows = nextGridRows;
      cells = resizedCells;
      ages = resizedAges;
      next = new Uint8Array(cells.length);
      trail = new Float32Array(cells.length);
      if (!seeded) seed();
      draw();
    };

    let last = performance.now();
    let elapsed = 0;

    const tick = (now) => {
      frameId = requestAnimationFrame(tick);
      elapsed += Math.min(now - last, 200);
      last = now;
      if (elapsed < interval) return;
      while (elapsed >= interval) {
        step();
        elapsed -= interval;
      }
      draw();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    if (animate) frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [pattern, cellSize, speed, running]);

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.field} ${className}`}
      aria-hidden="true"
    />
  );
}
