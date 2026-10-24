import { useEffect, useRef } from 'react';
import styles from './index.module.css';
import { resolveCssVariables } from '@/utils/helpers';

// A Fadey note over the app's liquid lines: it types itself, gets read, then
// burns away letter by letter into violet and cyan sparks.
const NOTE = 'the vault code is 4815';
const LABEL = 'new note';
const VIEWS_LEFT = '1 view left';
const DESTROYED = 'destroyed';
const FONT = '500 14px var(--font-mono)';
const SMALL_FONT = '500 11px var(--font-mono)';

// one loop: type, hold while it's read, burn, a beat of an empty note
const TYPE = 1000;
const HOLD = 1100;
const BURN = 1500;
const REST = 800;
const LOOP = TYPE + HOLD + BURN + REST;
const BURN_AT = TYPE + HOLD;
const STAGGER = 650; // from the first letter catching fire to the last
const CHAR_FADE = 380;
const SPARKS = 8;
const STATUS_FADE = 400;
const BLINK = 500;

const NOTE_HEIGHT = 72;
const PADDING = 20;
const LINES = 7;
const STEP = 8;
const TAU = Math.PI * 2;

const INK = '#edeaf6';
const MUTED = 'rgba(237, 234, 246, 0.42)';
const GLASS = 'rgba(11, 10, 16, 0.74)';
const SHEEN = 'rgba(255, 255, 255, 0.06)';
const EDGE = 'rgba(255, 255, 255, 0.14)';
const VIOLET = '#8b6ae6';
const CYAN = '#97ddeb';
const SPARK_COLOURS = [VIOLET, CYAN, INK];

