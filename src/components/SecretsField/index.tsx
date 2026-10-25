import { useEffect, useRef } from 'react';
import styles from './index.module.css';
import { resolveCssVariables } from '@/utils/helpers';
import {
  AXIS,
  FIXED,
  IRIS,
  PUPIL,
  VIEW,
  shapes,
} from '@/views/YourSecrets/Eyes/geometry';

const FONT = '400 12px var(--font-geist)';
const LABEL_FONT = '400 11.5px var(--font-geist)';

const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 150;
const MAX_SCALE = 1.4;

const CARD = { x: 72, y: 10, width: 256, height: 160, radius: 14 };
const PAD = 16;
const ROW_Y = 46;
const ROW_STEP = 22;
const EYES_WIDTH = 58;

const LOOP = 5400;
const DECODE_AT = 350;
const DECODE_STEP = 520;
const DECODE = 680;
const CENSOR_AT = 3900;
const CENSOR_STEP = 120;
const CENSOR = 260;
const SCRAMBLE = 3;
const GLYPHS = '#%&*0123456789ABCDEFXYZ';

const PAPER = '#ffffff';
const RULE = '#e2e4e8';
const INK = '#16181d';
const MUTED = '#5f646d';
const ACCENT = '#2e54e8';
const WELL = '#e8eaee';

type Row = { label: string; value: string };

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

const readFacts = (): Row[] => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Unknown';
  let language = navigator.language;
  try {
    language =
      new Intl.DisplayNames(['en'], { type: 'language' }).of(
        language.split('-')[0]
      ) ?? language;
  } catch {
    // keep the language code
  }
  return [
    { label: 'Time zone', value: zone.replace(/_/g, ' ') },
    { label: 'Screen', value: `${screen.width} × ${screen.height}` },
    { label: 'Language', value: language },
    {
      label: 'Local time',
      value: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ];
};

const eyePaths = () => {
  const open = shapes(1);
  return {
    opening: new Path2D(open.opening),
    lid: new Path2D(open.lid),
    lower: new Path2D(FIXED.lower),
    brow: new Path2D(FIXED.brow),
  };
};

export type SecretsFieldProps = {
  running?: boolean;
  className?: string;
};

export default function SecretsField({
  running = false,
  className = '',
}: SecretsFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const font = resolveCssVariables(FONT);
    const labelFont = resolveCssVariables(LABEL_FONT);
    const animate =
      running && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rows = readFacts();
    const eyes = eyePaths();
    const [viewX, viewY, viewW, viewH] = VIEW.split(' ').map(Number);

    let width = 0;
    let height = 0;
    let ratio = 1;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let t = 0;
    let frameId = 0;
    let disposed = false;

    const drawEyes = (x: number, y: number) => {
      const s = EYES_WIDTH / viewW;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.translate(-viewX, -viewY);
      for (const mirror of [false, true]) {
        ctx.save();
        if (mirror) {
          ctx.translate(AXIS * 2, 0);
          ctx.scale(-1, 1);
        }
        ctx.fillStyle = PAPER;
        ctx.fill(eyes.opening);
        ctx.save();
        ctx.clip(eyes.opening);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(IRIS.x, IRIS.y, IRIS.rx, IRIS.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(IRIS.x, IRIS.y, PUPIL, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = INK;
        ctx.fill(eyes.lower);
        ctx.fill(eyes.lid);
        ctx.fill(eyes.brow);
        ctx.restore();
      }
      ctx.restore();
      return (viewH / viewW) * EYES_WIDTH;
    };

    const shown = (i: number) => {
      const decode = easeOut(
        clamp01((t - DECODE_AT - i * DECODE_STEP) / DECODE)
      );
      const censor = easeOut(
        clamp01((t - CENSOR_AT - i * CENSOR_STEP) / CENSOR)
      );
      return decode * (1 - censor);
    };

    const fit = (text: string, max: number) => {
      if (ctx.measureText(text).width <= max) return text;
      let cut = text;
      while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max)
        cut = cut.slice(0, -1);
      return `${cut}…`;
    };

    const draw = () => {
      if (!width) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.setTransform(
        ratio * scale,
        0,
        0,
        ratio * scale,
        ratio * offsetX,
        ratio * offsetY
      );

      const { x, y, width: w, height: h, radius } = CARD;
      ctx.beginPath();
      ctx.roundRect(x + 0.5, y + 0.5, w - 1, h, radius);
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.strokeStyle = RULE;
      ctx.lineWidth = 1;
      ctx.stroke();

      const eyesHeight = drawEyes(x + PAD, y + 13);

      rows.forEach((_, i) => {
        ctx.fillStyle = shown(i) >= 1 ? ACCENT : RULE;
        ctx.beginPath();
        ctx.roundRect(
          x + w - PAD - (rows.length - i) * 7 + 3,
          y + 13 + eyesHeight / 2 - 6,
          4,
          12,
          2
        );
        ctx.fill();
      });

      ctx.textBaseline = 'middle';
      rows.forEach(({ label, value }, i) => {
        const rowY = y + ROW_Y + i * ROW_STEP - 10;
        ctx.font = labelFont;
        ctx.textAlign = 'left';
        ctx.fillStyle = MUTED;
        ctx.fillText(label, x + PAD, rowY);

        ctx.font = font;
        const right = x + w - PAD;
        const text = fit(
          value,
          w - PAD * 2 - ctx.measureText(label).width - 18
        );
        const textWidth = ctx.measureText(text).width;
        const left = right - textWidth;
        const progress = shown(i);
        const chars = [...text];
        const revealed = Math.floor(progress * (chars.length + SCRAMBLE));

        ctx.textAlign = 'left';
        let cursor = left;
        chars.forEach((char, k) => {
          const advance = ctx.measureText(char).width;
          if (k < revealed - SCRAMBLE) {
            ctx.fillStyle = INK;
            ctx.fillText(char, cursor, rowY);
          } else if (k < revealed && char !== ' ') {
            // a few glyphs roll at the edge of the bar before they settle
            ctx.fillStyle = ACCENT;
            const roll = Math.floor(t / 60 + k * 7) % GLYPHS.length;
            ctx.fillText(GLYPHS[roll], cursor, rowY);
          }
          cursor += advance;
        });

        // the bar covers whatever isn't decoded yet
        const covered = Math.min(revealed, chars.length);
        if (covered < chars.length) {
          // a little wider than the text while it covers all of it
          const barLeft = covered
            ? left + ctx.measureText(chars.slice(0, covered).join('')).width
            : left - 3;
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.roundRect(barLeft, rowY - 7, right + 3 - barLeft, 14, 3);
          ctx.fill();
        }
        if (i < rows.length - 1) {
          ctx.fillStyle = WELL;
          ctx.fillRect(x + PAD, rowY + ROW_STEP / 2, w - PAD * 2, 1);
        }
      });
    };

    let startedAt = 0;

    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      t = (now - startedAt) % LOOP;
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
      offsetY = 0;
      draw();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    Promise.all([
      document.fonts.load(font),
      document.fonts.load(labelFont),
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
