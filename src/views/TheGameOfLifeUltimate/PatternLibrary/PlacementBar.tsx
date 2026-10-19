import Icon from '@/components/Icon';
import { ArrowLeftRightIcon, RotateCwIcon } from 'lucide-react';
import PatternShape from './PatternShape';
import { formatRule, type Rule, type Shape } from './rle';
import type { Pattern } from './library';
import styles from './PlacementBar.module.css';

export type PlacementBarProps = {
  pattern: Pattern;
  shape: Shape;
  rule: Rule;
  onRotate: () => void;
  onFlip: () => void;
  onDone: () => void;
  onUseRule: (rule: Rule) => void;
  className?: string;
  style?: React.CSSProperties;
};

export default function PlacementBar({
  pattern,
  shape,
  rule,
  onRotate,
  onFlip,
  onDone,
  onUseRule,
  className = '',
  style,
}: PlacementBarProps) {
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const patternRule = pattern.rule ? formatRule(pattern.rule) : null;
  const ruleMismatch = patternRule && patternRule !== formatRule(rule);

  return (
    <div
      className={`${styles.bar} ${className}`}
      style={style}
      role="group"
      aria-label={`Placing ${pattern.name}`}
    >
      <div className={styles.main}>
        <span className={styles.preview}>
          <PatternShape shape={shape} gap={0.14} minWidth={5} minHeight={5} />
        </span>
        <div className={styles.text}>
          <strong className={styles.name}>{pattern.name}</strong>
          <span className={styles.hint}>
            {isCoarse ? (
              'Tap or drag on the field to place it.'
            ) : (
              <>
                Click the field to place. <kbd>R</kbd> rotates, <kbd>F</kbd>{' '}
                flips, <kbd>Esc</kbd> finishes.
              </>
            )}
          </span>
        </div>
        <button
          className={styles.iconButton}
          aria-label="Rotate"
          title="Rotate (R)"
          onClick={onRotate}
        >
          <Icon icon={RotateCwIcon} aria-hidden="true" />
        </button>
        <button
          className={styles.iconButton}
          aria-label="Flip"
          title="Flip (F)"
          onClick={onFlip}
        >
          <Icon icon={ArrowLeftRightIcon} aria-hidden="true" />
        </button>
        <button className={styles.doneButton} onClick={onDone}>
          Done
        </button>
      </div>
      {ruleMismatch && (
        <p className={styles.warning}>
          Built for {patternRule}, the current rule is {formatRule(rule)}.{' '}
          <button
            className={styles.textButton}
            onClick={() => onUseRule(pattern.rule!)}
          >
            Use {patternRule}
          </button>
        </p>
      )}
    </div>
  );
}
