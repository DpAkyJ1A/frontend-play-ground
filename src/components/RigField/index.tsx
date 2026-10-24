import { useEffect, useRef } from 'react';
import styles from './index.module.css';
import { resolveCssVariables } from '@/utils/helpers';

// A motionrig panel next to the headline it rigs: a cursor drags duration,
// then rise, every release replays the letters with the new values, and the
// panel resets for the next round.
const WORD = 'Tune it.';
const DISPLAY_FONT = '800 44px var(--font-bricolage)';
const MONO_FONT = '500 10px var(--font-mono)';

// the scene is laid out on this box and scaled to fit the canvas
const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 150;
const MAX_SCALE = 1.4;
const GRID = 20;

const STAGE_X = 14;
const BASELINE = 88;
const CAP = 30; // rise is a share of the letters' height
const STAGGER = 40;
const TILT = (-14 * Math.PI) / 180;

const PANEL = { x: 214, y: 10, width: 178, height: 160 };
const TRACK = { x: 226, width: 154 };

type Param = {
  label: string;
  min: number;
  max: number;
  from: number;
  to: number;
  format: (value: number) => string;
  y: number;
  drag?: [start: number, end: number];
};

// one loop: replay, drag duration, replay, drag rise, replay, reset
const LOOP = 6000;
const RESET: [number, number] = [5200, 5700];

const DURATION: Param = {
  label: 'duration',
  min: 0.2,
  max: 2,
  from: 0.5,
  to: 1.2,
  format: (value) => `${value.toFixed(2)} s`,
  y: 52,
  drag: [1100, 1900],
};
const RISE: Param = {
  label: 'rise',
  min: 0,
  max: 150,
  from: 40,
  to: 120,
  format: (value) => `${Math.round(value)} %`,
  y: 82,
  drag: [2900, 3600],
};
const STAGGER_ROW: Param = {
  label: 'stagger',
  min: 0,
  max: 0.2,
  from: STAGGER / 1000,
  to: STAGGER / 1000,
  format: (value) => `${value.toFixed(3)} s`,
  y: 112,
};
const PARAMS = [DURATION, RISE, STAGGER_ROW];
const REPLAYS = [0, DURATION.drag![1], RISE.drag![1]];
// at rest: the defaults, the letters settled, no cursor
const SETTLED = LOOP - 100;

const CURSOR_REST = { x: 196, y: 128 };
// the arrow, tip at the origin
const ARROW: [number, number][] = [
  [0, 0],
  [0, 13],
  [3.5, 10],
  [6, 15.5],
  [8, 14.6],
  [5.6, 9.4],
  [10, 9.4],
];

const YELLOW = '#ffd400';
const INK = '#e9eaec';
const MUTED = 'rgba(233, 234, 236, 0.5)';
const PANEL_FILL = 'rgba(28, 30, 34, 0.94)';
const EDGE = 'rgba(255, 255, 255, 0.1)';
const TRACK_FILL = 'rgba(255, 255, 255, 0.14)';
const LIVE = '#5ab0ff';
const GRID_LINE = 'rgba(255, 255, 255, 0.035)';

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
const easeOutBack = (t: number) => {
  const c = 1.4;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
const progress = (t: number, [start, end]: [number, number]) =>
  clamp01((t - start) / (end - start));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const valueAt = (param: Param, t: number) =>
  param.drag
    ? lerp(
        param.from,
        param.to,
        easeInOut(progress(t, param.drag)) * (1 - easeInOut(progress(t, RESET)))
      )
    : param.from;

const knobX = (param: Param, value: number) =>
  TRACK.x + ((value - param.min) / (param.max - param.min)) * TRACK.width;
const trackY = (param: Param) => param.y + 13;

const cursorAt = (t: number) => {
  const onDuration = { x: knobX(DURATION, DURATION.from), y: trackY(DURATION) };
  const onRise = { x: knobX(RISE, RISE.from), y: trackY(RISE) };
  const along = (param: Param) => ({
    x: knobX(param, valueAt(param, t)),
    y: trackY(param),
  });
  const move = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    span: [number, number]
  ) => {
    const k = easeInOut(progress(t, span));
    return { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) };
  };

  let at = CURSOR_REST;
  let pressed = false;
  if (t < 1100) at = move(CURSOR_REST, onDuration, [800, 1100]);
  else if (t < 2400) {
    at = along(DURATION);
    pressed = t < DURATION.drag![1];
  } else if (t < 2900) at = move(along(DURATION), onRise, [2400, 2900]);
  else if (t < 4300) {
    at = along(RISE);
    pressed = t < RISE.drag![1];
  } else at = move(along(RISE), CURSOR_REST, [4300, 4800]);

  const alpha = progress(t, [600, 800]) * (1 - progress(t, [4800, 5100]));
  return { ...at, alpha, pressed };
};

export type RigFieldProps = {
  running?: boolean;
  className?: string;
};

