import { useEffect, useRef } from 'react';
import styles from './index.module.css';
import { resolveCssVariables } from '@/utils/helpers';

const FONT = '600 13px var(--font-mono)';

// A gaze plot of three looks at the card: fixations sized by how long the eyes
// stayed (420, 312 and 540 ms), saccade lines between them, and the heat they
// leave behind.
const FIXATIONS = [
  { x: 0.3, y: 0.42, r: 20 },
  { x: 0.52, y: 0.26, r: 15 },
  { x: 0.7, y: 0.55, r: 24 },
];

// one look: the saccade draws, the fixation pops, the eyes dwell
const SACCADE = 180;
const POP = 240;
const DWELL = 500;
const LOOK = SACCADE + POP + DWELL;
const HOLD = 1400;
const FADE = 450;
const LOOP = FIXATIONS.length * LOOK + HOLD + FADE;

const LINE = 'rgba(233, 237, 240, 0.55)';
const RING = '#e9edf0';
const FILL = 'rgba(22, 25, 29, 0.72)';
const LABEL = '#e9edf0';
// heat ramp: green at the edge, yellow, orange where the eyes stayed longest
const HEAT: [stop: number, rgb: string, alpha: number][] = [
  [0, '255, 106, 61', 0.55],
  [0.4, '242, 212, 58', 0.32],
  [0.72, '43, 212, 125', 0.16],
  [1, '43, 212, 125', 0],
];

type Look = { line: number; pop: number; heat: number };

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeOutBack = (t: number) => {
  const c = 1.7;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

const settled: Look[] = FIXATIONS.map(() => ({ line: 1, pop: 1, heat: 1 }));

export type GazeFieldProps = {
  running?: boolean;
  className?: string;
};

export default function GazeField({
  running = false,
  className = '',
}: GazeFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const font = resolveCssVariables(FONT);
    const animate =
      running && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let scale = 1;
    let looks = settled;
    let fade = 1;
    let frameId = 0;
    let disposed = false;

    const at = (i: number) => ({
      x: FIXATIONS[i].x * width,
      y: FIXATIONS[i].y * height,
      r: FIXATIONS[i].r * scale,
    });

    const draw = () => {
      if (!width) return;
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = fade;

      ctx.globalCompositeOperation = 'lighter';
      looks.forEach((look, i) => {
        if (!look.heat) return;
        const { x, y, r } = at(i);
        const radius = r * (1.6 + 1.4 * look.heat);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        for (const [stop, rgb, alpha] of HEAT) {
          gradient.addColorStop(stop, `rgba(${rgb}, ${alpha * look.heat})`);
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      });
      ctx.globalCompositeOperation = 'source-over';

      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1.5;
      looks.forEach((look, i) => {
        if (!i || !look.line) return;
        const a = at(i - 1);
        const b = at(i);
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const sx = a.x + Math.cos(angle) * a.r;
        const sy = a.y + Math.sin(angle) * a.r;
        const ex = b.x - Math.cos(angle) * b.r;
        const ey = b.y - Math.sin(angle) * b.r;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (ex - sx) * look.line, sy + (ey - sy) * look.line);
        ctx.stroke();
      });

      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      looks.forEach((look, i) => {
        if (!look.pop) return;
        const { x, y, r } = at(i);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(r * easeOutBack(look.pop), 0), 0, Math.PI * 2);
        ctx.fillStyle = FILL;
        ctx.fill();
        ctx.strokeStyle = RING;
        ctx.stroke();
        ctx.globalAlpha = fade * look.pop;
        ctx.fillStyle = LABEL;
        ctx.fillText(String(i + 1), x, y + 1);
        ctx.globalAlpha = fade;
      });
      ctx.globalAlpha = 1;
    };

    let startedAt = 0;

    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const t = (now - startedAt) % LOOP;
      looks = FIXATIONS.map((_, i) => {
        const popAt = i * LOOK + SACCADE;
        return {
          line: i ? clamp01((t - i * LOOK) / SACCADE) : 0,
          pop: clamp01((t - popAt) / POP),
          heat: easeOut(clamp01((t - popAt) / (POP + DWELL))),
        };
      });
      fade = 1 - clamp01((t - (LOOP - FADE)) / FADE);
      draw();
      frameId = requestAnimationFrame(tick);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      width = rect.width;
      height = rect.height;
      scale = Math.min(Math.max(height / 150, 0.8), 1.3);
      draw();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    document.fonts.load(font).then(() => {
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
