import { useEffect, useRef } from 'react';
import styles from './index.module.css';
import { PI_DIGITS } from './digits';

const QUERY = '999999';
const TARGET = PI_DIGITS.indexOf(QUERY);
const CELL_WIDTH = 13;
const CELL_HEIGHT = 20;
const PADDING_X = 22;
const TARGET_ROW = 0.55;
const SCAN_DURATION = 1700;
const TRAIL_DECAY = 0.9;
const FONT = '500 12px "Geist Mono", ui-monospace, monospace';

const DIGIT = [141, 137, 163];
const HOT = [246, 242, 255];
const HOT_COLOR = `rgb(${HOT})`;
const TRAIL = 'rgb(112, 72, 255)';
const MATCH = 'rgb(139, 92, 255)';

const mix = (from, to, t) =>
  `rgb(${from.map((value, i) => Math.round(value + (to[i] - value) * t))})`;

const easeOut = (t) => 1 - (1 - t) ** 3;

export default function PiField({ running = false, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const animate =
      running && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let cols = 0;
    let rows = 0;
    let first = 0;
    let head = TARGET;
    let heat = new Float32Array(0);
    let frameId = 0;
    let disposed = false;

    const draw = () => {
      const offsetX = (width - cols * CELL_WIDTH) / 2;
      const landed = head === TARGET;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let cell = 0; cell < cols * rows; cell++) {
        const index = first + cell;
        if (index >= PI_DIGITS.length) break;

        const x = offsetX + (cell % cols) * CELL_WIDTH;
        const y = Math.floor(cell / cols) * CELL_HEIGHT;
        const inWindow = index >= head && index < head + QUERY.length;

        if (inWindow) {
          ctx.fillStyle = landed ? MATCH : TRAIL;
          ctx.globalAlpha = landed ? 1 : 0.55;
          ctx.fillRect(x, y + 2, CELL_WIDTH, CELL_HEIGHT - 4);
          ctx.globalAlpha = 1;
        } else if (heat[cell] > 0.02) {
          ctx.fillStyle = TRAIL;
          ctx.globalAlpha = heat[cell] * 0.3;
          ctx.fillRect(x, y + 2, CELL_WIDTH, CELL_HEIGHT - 4);
          ctx.globalAlpha = 1;
        }

        ctx.fillStyle = inWindow ? HOT_COLOR : mix(DIGIT, HOT, heat[cell]);
        ctx.fillText(PI_DIGITS[index], x + CELL_WIDTH / 2, y + CELL_HEIGHT / 2);
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      width = rect.width;
      cols = Math.max(Math.floor((rect.width - PADDING_X * 2) / CELL_WIDTH), 1);
      rows = Math.ceil(rect.height / CELL_HEIGHT);
      first = Math.max(
        (Math.floor(TARGET / cols) - Math.floor(rows * TARGET_ROW)) * cols,
        0
      );
      heat = new Float32Array(cols * rows);
      draw();
    };

    let startedAt = 0;
    let last = 0;

    const tick = (now) => {
      if (!startedAt) {
        startedAt = now;
        last = now;
        head = first;
      }

      const progress = Math.min((now - startedAt) / SCAN_DURATION, 1);
      const decay = TRAIL_DECAY ** ((now - last) / 16.7);
      const previous = head;
      head = Math.round(first + (TARGET - first) * easeOut(progress));
      last = now;

      let hottest = 0;
      for (let cell = 0; cell < heat.length; cell++) {
        heat[cell] *= decay;
        const index = first + cell;
        if (index >= previous && index < head + QUERY.length) heat[cell] = 1;
        if (index >= head && index < head + QUERY.length) heat[cell] = 0;
        hottest = Math.max(hottest, heat[cell]);
      }

      draw();
      if (progress < 1 || hottest > 0.02) frameId = requestAnimationFrame(tick);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    document.fonts.load(FONT).then(() => {
      if (!disposed) draw();
    });
    if (animate) frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [running]);

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.field} ${className}`}
      aria-hidden="true"
    />
  );
}
