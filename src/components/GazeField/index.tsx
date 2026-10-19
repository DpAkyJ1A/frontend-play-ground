import { useEffect, useRef } from 'react';
import styles from './index.module.css';
import { resolveCssVariables } from '@/utils/helpers';

const COLS = 4;
const ROWS = 3;
const PADDING_X = 22;
const PADDING_Y = 12;
const BUTTON_HEIGHT = 22;
const BUTTON_RADIUS = 6;
const RING_RADIUS = 9;
const RING_PADDING = 5;
const LANDING_ERROR = 12;
const SAMPLE_SPREAD = 7;
const SAMPLE_DECAY = 0.88;
const MAX_PRESSED = 3;
const FONT = '500 10px var(--font-mono)';

// one gaze step: jump to a button, snap onto it, dwell, click
const SACCADE = 300;
const SNAP = 160;
const DWELL = 900;
const CLICK = 340;
const STEP = SACCADE + SNAP + DWELL + CLICK;

const BUTTON = '#1b1826';
const BUTTON_EDGE = '#3a3550';
const LABEL = 'rgb(141, 137, 163)';
const PRESSED = 'rgb(139, 92, 255)';
const RING = '#c4b0ff';
const DWELL_FILL = 'rgba(139, 92, 255, 0.45)';

type Point = { x: number; y: number };
type Rect = Point & { w: number; h: number };
type Box = Rect & { r: number };
type Button = Rect & { label: string };
type Ring = Box & { progress: number; flash: number };
type Sample = Point & { life: number };

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

const lerpBox = (a: Box, b: Box, t: number): Box => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
  r: a.r + (b.r - a.r) * t,
});

