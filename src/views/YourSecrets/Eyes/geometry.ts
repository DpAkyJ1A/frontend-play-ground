export const AXIS = 2400;
const LEFT = 340;
const TOP = 770;
export const VIEW = `${LEFT} ${TOP} ${(AXIS - LEFT) * 2} 720`;

const LID =
  'M2145.2 1342 C2145.2 1342 1955.1 1082.1 1866.3 1044.1 C1777.6 1006 1314.8 911 1067.6 879.3 ' +
  'C820.4 847.6 345 828.6 345 828.6 L560 960 L631.3 935.3 C631.3 935.3 1651.9 852.9 2145.2 1342';
const LOWER =
  'M345 828.6 C345 828.6 617.6 1094.8 655.6 1158.2 C693.6 1221.6 795.1 1342 795.1 1342 L617.6 1342 ' +
  'C617.6 1342 814.1 1367.4 839.4 1392.7 C864.8 1418.1 776 1449.8 776 1449.8 ' +
  'C776 1449.8 1340.2 1481.5 2094.5 1449.8 C2094.5 1449.8 1085.6 1459.3 922.9 1379 ' +
  'C760.2 1298.7 631.3 935.3 631.3 935.3';
const BROW =
  'M2202.3 1183.5 C2202.3 1183.5 2018.5 980.7 1942.4 955.3 C1866.3 930 871.1 777.9 871.1 777.9 ' +
  'C871.1 777.9 1910.7 980.7 1929.7 1018.7 C1948.7 1056.8 2202.3 1183.5 2202.3 1183.5';
const LID_EDGE = 'M631.3 935.3 C631.3 935.3 1651.9 852.9 2145.2 1342';
const FLOOR =
  'M631.3 935.3 C631.3 935.3 760.2 1298.7 922.9 1379 C1085.6 1459.3 2094.5 1449.8 2094.5 1449.8 L2145.2 1342';
const OPENING =
  'M631.3 935.3 C631.3 935.3 1651.9 852.9 2145.2 1342 L2094.5 1449.8 ' +
  'C2094.5 1449.8 1085.6 1459.3 922.9 1379 C760.2 1298.7 631.3 935.3 631.3 935.3';
const SHADE =
  'M631.3 935.3 C631.3 935.3 1651.9 852.9 2145.2 1342 C2130.1 1333.2 1754.6 1121.1 1575 1100 ' +
  'C1445 1084.7 1271.5 1046.4 1171.5 1037.1 C1110.5 1031.4 1042.4 1027.6 965.3 1027.6 ' +
  'C880.5 1027.6 784.7 1032.1 675.6 1043.4 C647.5 980.9 631.3 935.3 631.3 935.3';

export const IRIS = { x: 1355.9, y: 1200.8, rx: 237.9, ry: 259.1 };
export const GAZE = { x: 250, y: 40 };
export const PUPIL = 70;

export const PINWHEEL =
  'M-5.8 -249.3 C-5.8 -249.3 199.1 -117.9 98 60.7 C98 60.7 117.7 103.9 215.8 60.7 L196.4 114.1 ' +
  'C196.4 114.1 33.6 222.9 -96.7 97.7 C-96.7 97.7 -139.6 140.8 -115 210.6 L-146.3 184.6 ' +
  'C-146.3 184.6 -235.2 -98.4 -5.8 -139.5 C-5.8 -139.5 30.2 -191.8 -67 -236.9 L-5.8 -249.3';

export type IdleStep = {
  x: number;
  y: number;
  hold: number;
  pupil?: number;
  blink?: boolean;
};

export const IDLE: IdleStep[] = [
  { x: 0, y: 0, hold: 2000, pupil: 1.15 },
  { x: -1, y: 0, hold: 1000 },
  { x: 1, y: 0, hold: 1000 },
  { x: 0, y: 0, hold: 1800, pupil: 1.15, blink: true },
  { x: 0.5, y: -0.6, hold: 700 },
];

type Point = [number, number];
type Segment = [number, number, number, number, number, number];
type Shape = { start: Point; segs: Segment[] };

