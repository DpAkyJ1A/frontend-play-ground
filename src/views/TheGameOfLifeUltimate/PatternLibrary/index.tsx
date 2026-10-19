import { useState } from 'react';
import Icon from '@/components/Icon';
import { XIcon } from 'lucide-react';
import PatternShape from './PatternShape';
import { formatRule, type Rule } from './rle';
import {
  CLASSIC_RULE,
  fitsTurned,
  patternGroups,
  patternsById,
  type Pattern,
} from './library';
import type { AddPatternResult, CustomPattern } from './useCustomPatterns';
import styles from './index.module.css';

type OpenGroups = Partial<Record<string, boolean>>;

export type PatternLibraryProps = {
  cols: number;
  rows: number;
  aliveColor: string;
  deadColor: string;
  rule: Rule;
  selectedId?: string | null;
  customPatterns: CustomPattern[];
  onSelect: (pattern: Pattern) => void;
  onTilePointerDown: (
    e: React.PointerEvent<HTMLButtonElement>,
    pattern: Pattern
  ) => void;
  onGrow: (pattern: Pattern) => void;
  onUseRule: (rule: Rule) => void;
  onAddPattern: (text: string, name: string) => AddPatternResult;
  onRemovePattern: (id: string) => void;
};

const CLASSIC = formatRule(CLASSIC_RULE);
const GROUPS_KEY = 'game-of-life-pattern-groups';
const GROUP_DEFAULTS: OpenGroups = { custom: true, spaceships: true };

const readOpenGroups = (): OpenGroups => {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(GROUPS_KEY) ?? 'null'
    );
    return {
      ...GROUP_DEFAULTS,
      ...(typeof stored === 'object' ? stored : null),
    };
  } catch {
    return GROUP_DEFAULTS;
  }
};

const storeOpenGroups = (groups: OpenGroups) => {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    return true;
  } catch {
    return false;
  }
};

