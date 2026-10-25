import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE_NAME } from './site';

// Open Graph / Twitter cards, rendered at build time by next/og (Satori: flexbox only,
// inline styles, TTF/OTF fonts).

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

const INK = '#0b0a10';
const PLATE = '#13111b';
const RULE = '#272337';
const RULE_STRONG = '#3a3550';
const BONE = '#edeaf6';
const HAZE = '#8d89a3';
const UV = '#8b5cff';

// Find Your Number in Pi: green-bar printout
const PAPER = '#fbfcf9';
const PAPER_INK = '#202427';
const BAR = '#e1eedb';
const HOLE = '#d3dacf';
const MARKER = '#ff7cbd';

// Eye Control: gaze plot on graphite
const GRAPHITE = '#16191d';
const GAZE_TEXT = '#e9edf0';
const ORANGE = '#ff6a3d';

// Your Secrets: white cards on cool grey paper, one blue for what's exposed
const SECRETS_PAPER = '#f3f4f6';
const SECRETS_CARD = '#ffffff';
const SECRETS_INK = '#16181d';
const SECRETS_MUTED = '#5f646d';
const SECRETS_RULE = '#e2e4e8';
const SECRETS_ACCENT = '#2e54e8';

export type Motif = 'home' | 'life' | 'pi' | 'eye' | 'secrets';

type Card = {
  title: string;
  description: string;
  motif: Motif;
};

// Each card wears its page's look; the shell (header row, layout) is shared.
type Theme = {
  background: string;
  backgroundImage?: string;
  text: string;
  muted: string;
  rule: string;
  ruleStyle: 'solid' | 'dashed';
  alive: string;
  dead: string;
  font: string;
};

const THEMES: Record<Motif, Theme> = {
  home: {
    background: INK,
    text: BONE,
    muted: HAZE,
    rule: RULE,
    ruleStyle: 'solid',
    alive: BONE,
    dead: RULE_STRONG,
    font: 'Bricolage Grotesque',
  },
  life: {
    background: INK,
    backgroundImage:
      'radial-gradient(circle at 85% 30%, rgba(139, 92, 255, 0.22), transparent 55%)',
    text: BONE,
    muted: HAZE,
    rule: RULE,
    ruleStyle: 'solid',
    alive: UV,
    dead: RULE_STRONG,
    font: 'Bricolage Grotesque',
  },
  pi: {
    background: PAPER,
    text: PAPER_INK,
    muted: '#5e6a63',
    rule: '#aebcaa',
    ruleStyle: 'dashed',
    alive: PAPER_INK,
    dead: '#cdd6c9',
    font: 'Courier Prime',
  },
  eye: {
    background: GRAPHITE,
    backgroundImage:
      'radial-gradient(circle at 80% 50%, rgba(255, 106, 61, 0.14), transparent 50%)',
    text: GAZE_TEXT,
    muted: '#8d969e',
    rule: '#2a2f35',
    ruleStyle: 'solid',
    alive: ORANGE,
    dead: '#3d444b',
    font: 'Bricolage Grotesque',
  },
  secrets: {
    background: SECRETS_PAPER,
    text: SECRETS_INK,
    muted: SECRETS_MUTED,
    rule: SECRETS_RULE,
    ruleStyle: 'solid',
    alive: SECRETS_INK,
    dead: SECRETS_RULE,
    font: 'Bricolage Grotesque',
  },
};

const loadFont = (file: string) =>
  readFile(join(process.cwd(), 'src/assets/fonts', file));

const GLIDER = [0, 1, 0, 0, 0, 1, 1, 1, 1];

function Glider({
  cell,
  gap,
  alive,
  dead,
}: {
  cell: number;
  gap: number;
  alive: string;
  dead: string;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', width: cell * 3 + gap * 2, gap }}>
      {GLIDER.map((isAlive, i) => (
        <div
          key={i}
          style={{
            width: cell,
            height: cell,
            borderRadius: cell / 5,
            backgroundColor: isAlive ? alive : dead,
          }}
        />
      ))}
    </div>
  );
}