const parse = (d: string): Shape => {
  const tokens = d
    .replace(/([MCL])/g, ' $1 ')
    .trim()
    .split(/[\s,]+/);
  const segs: Segment[] = [];
  let i = 0;
  let cmd = 'M';
  let start: Point = [0, 0];
  let last = start;
  const n = () => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    if (/[A-Z]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'M') start = last = [n(), n()];
    else if (cmd === 'C') {
      const seg: Segment = [n(), n(), n(), n(), n(), n()];
      segs.push(seg);
      last = [seg[4], seg[5]];
    } else if (cmd === 'L') {
      const to: Point = [n(), n()];
      segs.push([...last, ...to, ...to]);
      last = to;
    } else break;
  }

  return { start, segs };
};

const at = (p: Point, s: Segment, t: number): Point => {
  const u = 1 - t;
  const a = u * u * u,
    b = 3 * u * u * t,
    c = 3 * u * t * t,
    e = t * t * t;
  return [
    a * p[0] + b * s[0] + c * s[2] + e * s[4],
    a * p[1] + b * s[1] + c * s[3] + e * s[5],
  ];
};

const subdivide = ({ start, segs }: Shape, n: number): Shape => {
  const out: Segment[] = [];
  let p = start;
  for (const seg of segs) {
    let s = seg;
    for (let k = n; k > 1; k--) {
      const t = 1 / k;
      const mix = (a: Point, b: Point): Point => [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
      ];
      const p1: Point = [s[0], s[1]],
        p2: Point = [s[2], s[3]],
        p3: Point = [s[4], s[5]];
      const a = mix(p, p1),
        b = mix(p1, p2),
        c = mix(p2, p3);
      const d = mix(a, b),
        e = mix(b, c),
        m = mix(d, e);
      out.push([...a, ...d, ...m]);
      p = m;
      s = [...e, ...c, ...p3];
    }
    out.push(s);
    p = [s[4], s[5]];
  }
  return { start, segs: out };
};

const toD = ({ start, segs }: Shape) =>
  `M${start.map((v) => v.toFixed(1)).join(' ')}` +
  segs.map((s) => `C${s.map((v) => v.toFixed(1)).join(' ')}`).join('') +
  'Z';

const profile = (shape: Shape) => {
  const points: Point[] = [];
  let p = shape.start;
  for (const seg of shape.segs) {
    for (let k = 1; k <= 48; k++) points.push(at(p, seg, k / 48));
    p = [seg[4], seg[5]];
  }
  return (x: number) => {
    let lo = 0;
    let hi = points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid][0] < x) lo = mid;
      else hi = mid;
    }
    const [a, b] = [points[lo], points[hi]];
    return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1);
  };
};

const lidEdge = profile(parse(LID_EDGE));
const floor = profile(parse(FLOOR));
const [X_FROM, X_TO] = [631.3, 2145.2];

const bend = (shape: Shape, shut: number): Shape => {
  const move = ([x, y]: Point): Point => {
    if (x <= X_FROM || x >= X_TO) return [x, y];
    const low = floor(x);
    const gap = low - lidEdge(x);
    return [x, y + shut * Math.min(Math.max(low - y, 0), gap)];
  };
  return {
    start: move(shape.start),
    segs: shape.segs.map((s) => [
      ...move([s[0], s[1]]),
      ...move([s[2], s[3]]),
      ...move([s[4], s[5]]),
    ]) as Segment[],
  };
};

const MOVING = {
  lid: subdivide(parse(LID), 8),
  opening: subdivide(parse(OPENING), 8),
  shade: subdivide(parse(SHADE), 8),
};
export const FIXED = { lower: toD(parse(LOWER)), brow: toD(parse(BROW)) };

export type MovingPaths = {
  key: string;
  lid: string;
  opening: string;
  shade: string;
};

let cached: MovingPaths | null = null;

export const shapes = (open: number): MovingPaths => {
  const key = open.toFixed(3);
  if (cached?.key !== key) {
    const shut = 1 - Number(key);
    cached = {
      key,
      lid: toD(bend(MOVING.lid, shut)),
      opening: toD(bend(MOVING.opening, shut)),
      shade: toD(bend(MOVING.shade, shut)),
    };
  }
  return cached;
};