export default function PatternLibrary({
  cols,
  rows,
  aliveColor,
  deadColor,
  rule,
  selectedId,
  customPatterns,
  onSelect,
  onTilePointerDown,
  onGrow,
  onUseRule,
  onAddPattern,
  onRemovePattern,
}: PatternLibraryProps) {
  const [openGroups, setOpenGroups] = useState(readOpenGroups);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteName, setPasteName] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const currentRule = formatRule(rule);
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;

  const groups = [
    ...(customPatterns.length
      ? [
          {
            id: 'custom',
            title: 'Your patterns',
            note: 'Saved in this browser.',
            patterns: customPatterns,
          },
        ]
      : []),
    ...patternGroups.map((group) => ({
      ...group,
      patterns: group.patterns.map(({ id }) => patternsById.get(id)!),
    })),
  ];

  const toggleGroup =
    (id: string) => (e: React.ToggleEvent<HTMLDetailsElement>) => {
      const open = e.currentTarget.open;
      setOpenGroups((prev) => {
        if (Boolean(prev[id]) === open) return prev;
        const next = { ...prev, [id]: open };
        storeOpenGroups(next);
        return next;
      });
    };

  const addPattern = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = onAddPattern(pasteText, pasteName);
    if (result.error) {
      setPasteError(result.error);
      return;
    }
    setPasteError(null);
    setPasteText('');
    setPasteName('');
    setOpenGroups((prev) => ({ ...prev, custom: true }));
  };

  return (
    <div
      className={styles.library}
      style={
        { '--alive': aliveColor, '--dead': deadColor } as React.CSSProperties
      }
    >
      <p className={styles.intro}>
        {isCoarse
          ? 'Pick a pattern, then tap the field to place it.'
          : 'Pick a pattern, then click the field to place it. You can also drag it onto the field.'}
      </p>
      {currentRule !== CLASSIC && (
        <div className={styles.ruleBanner}>
          <p>
            Most of these patterns are built for Life Classic ({CLASSIC}). The
            current rule is {currentRule}, so they will behave differently.
          </p>
          <button
            className={styles.textButton}
            onClick={() => onUseRule(CLASSIC_RULE)}
          >
            Switch to Life Classic
          </button>
        </div>
      )}
      <details
        className={styles.group}
        open={isPasteOpen}
        onToggle={(e) => setIsPasteOpen(e.currentTarget.open)}
      >
        <summary className={styles.groupHead}>Paste your own</summary>
        <form className={styles.pasteForm} onSubmit={addPattern}>
          <p className={`${styles.groupNote} ${styles.linkedNote}`}>
            <a
              href="https://conwaylife.com/wiki/RLE"
              target="_blank"
              rel="noreferrer"
            >
              RLE
            </a>{' '}
            or{' '}
            <a
              href="https://conwaylife.com/wiki/Plaintext"
              target="_blank"
              rel="noreferrer"
            >
              plaintext
            </a>
            , the formats{' '}
            <a
              href="https://conwaylife.com/wiki/Main_Page"
              target="_blank"
              rel="noreferrer"
            >
              LifeWiki
            </a>{' '}
            and{' '}
            <a
              href="https://golly.sourceforge.io/"
              target="_blank"
              rel="noreferrer"
            >
              Golly
            </a>{' '}
            use. On a{' '}
            <a
              href="https://conwaylife.com/wiki/Category:Patterns"
              target="_blank"
              rel="noreferrer"
            >
              LifeWiki pattern page
            </a>
            , copy the RLE block and paste it here.
          </p>
          <label className={styles.pasteField}>
            <span>Pattern</span>
            <textarea
              rows={5}
              spellCheck={false}
              value={pasteText}
              placeholder={'x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!'}
              aria-invalid={pasteError ? true : undefined}
              aria-describedby={pasteError ? 'paste-error' : undefined}
              onChange={(e) => setPasteText(e.target.value)}
            />
          </label>
          <label className={styles.pasteField}>
            <span>Name, optional</span>
            <input
              type="text"
              value={pasteName}
              placeholder="Taken from the pattern if it has one"
              onChange={(e) => setPasteName(e.target.value)}
            />
          </label>
          {pasteError && (
            <p id="paste-error" className={styles.pasteError} role="alert">
              {pasteError}
            </p>
          )}
          <button className={styles.addButton} type="submit">
            Add and place
          </button>
        </form>
      </details>
      {groups.map((group) => (
        <details
          key={group.id}
          className={styles.group}
          open={Boolean(openGroups[group.id])}
          onToggle={toggleGroup(group.id)}
        >
          <summary className={styles.groupHead}>
            <span>{group.title}</span>
            <span className={styles.groupCount}>{group.patterns.length}</span>
          </summary>
          <p className={styles.groupNote}>{group.note}</p>
          <ul className={styles.grid}>
            {group.patterns.map((pattern) => {
              const { id } = pattern;
              const patternRule = pattern.rule
                ? formatRule(pattern.rule)
                : CLASSIC;
              const tooBig = !fitsTurned(pattern, cols, rows);
              return (
                <li key={id} className={styles.item}>
                  <button
                    className={styles.tile}
                    aria-pressed={selectedId === id}
                    aria-disabled={tooBig || undefined}
                    aria-describedby={tooBig ? `pattern-size-${id}` : undefined}
                    data-pattern-id={id}
                    onClick={() => !tooBig && onSelect(pattern)}
                    onPointerDown={(e) =>
                      !tooBig && onTilePointerDown(e, pattern)
                    }
                  >
                    <span className={styles.preview}>
                      <PatternShape
                        shape={pattern}
                        gap={0.14}
                        minWidth={14}
                        minHeight={9}
                      />
                    </span>
                    <span className={styles.name}>{pattern.name}</span>
                    <span className={styles.meta}>
                      <span>
                        {pattern.width}×{pattern.height}
                      </span>
                      <span>{pattern.meta}</span>
                      {patternRule !== CLASSIC && (
                        <span className={styles.ruleBadge}>{patternRule}</span>
                      )}
                    </span>
                  </button>
                  {group.id === 'custom' && (
                    <button
                      className={styles.removeButton}
                      aria-label={`Remove ${pattern.name}`}
                      title="Remove"
                      onClick={() => onRemovePattern(id)}
                    >
                      <Icon icon={XIcon} aria-hidden="true" />
                    </button>
                  )}
                  {tooBig && (
                    <p id={`pattern-size-${id}`} className={styles.sizeNote}>
                      Needs {pattern.width}×{pattern.height} cells, the field is{' '}
                      {cols}×{rows}.{' '}
                      <button
                        className={styles.textButton}
                        onClick={() => onGrow(pattern)}
                      >
                        Grow field
                      </button>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      ))}
      <section
        className={styles.moreCard}
        aria-labelledby="more-patterns-title"
      >
        <h3 id="more-patterns-title" className={styles.moreTitle}>
          Want more?
        </h3>
        <p>
          <a
            href="https://conwaylife.com/wiki/Category:Patterns"
            target="_blank"
            rel="noreferrer"
          >
            LifeWiki
          </a>{' '}
          has a page for almost every known pattern, each with RLE you can paste
          above.{' '}
          <a
            href="https://catagolue.hatsya.com/home"
            target="_blank"
            rel="noreferrer"
          >
            Catagolue
          </a>{' '}
          lists what turns up in billions of random soups.
        </p>
        <p>
          Found something new? Share it on the{' '}
          <a
            href="https://conwaylife.com/forums/"
            target="_blank"
            rel="noreferrer"
          >
            ConwayLife forums
          </a>{' '}
          and say you found it in The Game of Life Ultimate. I&apos;d love to
          hear about it.
        </p>
      </section>
    </div>
  );
}