const gaussian = () =>
  Math.sqrt(-2 * Math.log(1 - Math.random())) *
  Math.cos(2 * Math.PI * Math.random());

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
    let buttons: Button[] = [];
    let samples: Sample[] = [];
    const pressed = new Set([1, 10]);
    let from = 5;
    let to = 5;
    let landing = { x: 0, y: 0 };
    let stepStart = 0;
    let clicked = false;
    let ring: Ring | null = null;
    let gaze: Point | null = null;
    let frameId = 0;
    let disposed = false;

    const center = (button: Rect): Point => ({
      x: button.x + button.w / 2,
      y: button.y + button.h / 2,
    });
    const circleBox = (point: Point): Box => ({
      x: point.x - RING_RADIUS,
      y: point.y - RING_RADIUS,
      w: RING_RADIUS * 2,
      h: RING_RADIUS * 2,
      r: RING_RADIUS,
    });
    const snapBox = (button: Rect): Box => ({
      x: button.x - RING_PADDING,
      y: button.y - RING_PADDING,
      w: button.w + RING_PADDING * 2,
      h: button.h + RING_PADDING * 2,
      r: BUTTON_RADIUS + RING_PADDING,
    });
    const aimAt = (index: number) => {
      const target = center(buttons[index]);
      landing = {
        x: target.x + gaussian() * LANDING_ERROR,
        y: target.y + gaussian() * LANDING_ERROR * 0.6,
      };
    };

    const layout = () => {
      const cellWidth = (width - PADDING_X * 2) / COLS;
      const cellHeight = (height - PADDING_Y * 2) / ROWS;
      const buttonWidth = Math.min(cellWidth * 0.72, 88);
      buttons = Array.from({ length: COLS * ROWS }, (_, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        return {
          x: PADDING_X + cellWidth * col + (cellWidth - buttonWidth) / 2,
          y: PADDING_Y + cellHeight * row + (cellHeight - BUTTON_HEIGHT) / 2,
          w: buttonWidth,
          h: BUTTON_HEIGHT,
          label: `${'ABCD'[col]}${row + 1}`,
        };
      });
      aimAt(to);
    };

    // the resting frame: snapped onto a button, halfway through a dwell, with
    // the raw gaze samples scattered around the spot the eyes actually landed
    const restingFrame = () => {
      ring = { ...snapBox(buttons[to]), progress: 0.6, flash: 0 };
      gaze = landing;
      samples = Array.from({ length: 12 }, (_, i) => ({
        x: landing.x + gaussian() * SAMPLE_SPREAD,
        y: landing.y + gaussian() * SAMPLE_SPREAD,
        life: SAMPLE_DECAY ** i,
      }));
    };

    const roundRect = (box: Box) => {
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.w, box.h, box.r);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      buttons.forEach((button, i) => {
        const isPressed = pressed.has(i);
        roundRect({ ...button, r: BUTTON_RADIUS });
        ctx.fillStyle = isPressed ? PRESSED : BUTTON;
        ctx.fill();
        if (!isPressed) {
          ctx.strokeStyle = BUTTON_EDGE;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.fillStyle = isPressed ? '#fff' : LABEL;
        ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 0.5);
      });

      ctx.fillStyle = RING;
      for (const sample of samples) {
        ctx.globalAlpha = sample.life * 0.75;
        ctx.beginPath();
        ctx.arc(sample.x, sample.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (!ring) return;
      if (ring.progress > 0) {
        ctx.save();
        roundRect(ring);
        ctx.clip();
        ctx.fillStyle = DWELL_FILL;
        ctx.fillRect(ring.x, ring.y, ring.w * ring.progress, ring.h);
        ctx.restore();
      }
      ctx.strokeStyle = RING;
      ctx.lineWidth = 2;
      roundRect(ring);
      ctx.stroke();

      if (ring.flash > 0) {
        const grow = (1 - ring.flash) * 12;
        ctx.globalAlpha = ring.flash;
        roundRect({
          x: ring.x - grow,
          y: ring.y - grow,
          w: ring.w + grow * 2,
          h: ring.h + grow * 2,
          r: ring.r + grow,
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };

    const nextStep = (now: number) => {
      from = to;
      do {
        to = Math.floor(Math.random() * buttons.length);
      } while (to === from);
      aimAt(to);
      stepStart = now;
      clicked = false;
    };

    const tick = (now: number) => {
      if (!buttons.length) {
        frameId = requestAnimationFrame(tick);
        return;
      }
      if (!stepStart) nextStep(now);
      let elapsed = now - stepStart;
      if (elapsed >= STEP) {
        nextStep(now);
        elapsed = 0;
      }

      const start = center(buttons[from]);
      if (elapsed < SACCADE) {
        const t = easeInOut(elapsed / SACCADE);
        gaze = {
          x: start.x + (landing.x - start.x) * t,
          y: start.y + (landing.y - start.y) * t,
        };
        const unsnap = Math.min(elapsed / (SACCADE * 0.35), 1);
        ring = {
          ...lerpBox(snapBox(buttons[from]), circleBox(gaze), unsnap),
          progress: 0,
          flash: 0,
        };
      } else if (elapsed < SACCADE + SNAP) {
        const t = easeInOut((elapsed - SACCADE) / SNAP);
        gaze = landing;
        ring = {
          ...lerpBox(circleBox(landing), snapBox(buttons[to]), t),
          progress: 0,
          flash: 0,
        };
      } else if (elapsed < SACCADE + SNAP + DWELL) {
        ring = {
          ...snapBox(buttons[to]),
          progress: (elapsed - SACCADE - SNAP) / DWELL,
          flash: 0,
        };
      } else {
        if (!clicked) {
          clicked = true;
          if (pressed.has(to)) {
            pressed.delete(to);
          } else {
            pressed.add(to);
            if (pressed.size > MAX_PRESSED) {
              pressed.delete(pressed.values().next().value!);
            }
          }
        }
        ring = {
          ...snapBox(buttons[to]),
          progress: 0,
          flash: 1 - (elapsed - SACCADE - SNAP - DWELL) / CLICK,
        };
      }

      if (!gaze) return;
      samples = samples
        .map((sample) => ({ ...sample, life: sample.life * SAMPLE_DECAY }))
        .filter((sample) => sample.life > 0.05);
      samples.push({
        x: gaze.x + gaussian() * SAMPLE_SPREAD,
        y: gaze.y + gaussian() * SAMPLE_SPREAD,
        life: 1,
      });

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
      layout();
      if (!ring || !animate) restingFrame();
      draw();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    document.fonts.load(font).then(() => {
      if (!disposed && ring) draw();
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