// mulberry32: the same sparks and waves on every render
const random = (() => {
  let seed = 0x5eed;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

// each line is two slow sine waves, sized to the canvas
const WAVES = Array.from({ length: LINES }, (_, i) => ({
  y: (i + 0.5) / LINES,
  alpha: 0.3 + random() * 0.32,
  a1: 0.06 + random() * 0.06,
  k1: 0.6 + random() * 0.8,
  p1: random() * TAU,
  s1: 0.0003 + random() * 0.0003,
  a2: 0.02 + random() * 0.04,
  k2: 1.4 + random() * 1.2,
  p2: random() * TAU,
  s2: 0.0002 + random() * 0.0003,
}));

const CHARS = [...NOTE].map((char, i) => ({
  char,
  typeAt: (i / NOTE.length) * TYPE,
  burnAt:
    BURN_AT + (i / (NOTE.length - 1)) * STAGGER + (random() - 0.5) * 120,
  sparks:
    char === ' '
      ? []
      : Array.from({ length: SPARKS }, () => ({
          u: random(),
          v: random(),
          vx: 10 + random() * 36,
          vy: -(14 + random() * 30),
          life: 700 + random() * 400,
          size: 1 + random() * 1.2,
          wobble: random() * TAU,
          colour: SPARK_COLOURS[Math.floor(random() * SPARK_COLOURS.length)],
        })),
}));

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

export type NoteFieldProps = {
  running?: boolean;
  className?: string;
};

export default function NoteField({
  running = false,
  className = '',
}: NoteFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const font = resolveCssVariables(FONT);
    const smallFont = resolveCssVariables(SMALL_FONT);
    const animate =
      running && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let stroke: CanvasGradient | string = VIOLET;
    // at rest: the note written out, the lines still
    let t = TYPE;
    let time = 0;
    let caret = false;
    let frameId = 0;
    let disposed = false;

    const drawLines = () => {
      ctx.lineCap = 'round';
      ctx.strokeStyle = stroke;
      for (const wave of WAVES) {
        ctx.beginPath();
        for (let x = -STEP; x <= width + STEP; x += STEP) {
          const u = x / width;
          const y =
            (wave.y +
              wave.a1 * Math.sin(u * wave.k1 * TAU + wave.p1 + time * wave.s1) +
              wave.a2 *
                Math.sin(u * wave.k2 * TAU + wave.p2 - time * wave.s2)) *
            height;
          if (x === -STEP) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        // a soft glow under a thin core, like the tubes in Fadey's background
        ctx.globalAlpha = wave.alpha * 0.16;
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.globalAlpha = wave.alpha;
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const drawNote = () => {
      ctx.font = font;
      const advance = ctx.measureText(NOTE).width;
      const noteWidth = Math.min(width - 32, Math.max(advance + 48, 240));
      const x0 = Math.round((width - noteWidth) / 2) + 0.5;
      const y0 = Math.round(height * 0.46 - NOTE_HEIGHT / 2) + 0.5;

      ctx.beginPath();
      ctx.roundRect(x0, y0, noteWidth, NOTE_HEIGHT, 12);
      ctx.fillStyle = GLASS;
      ctx.fill();
      const sheen = ctx.createLinearGradient(0, y0, 0, y0 + NOTE_HEIGHT);
      sheen.addColorStop(0, SHEEN);
      sheen.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sheen;
      ctx.fill();
      ctx.strokeStyle = EDGE;
      ctx.lineWidth = 1;
      ctx.stroke();

      // the label row: "1 view left" gives way to "destroyed" once it burns,
      // and comes back for the next note
      const status =
        clamp01((t - BURN_AT) / STATUS_FADE) -
        clamp01((t - (LOOP - STATUS_FADE)) / STATUS_FADE);
      const statusX = x0 + noteWidth - PADDING;
      ctx.font = smallFont;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'left';
      ctx.fillText(LABEL, x0 + PADDING, y0 + 24);
      ctx.textAlign = 'right';
      ctx.globalAlpha = clamp01(1 - 2 * status);
      ctx.fillText(VIEWS_LEFT, statusX, y0 + 24);
      ctx.globalAlpha = clamp01(2 * status - 1);
      ctx.fillStyle = CYAN;
      ctx.fillText(DESTROYED, statusX, y0 + 24);
      ctx.globalAlpha = 1;

      ctx.font = font;
      ctx.textAlign = 'left';
      const left = x0 + PADDING;
      const baseline = y0 + 50;
      let typed = 0;
      CHARS.forEach(({ char, typeAt, burnAt, sparks }) => {
        if (t < typeAt) return;
        typed++;
        const x = left + ctx.measureText(NOTE.slice(0, typed - 1)).width;
        const charWidth = ctx.measureText(char).width;
        const age = t - burnAt;
        const burn = easeOut(clamp01(age / CHAR_FADE));

        if (burn < 1) {
          const y = baseline - burn * 4;
          ctx.globalAlpha = (1 - burn) ** 2;
          ctx.fillStyle = INK;
          ctx.fillText(char, x, y);
          if (burn > 0) {
            ctx.globalAlpha = 2 * burn * (1 - burn);
            ctx.fillStyle = CYAN;
            ctx.fillText(char, x, y);
          }
        }

        if (age <= 0) return;
        const seconds = age / 1000;
        for (const spark of sparks) {
          if (age >= spark.life) continue;
          const sx =
            x +
            spark.u * charWidth +
            spark.vx * seconds +
            Math.sin(age * 0.006 + spark.wobble) * 2;
          // heat rises: the sparks speed up on their way out
          const sy =
            baseline - spark.v * 10 + spark.vy * seconds - 14 * seconds ** 2;
          ctx.globalAlpha = (1 - age / spark.life) ** 1.6 * 0.9;
          ctx.fillStyle = spark.colour;
          ctx.beginPath();
          ctx.arc(sx, sy, spark.size, 0, TAU);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;

      // the caret types, waits while the note is read, and waits for the next
      const burning = t >= BURN_AT && t < BURN_AT + BURN;
      const blinkOn = Math.floor(t / BLINK) % 2 === 0;
      if (caret && !burning && (t < TYPE || blinkOn)) {
        const caretX =
          t >= BURN_AT
            ? left
            : left + ctx.measureText(NOTE.slice(0, typed)).width + 1;
        ctx.fillStyle = CYAN;
        ctx.fillRect(caretX, baseline - 9, 2, 17);
      }
    };

    const draw = () => {
      if (!width) return;
      ctx.clearRect(0, 0, width, height);
      drawLines();
      drawNote();
    };

    let startedAt = 0;

    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      time = now - startedAt;
      // start from the written note the card shows at rest
      t = (time + TYPE) % LOOP;
      caret = true;
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
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, VIOLET);
      gradient.addColorStop(1, CYAN);
      stroke = gradient;
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
