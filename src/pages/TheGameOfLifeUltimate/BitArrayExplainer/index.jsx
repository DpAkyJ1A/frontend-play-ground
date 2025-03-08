import { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { play, pause, chevronBack, chevronForward } from 'ionicons/icons';
import { getRuleKernel, getRuleSource } from '../functions';
import Dialog from '@/components/Dialog';
import styles from './index.module.css';

const WORD = 32;
const TARGET = 9;
const PHASE_DURATION = 3200;
const CELLS = Array.from({ length: WORD }, (_, i) => i);

const toWord = (cells) =>
  cells.reduce((word, x) => (word | (1 << x)) >>> 0, 0);
const bitAt = (word, i) => (word >>> i) & 1;
const west = (word) => (word << 1) >>> 0;
const east = (word) => word >>> 1;
const u = (word) => word >>> 0;

const UP = toWord([1, 2, 6, 7, 8, 13, 17, 18, 22, 25, 26, 27, 30]);
const ROW = toWord([2, 3, 7, 10, 13, 14, 17, 18, 23, 26, 29, 30]);
const DOWN = toWord([1, 5, 9, 13, 19, 22, 23, 24, 27, 30, 31]);

const SOURCES = [
  { label: 'up', word: UP },
  { label: 'row', word: ROW },
  { label: 'down', word: DOWN },
];

const PLANES = [
  { label: 'NW', code: 'up << 1', source: UP, shift: 1, group: 0 },
  { label: 'N', code: 'up', source: UP, shift: 0, group: 0 },
  { label: 'NE', code: 'up >>> 1', source: UP, shift: -1, group: 0 },
  { label: 'W', code: 'row << 1', source: ROW, shift: 1, group: 1 },
  { label: 'E', code: 'row >>> 1', source: ROW, shift: -1, group: 1 },
  { label: 'SW', code: 'down << 1', source: DOWN, shift: 1, group: 2 },
  { label: 'S', code: 'down', source: DOWN, shift: 0, group: 2 },
  { label: 'SE', code: 'down >>> 1', source: DOWN, shift: -1, group: 2 },
];

const shiftWord = (word, shift) =>
  shift > 0 ? west(word) : shift < 0 ? east(word) : word;

const sumOfThree = (l, m, r) => ({
  ones: u(l ^ m ^ r),
  twos: u((l & m) | (r & (l ^ m))),
});

const ABOVE = sumOfThree(west(UP), UP, east(UP));
const BELOW = sumOfThree(west(DOWN), DOWN, east(DOWN));
const MIDDLE = { ones: u(west(ROW) ^ east(ROW)), twos: u(west(ROW) & east(ROW)) };

const ROW_SUMS = [
  { label: 'up 1s', word: ABOVE.ones },
  { label: 'up 2s', word: ABOVE.twos },
  { label: 'row 1s', word: MIDDLE.ones },
  { label: 'row 2s', word: MIDDLE.twos },
  { label: 'down 1s', word: BELOW.ones },
  { label: 'down 2s', word: BELOW.twos },
];

const COUNT = (() => {
  const carry0 =
    (ABOVE.ones & BELOW.ones) | (MIDDLE.ones & (ABOVE.ones ^ BELOW.ones));
  const twos = ABOVE.twos ^ BELOW.twos;
  const twosSum = twos ^ MIDDLE.twos;
  const carryA = (ABOVE.twos & BELOW.twos) | (MIDDLE.twos & twos);
  const carryB = twosSum & carry0;
  return [
    u(ABOVE.ones ^ BELOW.ones ^ MIDDLE.ones),
    u(twosSum ^ carry0),
    u(carryA ^ carryB),
    u(carryA & carryB),
  ];
})();

const COUNTS = CELLS.map((i) =>
  COUNT.reduce((sum, plane, bit) => sum + (bitAt(plane, i) << bit), 0)
);

const BENCH = {
  limited: [
    { label: '2D array', value: 1439 },
    { label: '1D array', value: 4195 },
    { label: 'Bit array', value: 112370 },
  ],
  closed: [
    { label: '2D array', value: 1231 },
    { label: '1D array', value: 2377 },
    { label: 'Bit array', value: 98550 },
  ],
};

const READING = [
  {
    href: 'https://en.wikipedia.org/wiki/Bitboard',
    label: 'Bitboard',
    note: 'the same trick chess engines use for a whole board',
  },
  {
    href: 'https://en.wikipedia.org/wiki/SWAR',
    label: 'SWAR',
    note: 'parallel math inside one ordinary number',
  },
  {
    href: 'https://en.wikipedia.org/wiki/Adder_(electronics)',
    label: 'Adder (electronics)',
    note: 'half and full adders built from AND, OR and XOR',
  },
  {
    href: 'https://github.com/DpAkyJ1A/frontend-play-ground/blob/main/src/pages/TheGameOfLifeUltimate/functions.js',
    label: 'The engine source',
    note: 'f_bitArray in functions.js',
  },
];

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatNumber = (value) => value.toLocaleString('en-US');

const ruleName = (birthRules, survivalRules) =>
  `B${[...birthRules].sort().join('')}/S${[...survivalRules].sort().join('')}`;

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Row({ label, code, word, shift = 0, shifted = false, hidden, tone }) {
  return (
    <div
      className={`${styles.row} ${hidden ? styles.isHidden : ''} ${
        tone ? styles[tone] : ''
      }`}
    >
      <span className={styles.rowLabel}>
        {label}
        {code && <code>{code}</code>}
      </span>
      <span className={styles.track}>
        <span
          className={styles.cells}
          style={{ '--shift': shifted ? shift : 0 }}
        >
          {CELLS.map((i) => (
            <span key={i} className={bitAt(word, i) ? styles.alive : undefined} />
          ))}
        </span>
      </span>
    </div>
  );
}

function DigitRow({ label, values, hidden, dimZero, target }) {
  return (
    <div className={`${styles.row} ${hidden ? styles.isHidden : ''}`}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.digits}>
        {values.map((value, i) => (
          <span
            key={i}
            className={`${value ? styles.on : ''} ${
              dimZero && !value ? styles.zero : ''
            } ${i === target ? styles.target : ''}`}
          >
            {value}
          </span>
        ))}
      </span>
    </div>
  );
}