const GOSPER_GUN = [
  '........................O...........',
  '......................O.O...........',
  '............OO......OO............OO',
  '...........O...O....OO............OO',
  'OO........O.....O...OO..............',
  'OO........O...O.OO....O.O...........',
  '..........O.....O.......O...........',
  '...........O...O....................',
  '............OO......................',
];

function LifeMotif() {
  const cell = 8;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {GOSPER_GUN.map((row, y) => (
        <div key={y} style={{ display: 'flex', gap: 3 }}>
          {[...row].map((char, x) => (
            <div
              key={x}
              style={{
                width: cell,
                height: cell,
                borderRadius: 2,
                backgroundColor: char === 'O' ? UV : PLATE,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Decimal places 666–863 of π; the run of six 9s starts at place 762.
const PI_WINDOW =
  '343014654958537105079227968925892354201995611212902196086403441815981362977477130996051870721134999999837297804995105973173281609631859502445945534690830264252230825334468503526193118817101000313783';
const PI_COLUMNS = 22;
const PI_MATCH = PI_WINDOW.indexOf('999999');
const PI_ROW = 34;

function Holes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 34 }}>
      {Array.from({ length: 9 }, (_, i) => (
        <div
          key={i}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: PI_ROW }}
        >
          <div style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: HOLE }} />
        </div>
      ))}
    </div>
  );
}

// a strip of the green-bar printout, the match under a highlighter
function PiMotif() {
  const rows = Array.from({ length: 9 }, (_, i) =>
    PI_WINDOW.slice(i * PI_COLUMNS, (i + 1) * PI_COLUMNS)
  );
  return (
    <div style={{ display: 'flex' }}>
      <Holes />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderLeft: `1px dashed ${THEMES.pi.rule}`,
          borderRight: `1px dashed ${THEMES.pi.rule}`,
        }}
      >
        {rows.map((row, y) => (
          <div
            key={y}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: PI_ROW,
              padding: '0 14px',
              backgroundColor: Math.floor(y / 3) % 2 ? 'transparent' : BAR,
            }}
          >
            {[...row].map((digit, x) => {
              const index = y * PI_COLUMNS + x;
              const hit = index >= PI_MATCH && index < PI_MATCH + 6;
              return (
                <div
                  key={x}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    width: 14,
                    fontFamily: 'Courier Prime',
                    fontSize: 22,
                    fontWeight: 700,
                    color: PAPER_INK,
                    backgroundColor: hit ? MARKER : 'transparent',
                  }}
                >
                  {digit}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <Holes />
    </div>
  );
}

// fixations sized by how long the eyes stayed, saccades between them
const FIXATIONS = [
  { x: 100, y: 96, r: 30, ms: 312 },
  { x: 288, y: 206, r: 40, ms: 540 },
  { x: 136, y: 330, r: 34, ms: 420 },
];

function EyeMotif() {
  const heat = FIXATIONS.map(
    ({ x, y, r }) =>
      `radial-gradient(circle at ${x}px ${y}px, rgba(255, 106, 61, 0.6), rgba(242, 212, 58, 0.34) ${r * 1.2}px, rgba(43, 212, 125, 0.18) ${r * 2}px, rgba(43, 212, 125, 0) ${r * 2.8}px)`
  ).join(', ');
  return (
    <div style={{ display: 'flex', position: 'relative', width: 404, height: 430, backgroundImage: heat }}>
      <svg width="404" height="430" style={{ position: 'absolute', left: 0, top: 0 }}>
        {FIXATIONS.slice(1).map((to, i) => {
          const from = FIXATIONS[i];
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="rgba(233, 237, 240, 0.6)"
              strokeWidth="2"
            />
          );
        })}
      </svg>
      {FIXATIONS.map(({ x, y, r, ms }, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            position: 'absolute',
            left: x - r,
            top: y - r,
            gap: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              border: `2px solid ${GAZE_TEXT}`,
              backgroundColor: GRAPHITE,
              fontFamily: 'Geist Mono',
              fontSize: 20,
              color: GAZE_TEXT,
            }}
          >
            {i + 1}
          </div>
          <div style={{ fontFamily: 'Geist Mono', fontSize: 16, color: THEMES.eye.muted }}>
            {`${ms} ms`}
          </div>
        </div>
      ))}
    </div>
  );
}

