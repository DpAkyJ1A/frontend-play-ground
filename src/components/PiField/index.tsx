import { useEffect, useRef } from 'react';
import styles from './index.module.css';
import { PRINTOUT_FONT } from '@/lib/fonts/printout';
import { PI_DIGITS } from './digits';

const QUERY = '999999';
const TARGET = PI_DIGITS.indexOf(QUERY);
const CELL_WIDTH = 8;
const CELL_HEIGHT = 18;
const GROUP = 10;
const GROUP_GAP = 8;
const TOP = 4;
const TARGET_ROW = 0.55;
const SCAN_DURATION = 1700;
const TRAIL_DECAY = 0.9;
const FONT = `700 13px ${PRINTOUT_FONT}`;

// a strip of green-bar fanfold paper: tractor margins with holes on both edges,
// a bar every three lines
const PAPER_INSET = 22;
const MARGIN = 24;
const BAR_ROWS = 3;
const HOLE_RADIUS = 3.5;

const PAPER = '#fbfcf9';
const BAR = '#e1eedb';
const HOLE = '#cdd4c9';
const PERFORATION = '#c2ccbe';
const INK = '#202427';
const MARKER = '#ff7cbd';
const TILT = (-1.4 * Math.PI) / 180;
const SKEW = Math.tan((-8 * Math.PI) / 180);

const easeOut = (t: number) => 1 - (1 - t) ** 3;

export type PiFieldProps = {
  running?: boolean;
  className?: string;
};

export default function PiField({
  running = false,
  className = '',
}: PiFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const animate =
      running && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let offsetX = 0;
    let first = 0;
    let head = TARGET;
    let heat = new Float32Array(0);
    let frameId = 0;
    let disposed = false;

    const cellX = (col: number) =>
      offsetX + col * CELL_WIDTH + Math.floor(col / GROUP) * GROUP_GAP;
    const rowY = (row: number) => TOP + row * CELL_HEIGHT;

    // a skewed highlighter stroke, multiplied into the paper like real ink
    const highlight = (fromCol: number, toCol: number, row: number, alpha: number) => {
      const x = cellX(fromCol) - 3;
      const w = cellX(toCol) + CELL_WIDTH + 3 - x;
      const h = CELL_HEIGHT - 3;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = MARKER;
      ctx.translate(x + w / 2, rowY(row) + CELL_HEIGHT / 2);
      ctx.rotate(TILT);
      ctx.transform(1, 0, SKEW, 1, 0, 0);
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, [3, 7, 3, 8]);
      ctx.fill();
      ctx.restore();
    };

    const drawPaper = () => {
      const left = PAPER_INSET;
      const right = width - PAPER_INSET;
      ctx.fillStyle = PAPER;
      ctx.fillRect(left, 0, right - left, height);

      const firstRow = first / cols;
      ctx.fillStyle = BAR;
      for (let row = 0; row < rows; row++) {
        if (Math.floor((firstRow + row) / BAR_ROWS) % 2) continue;
        ctx.fillRect(left + MARGIN, rowY(row), right - left - MARGIN * 2, CELL_HEIGHT);
      }

      ctx.fillStyle = HOLE;
      for (let y = TOP + CELL_HEIGHT / 2; y < height; y += CELL_HEIGHT) {
        for (const x of [left + MARGIN / 2, right - MARGIN / 2]) {
          ctx.beginPath();
          ctx.arc(x, y, HOLE_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.strokeStyle = PERFORATION;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      for (const x of [left + MARGIN + 0.5, right - MARGIN - 0.5]) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    };

    const draw = () => {
      if (!cols) return;
      const landed = head === TARGET;
      ctx.clearRect(0, 0, width, height);
      drawPaper();

      for (let cell = 0; cell < cols * rows; cell++) {
        if (heat[cell] > 0.02) {
          const col = cell % cols;
          highlight(col, col, Math.floor(cell / cols), heat[cell] * 0.35);
        }
      }

      // the search window, one stroke per line it spans
      for (let row = 0; row < rows; row++) {
        const start = first + row * cols;
        const from = Math.max(head, start);
        const to = Math.min(head + QUERY.length, start + cols) - 1;
        if (from <= to) highlight(from - start, to - start, row, landed ? 1 : 0.5);
      }

      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = INK;
      for (let cell = 0; cell < cols * rows; cell++) {
        const index = first + cell;
        if (index >= PI_DIGITS.length) break;
        ctx.fillText(
          PI_DIGITS[index],
          cellX(cell % cols) + CELL_WIDTH / 2,
          rowY(Math.floor(cell / cols)) + CELL_HEIGHT / 2 + 1
        );
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
      height = rect.height;
      const text = width - (PAPER_INSET + MARGIN + 8) * 2;
      const groups = Math.max(
        Math.floor((text + GROUP_GAP) / (GROUP * CELL_WIDTH + GROUP_GAP)),
        1
      );
      cols = groups * GROUP;
      offsetX = (width - (cols * CELL_WIDTH + (groups - 1) * GROUP_GAP)) / 2;
      rows = Math.ceil((height - TOP) / CELL_HEIGHT);
      first = Math.max(
        (Math.floor(TARGET / cols) - Math.floor(rows * TARGET_ROW)) * cols,
        0
      );
      heat = new Float32Array(cols * rows);
      draw();
    };

    let startedAt = 0;
    let last = 0;

    const tick = (now: number) => {
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