function Mark({ from, span = 1, hidden }) {
  return (
    <span
      className={`${styles.mark} ${hidden ? styles.isHidden : ''}`}
      style={{ '--from': from, '--span': span }}
      aria-hidden="true"
    />
  );
}

function PackVisual({ phase }) {
  return (
    <div className={styles.block}>
      <Row label="row" word={ROW} />
      <DigitRow
        label="bits"
        values={CELLS.map((i) => bitAt(ROW, i))}
        hidden={phase < 1}
      />
      <div className={`${styles.row} ${phase < 1 ? styles.isHidden : ''}`}>
        <span className={styles.rowLabel}>index</span>
        <span className={styles.indexScale}>
          <span>bit 0</span>
          <span>bit 31</span>
        </span>
      </div>
      <div className={`${styles.number} ${phase < 2 ? styles.isHidden : ''}`}>
        <span>Uint32</span>
        <strong>{formatNumber(ROW)}</strong>
        <span>4 bytes for 32 cells</span>
      </div>
    </div>
  );
}

function ShiftVisual({ phase }) {
  return (
    <>
      <div className={styles.block}>
        {SOURCES.map((source) => (
          <Row key={source.label} label={source.label} word={source.word} />
        ))}
        <Mark from={TARGET - 1} span={3} hidden={phase > 0} />
        <Mark from={TARGET} hidden={phase === 0} />
      </div>
      <div className={`${styles.block} ${styles.blockGap}`}>
        {PLANES.map((plane) => {
          const visible = phase === 2 || (phase === 1 && plane.group === 1);
          return (
            <Row
              key={plane.label}
              label={plane.label}
              code={plane.code}
              word={plane.source}
              shift={plane.shift}
              shifted={visible}
              hidden={!visible}
            />
          );
        })}
        <Mark from={TARGET} hidden={phase < 2} />
      </div>
    </>
  );
}

function CountVisual({ phase }) {
  return (
    <div className={styles.stack}>
      <div className={`${styles.block} ${phase !== 0 ? styles.isHidden : ''}`}>
        {PLANES.map((plane) => (
          <Row
            key={plane.label}
            label={plane.label}
            code={plane.code}
            word={shiftWord(plane.source, plane.shift)}
          />
        ))}
        <Mark from={TARGET} />
      </div>
      <div className={`${styles.block} ${phase !== 1 ? styles.isHidden : ''}`}>
        {ROW_SUMS.map((row) => (
          <Row key={row.label} label={row.label} word={row.word} />
        ))}
        <Mark from={TARGET} />
      </div>
      <div className={`${styles.block} ${phase !== 2 ? styles.isHidden : ''}`}>
        {COUNT.map((word, bit) => (
          <Row
            key={bit}
            label={`s${bit}`}
            code={`${2 ** bit}s`}
            word={word}
          />
        ))}
        <DigitRow label="count" values={COUNTS} dimZero target={TARGET} />
        <Mark from={TARGET} />
      </div>
    </div>
  );
}