export default function RigField({
  running = false,
  className = '',
}: RigFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const displayFont = resolveCssVariables(DISPLAY_FONT);
    const monoFont = resolveCssVariables(MONO_FONT);
    const animate =
      running && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let ratio = 1;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let t = SETTLED;
    let frameId = 0;
    let disposed = false;

    // the grid and the floor run edge to edge, outside the scaled box
    const drawBackdrop = () => {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.strokeStyle = GRID_LINE;
      ctx.lineWidth = 1;
      const step = GRID * scale;
      ctx.beginPath();
      for (let x = (offsetX % step) + 0.5; x < width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = (offsetY % step) + 0.5; y < height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      const floor = Math.round(offsetY + BASELINE * scale) + 0.5;
      ctx.strokeStyle = YELLOW;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(0, floor);
      ctx.lineTo(width, floor);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const drawWord = () => {
      ctx.font = monoFont;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillStyle = MUTED;
      const host = 'your-site.com/';
      ctx.fillText(host, STAGE_X, 34);
      ctx.fillStyle = YELLOW;
      ctx.fillText('?rig', STAGE_X + ctx.measureText(host).width, 34);

      ctx.font = displayFont;
      // shrink the word if the face runs wide
      const fit = Math.min(
        1,
        (PANEL.x - STAGE_X - 16) / ctx.measureText(WORD).width
      );

      const start = REPLAYS.filter((replay) => replay <= t).pop()!;
      const duration = valueAt(DURATION, start) * 1000;
      const rise = (valueAt(RISE, start) / 100) * CAP;

      ctx.save();
      ctx.beginPath();
      ctx.rect(
        -VIEW_WIDTH,
        -VIEW_HEIGHT,
        VIEW_WIDTH * 3,
        VIEW_HEIGHT + BASELINE
      );
      ctx.clip();
      ctx.fillStyle = INK;
      [...WORD].forEach((char, i) => {
        const p = clamp01((t - start - i * STAGGER) / duration);
        const settle = easeOutBack(p);
        const x = STAGE_X + ctx.measureText(WORD.slice(0, i)).width * fit;
        ctx.save();
        ctx.globalAlpha = clamp01(p * 2.5);
        ctx.translate(x, BASELINE + (1 - settle) * rise);
        ctx.rotate(TILT * (1 - settle));
        ctx.scale(fit, fit);
        ctx.fillText(char, 0, 0);
        ctx.restore();
      });
      ctx.restore();
    };

    const drawPanel = (pressedParam: Param | null) => {
      const { x, y, width: w, height: h } = PANEL;
      ctx.beginPath();
      ctx.roundRect(x + 0.5, y + 0.5, w, h, 10);
      ctx.fillStyle = PANEL_FILL;
      ctx.fill();
      ctx.strokeStyle = EDGE;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = monoFont;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = INK;
      ctx.fillText("rig('hero')", TRACK.x, y + 15);

      const badgeWidth = 26;
      const badgeX = TRACK.x + TRACK.width - badgeWidth;
      ctx.strokeStyle = LIVE;
      ctx.beginPath();
      ctx.roundRect(badgeX + 0.5, y + 8.5, badgeWidth, 13, 3);
      ctx.stroke();
      ctx.fillStyle = LIVE;
      ctx.textAlign = 'center';
      ctx.fillText('live', badgeX + badgeWidth / 2, y + 15.5);

      ctx.strokeStyle = EDGE;
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 29.5);
      ctx.lineTo(x + w - 12, y + 29.5);
      ctx.stroke();

      for (const param of PARAMS) {
        const value = valueAt(param, t);
        const changed = Math.abs(value - param.from) > 1e-6;
        ctx.textAlign = 'left';
        ctx.fillStyle = changed ? YELLOW : MUTED;
        ctx.fillText(param.label, TRACK.x, param.y);
        ctx.textAlign = 'right';
        ctx.fillStyle = INK;
        ctx.fillText(param.format(value), TRACK.x + TRACK.width, param.y);

        const ty = trackY(param);
        const kx = knobX(param, value);
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        ctx.strokeStyle = TRACK_FILL;
        ctx.beginPath();
        ctx.moveTo(TRACK.x, ty);
        ctx.lineTo(TRACK.x + TRACK.width, ty);
        ctx.stroke();
        // the real panel fills a tuned track in yellow, a default one in grey
        ctx.strokeStyle = changed ? YELLOW : MUTED;
        ctx.beginPath();
        ctx.moveTo(TRACK.x, ty);
        ctx.lineTo(kx, ty);
        ctx.stroke();

        const pressed = param === pressedParam;
        if (pressed) {
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = YELLOW;
          ctx.beginPath();
          ctx.arc(kx, ty, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.arc(kx, ty, pressed ? 5.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = PANEL_FILL;
        ctx.fill();
        ctx.lineWidth = 1.75;
        ctx.strokeStyle = YELLOW;
        ctx.stroke();
      }
    };

    const drawCursor = (cursor: ReturnType<typeof cursorAt>) => {
      if (!cursor.alpha) return;
      ctx.save();
      ctx.globalAlpha = cursor.alpha;
      ctx.translate(cursor.x, cursor.y);
      ctx.beginPath();
      for (const [x, y] of ARROW) ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#0b0a10';
      ctx.stroke();
      ctx.restore();
    };

    const draw = () => {
      if (!width) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawBackdrop();
      ctx.setTransform(
        ratio * scale,
        0,
        0,
        ratio * scale,
        ratio * offsetX,
        ratio * offsetY
      );
      const cursor = cursorAt(t);
      let pressedParam: Param | null = null;
      if (cursor.pressed) pressedParam = t < RISE.drag![0] ? DURATION : RISE;
      drawWord();
      drawPanel(pressedParam);
      drawCursor(cursor);
    };

    let startedAt = 0;

    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      // start from the settled frame the card shows at rest
      t = (now - startedAt + SETTLED) % LOOP;
      draw();
      frameId = requestAnimationFrame(tick);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      width = rect.width;
      height = rect.height;
      scale = Math.min(width / VIEW_WIDTH, height / VIEW_HEIGHT, MAX_SCALE);
      offsetX = (width - VIEW_WIDTH * scale) / 2;
      offsetY = (height - VIEW_HEIGHT * scale) * 0.3;
      draw();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    Promise.all([
      document.fonts.load(displayFont),
      document.fonts.load(monoFont),
    ]).then(() => {
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