const REDACTED = [
  { label: 'Time zone', width: 150 },
  { label: 'Graphics card', width: 118 },
  { label: 'Screen', width: 96 },
  { label: 'Languages', width: 132 },
  { label: 'Fonts', width: 74 },
];

function SecretsMotif() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 420,
        padding: '30px 32px',
        border: `1px solid ${SECRETS_RULE}`,
        borderRadius: 24,
        backgroundColor: SECRETS_CARD,
      }}
    >
      <div style={{ fontSize: 22, color: SECRETS_MUTED }}>Your fingerprint</div>
      <div
        style={{
          marginTop: 6,
          fontFamily: 'Geist Mono',
          fontSize: 42,
          letterSpacing: -1,
          color: SECRETS_ACCENT,
        }}
      >
        805a a1dd f198
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginTop: 22,
          paddingTop: 22,
          borderTop: `1px solid ${SECRETS_RULE}`,
        }}
      >
        {REDACTED.map(({ label, width }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 21,
              color: SECRETS_MUTED,
            }}
          >
            {label}
            <div
              style={{
                width,
                height: 18,
                borderRadius: 4,
                backgroundColor: SECRETS_INK,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeMotif() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Glider cell={64} gap={14} alive={BONE} dead={RULE_STRONG} />
    </div>
  );
}

const MOTIFS: Record<Motif, () => React.JSX.Element> = {
  home: HomeMotif,
  life: LifeMotif,
  pi: PiMotif,
  eye: EyeMotif,
  secrets: SecretsMotif,
};

export async function renderOgImage({ title, description, motif }: Card) {
  const [display, text, mono, printout, printoutBold] = await Promise.all([
    loadFont('BricolageGrotesque-SemiBold.ttf'),
    loadFont('BricolageGrotesque-Regular.ttf'),
    loadFont('GeistMono-Medium.ttf'),
    loadFont('CourierPrime-Regular.ttf'),
    loadFont('CourierPrime-Bold.ttf'),
  ]);
  const Visual = MOTIFS[motif];
  const theme = THEMES[motif];
  const isPrintout = theme.font === 'Courier Prime';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: '64px 72px',
          backgroundColor: theme.background,
          // Satori can't take an undefined background-image
          ...(theme.backgroundImage && { backgroundImage: theme.backgroundImage }),
          color: theme.text,
          fontFamily: theme.font,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: motif === 'home' ? 700 : 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Glider cell={9} gap={3} alive={theme.alive} dead={theme.dead} />
            <div
              style={{
                fontFamily: 'Bricolage Grotesque',
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              FPG
            </div>
            <div
              style={{
                fontFamily: 'Bricolage Grotesque',
                fontSize: 22,
                color: theme.muted,
              }}
            >
              {SITE_NAME}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div
              style={{
                fontSize: isPrintout ? 60 : title.length > 20 ? 64 : 76,
                fontWeight: isPrintout ? 700 : 600,
                lineHeight: 1.05,
                letterSpacing: isPrintout ? -1 : -1.5,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: isPrintout ? 23 : 26,
                lineHeight: 1.45,
                color: theme.muted,
              }}
            >
              {description}
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'flex-end',
            borderLeft:
              motif === 'home' ? 'none' : `1px ${theme.ruleStyle} ${theme.rule}`,
            marginLeft: 48,
          }}
        >
          <Visual />
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Bricolage Grotesque', data: display, weight: 600, style: 'normal' },
        { name: 'Bricolage Grotesque', data: text, weight: 400, style: 'normal' },
        { name: 'Geist Mono', data: mono, weight: 500, style: 'normal' },
        { name: 'Courier Prime', data: printout, weight: 400, style: 'normal' },
        { name: 'Courier Prime', data: printoutBold, weight: 700, style: 'normal' },
      ],
    }
  );
}