function RuleVisual({ phase, next }) {
  return (
    <div className={styles.block}>
      <Row label="c" code="row" word={ROW} />
      <DigitRow label="count" values={COUNTS} dimZero target={TARGET} />
      <Row
        label="survive"
        code="c & S"
        word={u(next & ROW)}
        hidden={phase < 1}
      />
      <Row
        label="born"
        code="~c & B"
        word={u(next & ~ROW)}
        hidden={phase < 2}
        tone="born"
      />
      <Row label="next" word={next} hidden={phase < 3} tone="next" />
      <Mark from={TARGET} />
    </div>
  );
}

function SpeedVisual({ fieldType, cols, rows }) {
  const bench = BENCH[fieldType];
  const fastest = bench[bench.length - 1].value;
  const cells = cols * rows;
  const words = Math.ceil(cols / WORD) * rows;
  return (
    <>
      <div className={styles.bars}>
        {bench.map((item) => (
          <div className={styles.bar} key={item.label}>
            <span className={styles.barLabel}>{item.label}</span>
            <span className={styles.barTrack}>
              <span
                className={styles.barFill}
                style={{ '--value': item.value / fastest }}
              />
            </span>
            <span className={styles.barValue}>
              {formatNumber(item.value)}
              <small>gen/s</small>
            </span>
          </div>
        ))}
      </div>
      <dl className={styles.workload}>
        <div>
          <dt>2D array</dt>
          <dd>
            {formatNumber(cells)} cells × 8 neighbor lookups ={' '}
            <strong>{formatNumber(cells * 8)}</strong> lookups, plus an{' '}
            <code>if</code> for every cell
          </dd>
        </div>
        <div>
          <dt>Bit array</dt>
          <dd>
            <strong>{formatNumber(words)}</strong> numbers, a few dozen bitwise
            operations each, no <code>if</code> at all
          </dd>
        </div>
      </dl>
    </>
  );
}

