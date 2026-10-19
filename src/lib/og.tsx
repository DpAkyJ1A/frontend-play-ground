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
const UV_SOFT = '#c4b0ff';

export type Motif = 'home' | 'life' | 'pi' | 'eye';

type Card = {
  title: string;
  description: string;
  motif: Motif;
};

const loadFont = (file: string) =>
  readFile(join(process.cwd(), 'src/assets/fonts', file));

const GLIDER = [0, 1, 0, 0, 0, 1, 1, 1, 1];

function Glider({ cell, gap }: { cell: number; gap: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', width: cell * 3 + gap * 2, gap }}>
      {GLIDER.map((alive, i) => (
        <div
          key={i}
          style={{
            width: cell,
            height: cell,
            borderRadius: cell / 5,
            backgroundColor: alive ? UV : RULE_STRONG,
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

function PiMotif() {
  const rows = Array.from({ length: 9 }, (_, i) =>
    PI_WINDOW.slice(i * PI_COLUMNS, (i + 1) * PI_COLUMNS)
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((row, y) => (
        <div key={y} style={{ display: 'flex' }}>
          {[...row].map((digit, x) => {
            const index = y * PI_COLUMNS + x;
            const hit = index >= PI_MATCH && index < PI_MATCH + 6;
            return (
              <div
                key={x}
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  width: 17,
                  fontFamily: 'Geist Mono',
                  fontSize: 22,
                  color: hit ? '#fff' : y === 0 || y === 8 ? RULE_STRONG : HAZE,
                  backgroundColor: hit ? UV : 'transparent',
                }}
              >
                {digit}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const EYE_KEYS = ['A', 'B', 'C', 'D'];

function EyeMotif() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {[1, 2, 3].map((row) => (
        <div key={row} style={{ display: 'flex', gap: 14 }}>
          {EYE_KEYS.map((key) => {
            const label = `${key}${row}`;
            const lit = label === 'B1' || label === 'C3';
            const gazed = label === 'B2';
            return (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 82,
                  height: 42,
                  borderRadius: 8,
                  border: `2px solid ${gazed ? UV_SOFT : lit ? UV : RULE_STRONG}`,
                  backgroundColor: lit ? UV : gazed ? '#2a2145' : PLATE,
                  boxShadow: gazed ? `0 0 0 6px rgba(139, 92, 255, 0.25)` : 'none',
                  fontFamily: 'Geist Mono',
                  fontSize: 16,
                  color: lit ? '#fff' : HAZE,
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function HomeMotif() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Glider cell={64} gap={14} />
    </div>
  );
}

const MOTIFS: Record<Motif, () => React.JSX.Element> = {
  home: HomeMotif,
  life: LifeMotif,
  pi: PiMotif,
  eye: EyeMotif,
};

export async function renderOgImage({ title, description, motif }: Card) {
  const [display, text, mono] = await Promise.all([
    loadFont('BricolageGrotesque-SemiBold.ttf'),
    loadFont('BricolageGrotesque-Regular.ttf'),
    loadFont('GeistMono-Medium.ttf'),
  ]);
  const Visual = MOTIFS[motif];

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: '64px 72px',
          backgroundColor: INK,
          backgroundImage:
            'radial-gradient(circle at 85% 30%, rgba(139, 92, 255, 0.22), transparent 55%)',
          color: BONE,
          fontFamily: 'Bricolage Grotesque',
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
            <Glider cell={9} gap={3} />
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 1 }}>
              FPG
            </div>
            <div style={{ fontSize: 22, color: HAZE }}>{SITE_NAME}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div
              style={{
                fontSize: title.length > 20 ? 64 : 76,
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: -1.5,
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: 26, lineHeight: 1.45, color: HAZE }}>
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
            borderLeft: motif === 'home' ? 'none' : `1px solid ${RULE}`,
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
      ],
    }
  );
}