export default function BitArrayExplainer({
  open,
  onClose,
  cols,
  rows,
  fieldType,
  birthRules,
  survivalRules,
}) {
  const tabRefs = useRef([]);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());

  const rule = ruleName(birthRules, survivalRules);
  const next = u(
    getRuleKernel(birthRules, survivalRules)(
      COUNT[0],
      COUNT[1],
      COUNT[2],
      COUNT[3],
      ROW
    )
  );
  const source = getRuleSource(birthRules, survivalRules)
    .replace(' | (~c', '\n     | (~c');
  const bench = BENCH[fieldType];
  const speedup = Math.round(bench[2].value / bench[0].value);
  const edges = fieldType === 'closed' ? 'wrap-around' : 'wall';
  const arrayBytes = cols * rows * 4;
  const bitBytes = Math.ceil(cols / WORD) * rows * 4;

  const steps = [
    {
      tab: 'Pack',
      title: 'One number holds 32 cells',
      body: (
        <>
          The 2D array keeps every cell as its own JavaScript value. The bit
          array keeps a cell as a single bit, so a run of 32 cells fits into
          one 32-bit integer inside a <code>Uint32Array</code>.
        </>
      ),
      phases: [
        {
          label: 'Cells',
          caption: 'One row of the field: 32 cells, each alive or dead.',
        },
        {
          label: 'Bits',
          caption:
            'Alive becomes 1, dead becomes 0. The leftmost cell is bit 0 and the rightmost is bit 31.',
        },
        {
          label: 'Number',
          caption:
            'Those 32 bits are one unsigned integer. The whole row is now a single number the CPU can work on in one go.',
        },
      ],
      visual: <PackVisual phase={phase} />,
      extra: (
        <div className={styles.memory}>
          <p className={styles.extraTitle}>
            Your {cols} × {rows} field in memory
          </p>
          <div className={styles.bars}>
            <div className={styles.bar}>
              <span className={styles.barLabel}>2D or 1D array</span>
              <span className={styles.barTrack}>
                <span className={styles.barFill} style={{ '--value': 1 }} />
              </span>
              <span className={styles.barValue}>
                {formatBytes(arrayBytes)}
              </span>
            </div>
            <div className={styles.bar}>
              <span className={styles.barLabel}>Bit array</span>
              <span className={styles.barTrack}>
                <span
                  className={styles.barFill}
                  style={{ '--value': bitBytes / arrayBytes }}
                />
              </span>
              <span className={styles.barValue}>{formatBytes(bitBytes)}</span>
            </div>
          </div>
          <p className={styles.footnote}>
            A plain array spends at least 4 bytes per cell in Chrome and 8 in
            Firefox. Rows are padded to whole 32-bit words, so the bit array
            here is {Math.round(arrayBytes / bitBytes)}× smaller.
          </p>
        </div>
      ),
    },
    {
      tab: 'Shift',
      title: 'All neighbors in one move',
      body: (
        <>
          A cell’s next state depends on its 8 neighbors. The 2D array reads
          them one at a time, 8 lookups for every cell. The bit array moves
          whole rows instead.
        </>
      ),
      phases: [
        {
          label: 'Neighbors',
          caption:
            'The highlighted cell and its 8 neighbors, spread over three rows.',
        },
        {
          label: 'Shift',
          caption: (
            <>
              <code>row {'<<'} 1</code> slides the row one cell to the right,
              so every cell lines up with its left neighbor.{' '}
              <code>row {'>>>'} 1</code> does the same for the right neighbor.
              32 cells move in one instruction.
            </>
          ),
        },
        {
          label: '8 layers',
          caption:
            'Do the same with the rows above and below and you get 8 layers. Reading down any column gives exactly that cell’s 8 neighbors.',
        },
      ],
      visual: <ShiftVisual phase={phase} />,
      extra: (
        <p className={styles.footnote}>
          A bit that falls off the end of a word is carried in from the
          neighboring word of the same row, so long rows work the same way.
        </p>
      ),
    },
    {
      tab: 'Count',
      title: 'Counting like a circuit',
      body: (
        <>
          Now each column’s 8 bits have to be added up. A loop would do that
          32 times. The bit array adds whole numbers with AND, OR and XOR, the
          way a hardware adder does, so all 32 columns are counted at once.
        </>
      ),
      phases: [
        {
          label: 'Layers',
          caption:
            'Start from the 8 neighbor layers. Each column holds one cell’s neighbors.',
        },
        {
          label: 'Row sums',
          caption: (
            <>
              A full adder turns every three layers into a 2-bit number per
              column: <code>ones = a ^ b ^ c</code>, and <code>twos</code> is
              set when at least two of them are.
            </>
          ),
        },
        {
          label: 'Count',
          caption:
            'Adding those three 2-bit numbers gives every column its neighbor count in binary, split across four numbers: s0 holds the ones, s1 the twos, s2 the fours, s3 the eights.',
        },
      ],
      visual: <CountVisual phase={phase} />,
    },
    {
      tab: 'Rule',
      title: 'The rule is one line of logic',
      body: (
        <>
          Your rule, <strong>{rule}</strong>, becomes a single expression over
          the count bits and the current row <code>c</code>. It’s generated as
          code when the rule changes and then cached, so there’s no{' '}
          <code>if</code> and no loop over cells.
        </>
      ),
      phases: [
        {
          label: 'Row',
          caption:
            'The current row and every column’s neighbor count from the previous step.',
        },
        {
          label: 'Survive',
          caption: (
            <>
              <code>c &amp; S</code> keeps the alive cells whose count is in
              the survive list.
            </>
          ),
        },
        {
          label: 'Born',
          caption: (
            <>
              <code>~c &amp; B</code> picks the dead cells whose count is in the
              birth list.
            </>
          ),
        },
        {
          label: 'Result',
          caption:
            'OR the two together and the next generation of 32 cells is ready: one number written back to the array.',
        },
      ],
      visual: <RuleVisual phase={phase} next={next} />,
      extra: (
        <div className={styles.code}>
          <p className={styles.extraTitle}>Generated for {rule}</p>
          <pre>
            <code>{source}</code>
          </pre>
        </div>
      ),
    },
    {
      tab: 'Speed',
      title: 'Why it’s so much faster',
      body: (
        <>
          Generations per second on a 173 × 127 field with {edges} edges,
          measured in Chrome:
        </>
      ),
      phases: [],
      visual: <SpeedVisual fieldType={fieldType} cols={cols} rows={rows} />,
      extra: (
        <>
          <ul className={styles.reasons}>
            <li>
              <strong>32 cells per operation.</strong> One CPU instruction
              works on all 32 bits of a number at once. The trick is called
              SWAR, SIMD within a register.
            </li>
            <li>
              <strong>At least 32× less memory.</strong> Far more of the field
              stays in the CPU cache, so the processor waits on RAM much less.
            </li>
            <li>
              <strong>No branches.</strong> There’s no{' '}
              <code>if (alive)</code> or <code>if (count === 3)</code>, so the
              CPU has nothing to mispredict.
            </li>
            <li>
              <strong>Plain integers.</strong> A <code>Uint32Array</code> hands
              the JIT raw 32-bit numbers: no nested arrays to follow and no
              type checks on every value.
            </li>
          </ul>
          <div className={styles.reading}>
            <p className={styles.extraTitle}>Further reading</p>
            <ul>
              {READING.map((item) => (
                <li key={item.href}>
                  <a href={item.href} target="_blank" rel="noreferrer">
                    {item.label}
                  </a>
                  <span>{item.note}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ),
    },
  ];

  const current = steps[step];
  const phaseCount = current.phases.length;

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setPhase(0);
  }, [open]);

  useEffect(() => {
    if (!open || !playing || phaseCount < 2) return;
    const id = setInterval(
      () => setPhase((prev) => (prev + 1) % phaseCount),
      PHASE_DURATION
    );
    return () => clearInterval(id);
  }, [open, playing, phaseCount, step]);

  const goToStep = (index, focusTab = false) => {
    const target = Math.min(Math.max(index, 0), steps.length - 1);
    setStep(target);
    setPhase(0);
    if (focusTab) tabRefs.current[target]?.focus();
  };

  const handleTabKey = (e) => {
    if (e.key === 'ArrowRight') goToStep((step + 1) % steps.length, true);
    else if (e.key === 'ArrowLeft')
      goToStep((step - 1 + steps.length) % steps.length, true);
    else if (e.key === 'Home') goToStep(0, true);
    else if (e.key === 'End') goToStep(steps.length - 1, true);
    else return;
    e.preventDefault();
  };

  const choosePhase = (index) => {
    setPlaying(false);
    setPhase(index);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className={styles.dialog}
      title="How the bit array works"
      description={`Why it runs about ${speedup}× faster than a 2D array`}
    >
    <div
        className={styles.tabs}
        role="tablist"
        aria-label="Steps"
        onKeyDown={handleTabKey}
      >
        {steps.map((item, i) => (
          <button
            key={item.tab}
            ref={(node) => (tabRefs.current[i] = node)}
            id={`explainer-tab-${i}`}
            role="tab"
            aria-selected={step === i}
            aria-controls="explainer-panel"
            tabIndex={step === i ? 0 : -1}
            className={step === i ? styles.isActive : ''}
            onClick={() => goToStep(i)}
          >
            <span>{i + 1}</span>
            {item.tab}
          </button>
        ))}
      </div>
      <div
        className={styles.body}
        id="explainer-panel"
        role="tabpanel"
        aria-labelledby={`explainer-tab-${step}`}
        key={step}
      >
        <h3>{current.title}</h3>
        <p className={styles.lead}>{current.body}</p>
        <div className={styles.visual}>{current.visual}</div>
        {phaseCount > 1 && (
          <div className={styles.player}>
            <div className={styles.controls}>
              <button
                className={styles.playToggle}
                aria-label={playing ? 'Pause animation' : 'Play animation'}
                onClick={() => setPlaying((prev) => !prev)}
              >
                <IonIcon icon={playing ? pause : play} aria-hidden="true" />
              </button>
              <div
                className={styles.phases}
                role="group"
                aria-label="Animation steps"
              >
                {current.phases.map((item, i) => (
                  <button
                    key={item.label}
                    aria-pressed={phase === i}
                    className={`${phase === i ? styles.isActive : ''} ${
                      playing ? styles.isPlaying : ''
                    }`}
                    style={{ '--duration': `${PHASE_DURATION}ms` }}
                    onClick={() => choosePhase(i)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <p className={styles.caption}>{current.phases[phase].caption}</p>
          </div>
        )}
        {current.extra}
      </div>
      <footer className={styles.foot}>
        <button
          className={styles.navButton}
          onClick={() => goToStep(step - 1)}
          disabled={step === 0}
        >
          <IonIcon icon={chevronBack} aria-hidden="true" />
          Back
        </button>
        <span className={styles.counter}>
          {step + 1} / {steps.length}
        </span>
        {step < steps.length - 1 ? (
          <button
            className={`${styles.navButton} ${styles.navPrimary}`}
            onClick={() => goToStep(step + 1)}
          >
            Next
            <IonIcon icon={chevronForward} aria-hidden="true" />
          </button>
        ) : (
          <button
            className={`${styles.navButton} ${styles.navPrimary}`}
            onClick={onClose}
          >
            Done
          </button>
        )}
      </footer>
    </Dialog>
  );
}
